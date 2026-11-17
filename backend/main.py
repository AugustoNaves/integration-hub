"""Integration Hub — API (FastAPI + PyMongo + MongoDB Atlas).

Recebe dados de QUALQUER API externa e armazena o payload original
na coleção api_records, sem exigir um schema fixo.

Rodar:  uvicorn main:app --reload
Docs:   http://localhost:8000/docs
"""

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import DESCENDING
from pymongo.errors import DuplicateKeyError

from db import api_records, api_sources, client

app = FastAPI(
    title="Integration Hub",
    description="Hub de Integração e Consulta de Dados heterogêneos (MongoDB Atlas).",
    version="1.0.0",
)

# Habilita CORS para permitir conexões do frontend React (Vite: localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Nome de campo seguro para usar em "payload.<campo>" (evita operadores "$")
FIELD_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$")


# ---------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------
class SourceIn(BaseModel):
  source_id: str = Field(..., pattern=r"^[a-z0-9_]+$", examples=["crm"])
  name: str = Field(..., examples=["CRM"])
  description: str = Field("", examples=["Gestão de clientes"])
  active: bool = True


class RecordIn(BaseModel):
  # Só os metadados são fixos. O payload aceita QUALQUER estrutura JSON.
  external_id: Optional[str] = Field(None, examples=["evt_99999"])
  payload: Dict[str, Any] = Field(
      ...,
      examples=[{"customer": "Maria", "amount": 250.0, "status": "paid"}],
  )


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
def serialize(value: Any) -> Any:
  """Converte tipos BSON (ObjectId, datetime) para JSON."""
  if isinstance(value, ObjectId):
    return str(value)
  if isinstance(value, datetime):
    return value.isoformat()
  if isinstance(value, dict):
    return {k: serialize(v) for k, v in value.items()}
  if isinstance(value, list):
    return [serialize(v) for v in value]
  return value


def check_field(field: str) -> str:
  if not FIELD_RE.match(field):
    raise HTTPException(400, f"Nome de campo inválido: {field!r}")
  return field


def parse_value(raw: str) -> Any:
  """Converte o valor da query string para número/bool quando fizer sentido."""
  low = raw.lower()
  if low in ("true", "false"):
    return low == "true"
  for cast in (int, float):
    try:
      return cast(raw)
    except ValueError:
      pass
  return raw


def get_active_source(source_id: str) -> Dict[str, Any]:
  source = api_sources.find_one({"_id": source_id})
  if not source:
    raise HTTPException(404, f"Fonte '{source_id}' não cadastrada em api_sources.")
  if not source.get("active", False):
    raise HTTPException(400, f"Fonte '{source_id}' está inativa.")
  return source


# ---------------------------------------------------------------------
# Saúde
# ---------------------------------------------------------------------
@app.get("/", tags=["Saúde"])
def health():
  try:
    client.admin.command("ping")
    return {"status": "ok", "mongodb": "conectado"}
  except Exception as e:  # noqa: BLE001
    raise HTTPException(503, f"MongoDB indisponível: {e}")


# ---------------------------------------------------------------------
# api_sources — catálogo de fontes
# ---------------------------------------------------------------------
@app.get("/sources", tags=["Fontes"])
def list_sources(only_active: bool = False):
  query = {"active": True} if only_active else {}
  return [serialize(s) for s in api_sources.find(query).sort("_id")]


@app.post("/sources", status_code=201, tags=["Fontes"])
def create_source(source: SourceIn):
  doc = {
      "_id": source.source_id,
      "name": source.name,
      "description": source.description,
      "active": source.active,
      "created_at": datetime.now(timezone.utc),
  }
  try:
    api_sources.insert_one(doc)
  except DuplicateKeyError:
    raise HTTPException(409, f"Fonte '{source.source_id}' já existe.")
  return serialize(doc)


@app.patch("/sources/{source_id}", tags=["Fontes"])
def set_source_active(source_id: str, active: bool):
  result = api_sources.update_one({"_id": source_id}, {"$set": {"active": active}})
  if result.matched_count == 0:
    raise HTTPException(404, f"Fonte '{source_id}' não encontrada.")
  return {"source_id": source_id, "active": active}


@app.get("/sources/{source_id}/fields", tags=["Fontes"])
def discover_fields(source_id: str):
  """Descobre quais campos uma fonte envia no payload (schema on read)."""
  pipeline = [
      {"$match": {"source_id": source_id}},
      {"$project": {"kv": {"$objectToArray": "$payload"}}},
      {"$unwind": "$kv"},
      {"$group": {"_id": "$kv.k", "ocorrencias": {"$sum": 1}}},
      {"$sort": {"_id": 1}},
  ]
  return [{"campo": d["_id"], "ocorrencias": d["ocorrencias"]}
          for d in api_records.aggregate(pipeline)]


@app.get("/sources/{source_id}/schema", tags=["Fontes"])
def inspect_schema(source_id: str):
  """Raio-X de Schema: infere campos, tipos de dados BSON, frequência e amostras."""
  get_active_source(source_id)

  total_docs = api_records.count_documents({"source_id": source_id})
  if total_docs == 0:
    return {
        "source_id": source_id,
        "total_records": 0,
        "pipeline_usado": [],
        "fields": [],
    }

  pipeline = [
      {"$match": {"source_id": source_id}},
      {"$project": {"kv": {"$objectToArray": "$payload"}}},
      {"$unwind": "$kv"},
      {
          "$group": {
              "_id": "$kv.k",
              "ocorrencias": {"$sum": 1},
              "tipos": {"$addToSet": {"$type": "$kv.v"}},
              "amostras": {"$push": "$kv.v"},
          }
      },
      {"$sort": {"ocorrencias": -1, "_id": 1}},
  ]

  raw_fields = list(api_records.aggregate(pipeline))
  fields = []
  for item in raw_fields:
    ocorrencias = item["ocorrencias"]
    freq_pct = round((ocorrencias / total_docs) * 100, 1)
    sample = next((s for s in item.get("amostras", []) if s is not None), None)
    fields.append({
        "campo": item["_id"],
        "tipos": item.get("tipos", []),
        "ocorrencias": ocorrencias,
        "frequencia_pct": freq_pct,
        "obrigatorio": freq_pct == 100.0,
        "amostra": serialize(sample),
    })

  return {
      "source_id": source_id,
      "total_records": total_docs,
      "pipeline_usado": pipeline,
      "fields": fields,
  }


# ---------------------------------------------------------------------
# api_records — recebimento e consulta
# ---------------------------------------------------------------------
@app.post("/records/{source_id}", status_code=201, tags=["Registros"])
def receive_record(source_id: str, record: RecordIn):
  """Recebe um payload de qualquer formato e armazena o documento original."""
  get_active_source(source_id)

  doc: Dict[str, Any] = {
      "source_id": source_id,
      "payload": record.payload,
      "received_at": datetime.now(timezone.utc),
  }
  if record.external_id:
    doc["external_id"] = record.external_id

  try:
    result = api_records.insert_one(doc)
  except DuplicateKeyError:
    raise HTTPException(
        409,
        f"Registro '{record.external_id}' da fonte '{source_id}' já foi recebido.",
    )
  return {"mensagem": "Registro armazenado!", "id": str(result.inserted_id)}


@app.get("/records", tags=["Registros"])
def list_records(
    source_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
  query = {"source_id": source_id} if source_id else {}
  cursor = api_records.find(query).sort("received_at", DESCENDING).limit(limit)
  return [serialize(d) for d in cursor]


@app.get("/records/search", tags=["Consultas"])
def search_records(
    q: str = Query(..., min_length=1, description="Termo de busca em qualquer campo"),
    source_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
  """Busca textual global em documentos heterogêneos usando Text Index do MongoDB."""
  import json

  base_query: Dict[str, Any] = {}
  if source_id and source_id != "all":
    base_query["source_id"] = source_id

  # 1. Tenta consulta nativa de texto do MongoDB ($text)
  query = dict(base_query)
  query["$text"] = {"$search": q}

  try:
    cursor = (
        api_records.find(query, {"score": {"$meta": "textScore"}})
        .sort([("score", {"$meta": "textScore"}), ("received_at", DESCENDING)])
        .limit(limit)
    )
    results = [serialize(d) for d in cursor]
    modo = "mongodb_text_index"
  except Exception:
    # 2. Fallback via regex caso o text index não esteja disponível
    modo = "regex_fallback"
    query = dict(base_query)
    cursor = api_records.find(query).sort("received_at", DESCENDING).limit(100)
    escaped = re.escape(q)
    pattern = re.compile(escaped, re.IGNORECASE)
    results = []
    for d in cursor:
      doc_str = json.dumps(serialize(d.get("payload", {})), ensure_ascii=False)
      ext_id = str(d.get("external_id") or "")
      if pattern.search(doc_str) or pattern.search(ext_id):
        results.append(serialize(d))
        if len(results) >= limit:
          break

  return {
      "termo": q,
      "source_id": source_id or "todas",
      "modo": modo,
      "total": len(results),
      "resultados": results,
  }


@app.get("/records/{source_id}/filter", tags=["Consultas"])
def filter_records(
    source_id: str,
    field: str = Query(..., examples=["status"]),
    value: str = Query(..., examples=["paid"]),
    op: str = Query("eq", pattern="^(eq|ne|gt|gte|lt|lte)$"),
):
  """Filtra por um campo DENTRO do payload. Ex.: payload.status = paid."""
  check_field(field)
  parsed = parse_value(value)
  condition = parsed if op == "eq" else {f"${op}": parsed}
  query = {"source_id": source_id, f"payload.{field}": condition}
  cursor = api_records.find(query).sort("received_at", DESCENDING)
  return {"query": serialize(query), "resultados": [serialize(d) for d in cursor]}


@app.get("/records/{source_id}/extract", tags=["Consultas"])
def extract(
    source_id: str,
    fields: List[str] = Query(..., examples=[["customer", "amount", "status"]]),
):
  """A "Query Mágica": transforma campos do payload em colunas organizadas.

  Equivalente a  SELECT dados->>'cliente' AS cliente ...  no PostgreSQL.
  """
  projection: Dict[str, Any] = {"_id": 0, "external_id": 1, "received_at": 1}
  for f in fields:
    check_field(f)
    projection[f.replace(".", "_")] = f"$payload.{f}"

  pipeline = [
      {"$match": {"source_id": source_id}},
      {"$sort": {"received_at": -1}},
      {"$project": projection},
  ]
  return {"pipeline": pipeline, "resultados": [serialize(d) for d in api_records.aggregate(pipeline)]}


@app.get("/stats", tags=["Consultas"])
def stats():
  """Quantidade de registros por fonte, com o nome vindo de api_sources."""
  pipeline = [
      {"$group": {
          "_id": "$source_id",
          "registros": {"$sum": 1},
          "ultimo_recebimento": {"$max": "$received_at"},
      }},
      {"$lookup": {"from": "api_sources", "localField": "_id",
                   "foreignField": "_id", "as": "fonte"}},
      {"$project": {
          "_id": 0,
          "source_id": "$_id",
          "nome": {"$ifNull": [{"$first": "$fonte.name"}, "$_id"]},
          "registros": 1,
          "ultimo_recebimento": 1,
      }},
      {"$sort": {"registros": -1}},
  ]
  return [serialize(d) for d in api_records.aggregate(pipeline)]


@app.get("/analytics/dashboard", tags=["Consultas"])
def analytics_dashboard(source_id: Optional[str] = None):
  """Dashboard Analítico Multidimensional via $facet:

  Executa 4 sub-pipelines analíticos em paralelo no MongoDB Atlas:
  1. KPIs gerais ($group, $cond, $min, $max, $addToSet)
  2. Linha do tempo de recebimento ($dateToString, $group, $sort)
  3. Faixas e histograma de valores ($addFields, $bucketAuto)
  4. Distribuição por status/estágio de negócio ($project, $sortByCount)
  """
  match_stage = (
      {"$match": {"source_id": source_id}}
      if (source_id and source_id != "all")
      else {"$match": {}}
  )

  pipeline = [
      match_stage,
      {
          "$facet": {
              "kpis": [
                  {
                      "$group": {
                          "_id": None,
                          "total_registros": {"$sum": 1},
                          "fontes_ativas": {"$addToSet": "$source_id"},
                          "com_external_id": {
                              "$sum": {
                                  "$cond": [{"$ifNull": ["$external_id", False]}, 1, 0]
                              }
                          },
                          "primeiro_evento": {"$min": "$received_at"},
                          "ultimo_evento": {"$max": "$received_at"},
                      }
                  },
                  {
                      "$project": {
                          "_id": 0,
                          "total_registros": 1,
                          "total_fontes": {"$size": "$fontes_ativas"},
                          "fontes_ativas": 1,
                          "com_external_id": 1,
                          "primeiro_evento": 1,
                          "ultimo_evento": 1,
                      }
                  },
              ],
              "timeline": [
                  {
                      "$group": {
                          "_id": {
                              "$dateToString": {
                                  "format": "%Y-%m-%d %H:00",
                                  "date": "$received_at",
                              }
                          },
                          "contagem": {"$sum": 1},
                          "fontes": {"$addToSet": "$source_id"},
                      }
                  },
                  {"$sort": {"_id": 1}},
              ],
              "faixas_valores": [
                  {
                      "$match": {
                          "$or": [
                              {"payload.amount": {"$exists": True, "$type": "number"}},
                              {"payload.total": {"$exists": True, "$type": "number"}},
                              {
                                  "payload.estimated_value": {
                                      "$exists": True,
                                      "$type": "number",
                                  }
                              },
                              {
                                  "payload.salary_expectation": {
                                      "$exists": True,
                                      "$type": "number",
                                  }
                              },
                          ]
                      }
                  },
                  {
                      "$addFields": {
                          "valor_numerico": {
                              "$ifNull": [
                                  "$payload.amount",
                                  {
                                      "$ifNull": [
                                          "$payload.total",
                                          {
                                              "$ifNull": [
                                                  "$payload.estimated_value",
                                                  "$payload.salary_expectation",
                                              ]
                                          },
                                      ]
                                  },
                              ]
                          }
                      }
                  },
                  {
                      "$bucketAuto": {
                          "groupBy": "$valor_numerico",
                          "buckets": 4,
                          "output": {
                              "contagem": {"$sum": 1},
                              "min": {"$min": "$valor_numerico"},
                              "max": {"$max": "$valor_numerico"},
                              "media": {"$avg": "$valor_numerico"},
                              "total": {"$sum": "$valor_numerico"},
                          },
                      }
                  },
              ],
              "status_distribuicao": [
                  {
                      "$match": {
                          "$or": [
                              {"payload.status": {"$exists": True}},
                              {"payload.stage": {"$exists": True}},
                          ]
                      }
                  },
                  {
                      "$project": {
                          "status_ou_estagio": {
                              "$ifNull": ["$payload.status", "$payload.stage"]
                          }
                      }
                  },
                  {"$sortByCount": "$status_ou_estagio"},
              ],
          }
      },
  ]

  res = list(api_records.aggregate(pipeline))
  facet_result = res[0] if res else {}
  kpis = (facet_result.get("kpis") or [{}])[0]

  return {
      "source_id": source_id or "todas",
      "pipeline_usado": pipeline,
      "kpis": serialize(kpis),
      "timeline": serialize(facet_result.get("timeline", [])),
      "faixas_valores": serialize(facet_result.get("faixas_valores", [])),
      "status_distribuicao": serialize(facet_result.get("status_distribuicao", [])),
  }
