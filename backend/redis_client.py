"""Conexão e operações de suporte ao Redis para:
1. Cache de Sessões de Usuário (com TTL).
2. Estruturas de Dados Probabilísticas:
   - HyperLogLog (HLL): Contagem de usuários/visitantes únicos com memória fixa (~12KB).
   - Count-Min Sketch (CMS): Frequência de requisições por endpoint (sem subestimação).
   - Bloom Filter (BF): Verificação de existência prévia de IDs externos (sem falsos negativos).
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Cliente Redis com decode_responses=True para strings em UTF-8
r = redis.from_url(REDIS_URL, decode_responses=True)

# Nomes de chaves das estruturas probabilísticas
CMS_KEY_ROUTES = "cms:route_stats"
BF_KEY_EXTERNAL_IDS = "bf:seen_external_ids"
SET_KNOWN_ROUTES = "set:known_routes"

# Usuários de demonstração para autenticação
DEMO_USERS = {
    "augusto": {
        "id": "usr_augusto",
        "name": "Augusto Naves",
        "email": "augusto@ufu.br",
        "role": "admin",
        "password": "123",
    },
    "pedro": {
        "id": "usr_pedro",
        "name": "Pedro Santos",
        "email": "pedro@ufu.br",
        "role": "analyst",
        "password": "123",
    },
    "professor": {
        "id": "usr_prof",
        "name": "Professor NoSQL",
        "email": "prof@ufu.br",
        "role": "admin",
        "password": "123",
    },
}


def init_probabilistic_structures():
  """Inicializa Bloom Filter e Count-Min Sketch caso ainda não existam no Redis."""
  try:
    # 1. Bloom Filter: taxa de falso positivo de 1% (0.01) e capacidade de 50.000 itens
    try:
      r.execute_command("BF.RESERVE", BF_KEY_EXTERNAL_IDS, "0.01", "50000")
    except redis.ResponseError as e:
      if "item exists" not in str(e).lower():
        print(f"[Redis BF] Aviso ao reservar: {e}")

    # 2. Count-Min Sketch: taxa de erro de 0.001 (0.1%) e certeza de 99% (0.01)
    try:
      r.execute_command("CMS.INITBYPROB", CMS_KEY_ROUTES, "0.001", "0.01")
    except redis.ResponseError as e:
      if "item exists" not in str(e).lower():
        print(f"[Redis CMS] Aviso ao iniciar: {e}")

    print("[Redis] Estruturas probabilísticas inicializadas com sucesso.")
  except Exception as e:
    print(f"[Redis] Aviso de conexão na inicialização: {e}")


# =====================================================================
# 1. CACHE DE LOGIN / SESSÃO (Chave-Valor com TTL)
# =====================================================================


def login_user(
    username: str, password: str, ttl_seconds: int = 7200
) -> Optional[Dict[str, Any]]:
  """Autentica o usuário e grava o token de sessão no Redis com TTL."""
  user = DEMO_USERS.get(username.lower().strip())
  if not user or user["password"] != password:
    return None

  token = str(uuid.uuid4())
  session_data = {
      "user_id": user["id"],
      "username": username.lower(),
      "name": user["name"],
      "email": user["email"],
      "role": user["role"],
      "logged_at": datetime.now(timezone.utc).isoformat(),
  }

  # Armazena a sessão como JSON com expiração automática (TTL)
  session_key = f"session:{token}"
  r.set(session_key, json.dumps(session_data), ex=ttl_seconds)

  # Registra atividade do usuário no HyperLogLog
  record_active_user(user["id"])

  return {"token": token, "expires_in": ttl_seconds, "user": session_data}


def get_session(token: str) -> Optional[Dict[str, Any]]:
  """Recupera os dados da sessão do Redis em O(1). Retorna None se expirado ou inexistente."""
  if not token:
    return None
  raw = r.get(f"session:{token}")
  if not raw:
    return None
  try:
    return json.loads(raw)
  except Exception:
    return None


def delete_session(token: str) -> bool:
  """Logout: remove a chave da sessão imediatamente do Redis."""
  if not token:
    return False
  return bool(r.delete(f"session:{token}"))


# =====================================================================
# 2. ESTRUTURA PROBABILÍSTICA: HyperLogLog (HLL)
# =====================================================================


def record_active_user(user_id_or_ip: str) -> bool:
  """Adiciona o usuário ou IP ao HyperLogLog diário (PFADD).

  Usa apenas ~12 KB de RAM independentemente de ter 10 ou 10 milhões de acessos.
  """
  today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
  key_daily = f"hll:active_users:{today}"
  key_total = "hll:active_users:total"

  # PFADD retorna 1 se o elemento alterou a estimativa de cardinalidade, 0 caso contrário
  res_daily = r.pfadd(key_daily, user_id_or_ip)
  r.pfadd(key_total, user_id_or_ip)
  return bool(res_daily)


def get_hll_stats() -> Dict[str, Any]:
  """Retorna a estimativa de cardinalidade (usuários únicos) calculada pelo HyperLogLog."""
  today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
  key_daily = f"hll:active_users:{today}"
  key_total = "hll:active_users:total"

  daily_count = r.pfcount(key_daily)
  total_count = r.pfcount(key_total)

  return {
      "metric": "HyperLogLog (Cardinalidade de Usuários Únicos)",
      "date": today,
      "daily_unique_users_estimate": daily_count,
      "total_unique_users_estimate": total_count,
      "memory_overhead_bytes": "Aprox. 12 KB (fixo)",
      "standard_error": "0.81%",
  }


# =====================================================================
# 3. ESTRUTURA PROBABILÍSTICA: Count-Min Sketch (CMS)
# =====================================================================


def record_route_hit(route_path: str, count: int = 1):
  """Incrementa a contagem de acesso a um endpoint no Count-Min Sketch."""
  try:
    # Registra no CMS
    r.execute_command("CMS.INCRBY", CMS_KEY_ROUTES, route_path, count)
    # Guarda o caminho no set para sabermos quais rotas consultar no relatório
    r.sadd(SET_KNOWN_ROUTES, route_path)
  except Exception as e:
    # Se a chave não existia por algum motivo, inicializa e tenta de novo
    init_probabilistic_structures()
    try:
      r.execute_command("CMS.INCRBY", CMS_KEY_ROUTES, route_path, count)
      r.sadd(SET_KNOWN_ROUTES, route_path)
    except Exception:
      pass


def get_cms_stats() -> Dict[str, Any]:
  """Consulta as frequências estimadas das rotas via Count-Min Sketch."""
  routes = list(r.smembers(SET_KNOWN_ROUTES))
  if not routes:
    return {
        "metric": "Count-Min Sketch (Frequência de Endpoints)",
        "routes": [],
        "total_tracked_routes": 0,
    }

  # CMS.QUERY <key> <item1> <item2> ...
  counts = r.execute_command("CMS.QUERY", CMS_KEY_ROUTES, *routes)

  results = []
  for route, freq in zip(routes, counts):
    results.append({"route": route, "estimated_hits": int(freq)})

  # Ordena pelos mais acessados (Heavy Hitters)
  results.sort(key=lambda x: x["estimated_hits"], reverse=True)

  return {
      "metric": "Count-Min Sketch (Frequência de Endpoints)",
      "routes": results,
      "total_tracked_routes": len(results),
      "property": (
          "Nunca subestima a frequência (pode superestimar levemente por"
          " colisões de hash)"
      ),
  }


# =====================================================================
# 4. ESTRUTURA PROBABILÍSTICA: Bloom Filter (BF)
# =====================================================================


def check_and_add_external_id(external_id: str) -> Tuple[bool, bool]:
  """Verifica se um external_id já foi visto via Bloom Filter e adiciona.

  Retorna (already_seen, added).
  Se already_seen for False -> GARANTIDO que nunca existiu (sem falsos negativos).
  """
  try:
    exists = bool(r.execute_command("BF.EXISTS", BF_KEY_EXTERNAL_IDS, external_id))
    added = False
    if not exists:
      r.execute_command("BF.ADD", BF_KEY_EXTERNAL_IDS, external_id)
      added = True
    return exists, added
  except Exception as e:
    init_probabilistic_structures()
    exists = bool(r.execute_command("BF.EXISTS", BF_KEY_EXTERNAL_IDS, external_id))
    added = False
    if not exists:
      r.execute_command("BF.ADD", BF_KEY_EXTERNAL_IDS, external_id)
      added = True
    return exists, added


def bf_check_only(external_id: str) -> bool:
  """Apenas consulta o Bloom Filter sem inserir."""
  try:
    return bool(r.execute_command("BF.EXISTS", BF_KEY_EXTERNAL_IDS, external_id))
  except Exception:
    return False


def get_bf_stats() -> Dict[str, Any]:
  """Retorna metadados e status do Bloom Filter."""
  try:
    info_raw = r.execute_command("BF.INFO", BF_KEY_EXTERNAL_IDS)
    # Transforma lista alternada [key, val, key, val] em dict
    info_dict = {}
    if isinstance(info_raw, list):
      for i in range(0, len(info_raw), 2):
        k = str(info_raw[i])
        v = info_raw[i + 1]
        info_dict[k] = v

    return {
        "metric": "Bloom Filter (Verificação de Existência de Registros)",
        "filter_key": BF_KEY_EXTERNAL_IDS,
        "capacity": info_dict.get("Capacity", 50000),
        "items_inserted": info_dict.get("Number of items inserted", 0),
        "expansion_rate": info_dict.get("Expansion rate", 2),
        "property": (
            "Sem falsos negativos (Se disser que não existe, 100% garantido)."
        ),
    }
  except Exception as e:
    return {
        "metric": "Bloom Filter",
        "error": str(e),
    }
