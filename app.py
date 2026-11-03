"""Integration Hub — Interface de demonstração (Streamlit).

Centraliza dados de 4 sistemas externos (Stripe, RH, CRM, ERP) em uma única
coleção flexível no MongoDB Atlas (api_records).

Rodar (com a API FastAPI no ar):
  streamlit run app.py
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()
API_URL = os.getenv("API_URL", "http://localhost:8000").rstrip("/")
EXAMPLES_DIR = Path(__file__).parent / "examples"

st.set_page_config(
    page_title="Integration Hub • 4 Sistemas em 1",
    page_icon="🔗",
    layout="wide",
)

# ---------------------------------------------------------------------
# Estilos CSS Responsivos e Modernos
# ---------------------------------------------------------------------
st.markdown(
    """
    <style>
      /* Layout responsivo para telas menores (tablets e celulares) */
      @media (max-width: 992px) {
        [data-testid="column"] {
          min-width: calc(50% - 1rem) !important;
          flex: 1 1 calc(50% - 1rem) !important;
          margin-bottom: 0.75rem;
        }
      }
      @media (max-width: 640px) {
        [data-testid="column"] {
          min-width: 100% !important;
          flex: 1 1 100% !important;
          margin-bottom: 0.75rem;
        }
        .main .block-container {
          padding-left: 1rem !important;
          padding-right: 1rem !important;
          padding-top: 1.5rem !important;
        }
        h1 {
          font-size: 1.5rem !important;
        }
        h2 {
          font-size: 1.25rem !important;
        }
        h3 {
          font-size: 1.1rem !important;
        }
      }

      /* Cartões com cantos arredondados e transição suave */
      [data-testid="stVerticalBlockBorderWrapper"] {
        border-radius: 12px !important;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        background-color: rgba(255, 255, 255, 0.02);
      }
      [data-testid="stVerticalBlockBorderWrapper"]:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
      }

      /* Botões com estilo limpo e proporcional */
      .stButton > button, div[data-testid="stFormSubmitButton"] > button {
        border-radius: 8px !important;
        font-weight: 500 !important;
        padding: 0.35rem 1.1rem !important;
        transition: all 0.15s ease !important;
      }

      /* Tabelas e Dataframes responsivos com rolagem horizontal fluida */
      [data-testid="stDataFrame"] {
        border-radius: 8px !important;
        overflow-x: auto !important;
      }

      /* Estilização para blocos de código e JSON */
      pre, code {
        border-radius: 8px !important;
      }

      /* Ajuste nas abas para navegação limpa em telas estreitas */
      [data-testid="stTabs"] [role="tab"] {
        padding: 8px 14px !important;
        font-weight: 500 !important;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------
# Metadados visuais dos 4 sistemas para facilitar o entendimento
# ---------------------------------------------------------------------
SYSTEM_META = {
    "stripe": {
        "name": "Stripe (Financeiro)",
        "icon": "💳",
        "color": "#635BFF",
        "description": "Notificações de pagamentos e transações de clientes",
        "badge": "Pagamentos",
    },
    "rh_app": {
        "name": "RH App (Recrutamento)",
        "icon": "👥",
        "color": "#00A86B",
        "description": "Currículos, vagas e habilidades de candidatos",
        "badge": "Recursos Humanos",
    },
    "crm": {
        "name": "CRM (Vendas)",
        "icon": "🤝",
        "color": "#FF8C00",
        "description": "Leads, propostas comerciais e relacionamento",
        "badge": "Comercial",
    },
    "erp": {
        "name": "ERP (Operações)",
        "icon": "📦",
        "color": "#2B78E4",
        "description": "Pedidos de compra, logística, frete e itens de estoque",
        "badge": "Logística & Pedidos",
    },
}


def get_meta(source_id: str) -> Dict[str, str]:
  return SYSTEM_META.get(
      source_id,
      {
          "name": source_id.upper(),
          "icon": "🌐",
          "color": "#666666",
          "description": "API externa integrada",
          "badge": "API",
      },
  )


# ---------------------------------------------------------------------
# Helpers de comunicação com a API FastAPI
# ---------------------------------------------------------------------
def api(method: str, path: str, **kwargs):
  try:
    r = requests.request(method, f"{API_URL}{path}", timeout=15, **kwargs)
  except requests.exceptions.ConnectionError:
    st.error(
        "❌ **Não foi possível conectar à API FastAPI.**  \n"
        "Abra o terminal e execute: `uvicorn main:app --reload`"
    )
    st.stop()
  if r.status_code >= 400:
    try:
      detail = r.json().get("detail")
    except ValueError:
      detail = r.text
    return None, f"Erro {r.status_code}: {detail}"
  return r.json(), None


def load_example(source_id: str) -> Dict[str, Any]:
  path = EXAMPLES_DIR / f"{source_id}-payload.json"
  if not path.exists():
    alt_map = {
        "rh_app": "rh-payload.json",
        "stripe": "stripe-payload.json",
        "crm": "crm-payload.json",
        "erp": "erp-payload.json",
    }
    path = EXAMPLES_DIR / alt_map.get(source_id, f"{source_id}.json")
  if path.exists():
    return json.loads(path.read_text(encoding="utf-8"))
  return {"source_id": source_id, "external_id": "novo_001", "payload": {"campo": "valor"}}


# ---------------------------------------------------------------------
# Verificação de Saúde e Carga Inicial
# ---------------------------------------------------------------------
health, err = api("GET", "/")
if err:
  st.error(f"Erro ao verificar saúde da API: {err}")
  st.stop()

sources_list, _ = api("GET", "/sources")
sources_list = sources_list or []
all_source_ids = [s["_id"] for s in sources_list]
active_source_ids = [s["_id"] for s in sources_list if s.get("active")]

# ---------------------------------------------------------------------
# Cabeçalho Principal Explicativo
# ---------------------------------------------------------------------
st.title("🔗 Hub de Integração: Centralizando 4 Sistemas no MongoDB")
st.markdown(
    "Este sistema conecta **4 áreas de negócio diferentes** em um único banco de dados, "
    "provando que o MongoDB armazena dados com **formatos completamente diferentes na mesma coleção** (`api_records`)."
)

# ---------------------------------------------------------------------
# Barra Lateral: Gestão e Catálogo (api_sources)
# ---------------------------------------------------------------------
with st.sidebar:
  st.header("🗂️ Catálogo de APIs (`api_sources`)")
  st.caption("Fontes cadastradas e autorizadas a enviar dados:")

  for s in sources_list:
    meta = get_meta(s["_id"])
    status_icon = "🟢" if s.get("active") else "🔴"
    st.markdown(
        f"{status_icon} **{meta['icon']} {s['name']}** (`{s['_id']}`)  \n"
        f"<small>{s.get('description', '')}</small>",
        unsafe_allow_html=True,
    )

  st.divider()
  with st.expander("➕ Cadastrar Nova API no Catálogo"):
    with st.form("nova_fonte_form", clear_on_submit=True):
      novo_id = st.text_input("ID único (ex: helpdesk)", placeholder="ex: suporte")
      novo_nome = st.text_input("Nome da API", placeholder="ex: Suporte Zendesk")
      novo_desc = st.text_input("Descrição", placeholder="ex: Chamados de clientes")
      if st.form_submit_button("Cadastrar", type="primary"):
        if novo_id and novo_nome:
          _, post_err = api(
              "POST",
              "/sources",
              json={
                  "source_id": novo_id.strip().lower(),
                  "name": novo_nome,
                  "description": novo_desc,
              },
          )
          if post_err:
            st.error(post_err)
          else:
            st.success("API cadastrada no catálogo!")
            st.rerun()
        else:
          st.warning("Preencha ID e Nome.")

# ---------------------------------------------------------------------
# Abas Principais do Sistema
# ---------------------------------------------------------------------
tab_overview, tab_simulator, tab_collection, tab_queries = st.tabs(
    [
        "📊 1. Visão Geral (Os 4 Sistemas)",
        "📤 2. Simular Envio de uma API",
        "🗄️ 3. O Banco Unificado (`api_records`)",
        "🔎 4. Consultas & Relatórios",
    ]
)

# =====================================================================
# ABA 1: VISÃO GERAL (OS 4 SISTEMAS EM 1 LUGAR)
# =====================================================================
with tab_overview:
  st.subheader("🏢 Como os 4 Sistemas alimentam o Hub")
  st.write(
      "Cada sistema abaixo opera de forma independente na empresa. "
      "O Hub recebe os eventos de todos eles e armazena os dados sem exigir que usem o mesmo formato."
  )

  stats_data, _ = api("GET", "/stats")
  stats_dict = {item["source_id"]: item["registros"] for item in (stats_data or [])}
  total_registros = sum(stats_dict.values())

  # 4 Cards Visuais para os 4 sistemas
  c1, c2, c3, c4 = st.columns(4)
  cols = [c1, c2, c3, c4]
  canonical_order = ["stripe", "rh_app", "crm", "erp"]

  for idx, sid in enumerate(canonical_order):
    meta = get_meta(sid)
    count = stats_dict.get(sid, 0)
    with cols[idx]:
      with st.container(border=True):
        st.markdown(f"### {meta['icon']} {meta['badge']}")
        st.caption(f"**Sistema:** {meta['name']}")
        st.write(meta["description"])
        st.metric(label="Documentos Recebidos", value=count)

  st.divider()

  # Explicação visual da convergência
  st.info(
      f"🎯 **Ponto de convergência:** Todos os **{total_registros} documentos** acima estão armazenados "
      f"dentro de **UMA ÚNICA coleção do MongoDB Atlas chamada `api_records`**. "
      f"Não foi necessário criar `tabela_stripe`, `tabela_rh`, etc.",
      icon="💡",
  )

  col_graf, col_tab = st.columns([1, 1])
  with col_graf:
    st.markdown("#### Volume de dados por sistema")
    if stats_data:
      df_stats = pd.DataFrame(stats_data)
      st.bar_chart(df_stats.set_index("nome")["registros"])
    else:
      st.info("Nenhum dado cadastrado ainda.")

  with col_tab:
    st.markdown("#### Detalhes das Fontes Integradas")
    if stats_data:
      st.dataframe(
          pd.DataFrame(stats_data)[["source_id", "nome", "registros", "ultimo_recebimento"]],
          use_container_width=True,
      )


# =====================================================================
# ABA 2: SIMULADOR DE ENVIO (SIMULA O WEBHOOK DE CADA API)
# =====================================================================
with tab_simulator:
  st.subheader("📤 Simular a chegada de um evento externo")
  st.write(
      "Escolha qual dos sistemas está gerando dados agora. "
      "Você pode alterar os valores antes de disparar para o banco de dados."
  )

  if not active_source_ids:
    st.warning("Nenhuma fonte ativa disponível.")
  else:
    # Opções amigáveis no seletor
    labels = {sid: f"{get_meta(sid)['icon']} {get_meta(sid)['name']}" for sid in active_source_ids}
    selected_source = st.selectbox(
        "Selecione o sistema que está enviando dados:",
        options=active_source_ids,
        format_func=lambda sid: labels.get(sid, sid),
    )

    meta = get_meta(selected_source)
    example_data = load_example(selected_source)

    st.markdown(f"**Cenário:** Enviando dados de **{meta['name']}** — *{meta['description']}*")

    col_sim_left, col_sim_right = st.columns([1, 2])

    with col_sim_left:
      ext_id_input = st.text_input(
          "ID no sistema original (`external_id`):",
          value=example_data.get("external_id", f"evt_{int(pd.Timestamp.now().timestamp())}"),
          help="Usado pelo índice único para evitar que a mesma mensagem seja processada duas vezes.",
      )
      st.caption("ℹ️ Se tentar enviar 2 vezes o mesmo ID para a mesma fonte, o MongoDB rejeita a duplicata.")

    with col_sim_right:
      payload_text = st.text_area(
          f"Conteúdo livre que a API externa enviou (`payload` em JSON):",
          value=json.dumps(example_data.get("payload", {}), indent=2, ensure_ascii=False),
          height=260,
      )

    btn_send = st.button(
        f"🚀 Disparar evento de {meta['name']} para o MongoDB",
        type="primary",
    )

    if btn_send:
      try:
        parsed_payload = json.loads(payload_text)
        if not isinstance(parsed_payload, dict):
          raise ValueError("O payload precisa ser um objeto JSON (começar e terminar com { }).")
      except ValueError as e:
        st.error(f"❌ JSON inválido: {e}")
      else:
        req_body = {"payload": parsed_payload, "external_id": ext_id_input or None}
        res, post_err = api("POST", f"/records/{selected_source}", json=req_body)

        if post_err:
          if "já foi recebido" in str(post_err) or "409" in str(post_err):
            st.warning(
                f"🛡️ **Duplicata bloqueada pelo MongoDB (HTTP 409)!**  \n"
                f"O evento `{ext_id_input}` de **{meta['name']}** já existia no banco. "
                f"O índice único parcial impediu a duplicação.",
                icon="⚠️",
            )
          else:
            st.error(post_err)
        else:
          st.success(
              f"🎉 **Sucesso!** O Hub recebeu o evento de **{meta['name']}** e persistiu "
              f"o documento na coleção `api_records` com o ID `{res['id']}`!",
              icon="✅",
          )
          st.balloons()


# =====================================================================
# ABA 3: BANCO UNIFICADO (PROVA DO POLIMORFISMO)
# =====================================================================
with tab_collection:
  st.subheader("🗄️ Coleção Única: `api_records`")
  st.markdown(
      "Aqui está a **prova prática do trabalho**: documentos financeiros da Stripe, currículos do RH, "
      "leads do CRM e pedidos do ERP **moram pacificamente dentro da mesma coleção**, sem exigir que todos tenham o mesmo formato."
  )

  col_filter, col_limit = st.columns([2, 1])
  with col_filter:
    filtro_sistema = st.selectbox(
        "Filtrar exibição por sistema:",
        options=["(todos os sistemas juntos)"] + all_source_ids,
        format_func=lambda s: "(todos os sistemas juntos)" if s.startswith("(") else f"{get_meta(s)['icon']} {get_meta(s)['name']}",
    )
  with col_limit:
    limite = st.slider("Quantidade máxima:", min_value=5, max_value=50, value=20)

  params = {"limit": limite}
  if not filtro_sistema.startswith("("):
    params["source_id"] = filtro_sistema

  records_data, rec_err = api("GET", "/records", params=params)

  if rec_err:
    st.error(rec_err)
  elif not records_data:
    st.info("Nenhum registro encontrado.")
  else:
    st.caption(f"Mostrando {len(records_data)} documento(s) armazenado(s):")

    for doc in records_data:
      sid = doc.get("source_id", "desconhecido")
      meta = get_meta(sid)
      payload = doc.get("payload", {})

      # Resumo legível para bater o olho rápido
      resumo_parts = []
      if sid == "stripe":
        resumo_parts.append(f"Cliente: **{payload.get('customer', '—')}**")
        resumo_parts.append(f"Valor: **R$ {payload.get('amount', 0):.2f}**")
        resumo_parts.append(f"Status: `{payload.get('status', '—')}`")
      elif sid == "rh_app":
        resumo_parts.append(f"Candidato: **{payload.get('candidate', '—')}**")
        resumo_parts.append(f"Cargo: **{payload.get('position', '—')}**")
        skills = payload.get("skills", [])
        if skills:
          resumo_parts.append(f"Skills: `{', '.join(skills)}`")
      elif sid == "crm":
        resumo_parts.append(f"Empresa: **{payload.get('company', '—')}**")
        resumo_parts.append(f"Estágio: `{payload.get('stage', '—')}`")
        resumo_parts.append(f"Valor estimado: **R$ {payload.get('estimated_value', 0):,.2f}**")
      elif sid == "erp":
        resumo_parts.append(f"Pedido: **#{payload.get('order_number', '—')}**")
        resumo_parts.append(f"Cliente: **{payload.get('client', '—')}**")
        resumo_parts.append(f"Total: **R$ {payload.get('total', 0):.2f}**")
      else:
        for k, v in list(payload.items())[:3]:
          resumo_parts.append(f"{k}: `{v}`")

      resumo_str = " | ".join(resumo_parts)
      titulo_card = (
          f"{meta['icon']} [{meta['badge']}] ID Externo: {doc.get('external_id', 'sem ID')} •"
          f" Recebido em: {doc.get('received_at', '')[:19]}"
      )

      with st.expander(titulo_card):
        st.markdown(f"**Resumo do Evento:** {resumo_str}")
        st.markdown("**Documento BSON Completo (como está gravado no MongoDB Atlas):**")
        st.json(doc)


# =====================================================================
# ABA 4: CONSULTAS & RELATÓRIOS (A "QUERY MÁGICA")
# =====================================================================
with tab_queries:
  st.subheader("🔎 Consultas & Relatórios Estruturados (A Query Mágica)")
  st.markdown(
      "Como consultar dados que não têm um formato rígido? O MongoDB usa o operador de projeção "
      "(`$project`) para **transformar o JSON flexível em uma tabela organizada sob demanda**."
  )

  # Botões rápidos com 1 clique para demonstração
  st.markdown("#### ⚡ Relatórios Prontos (Clique para testar):")
  rc1, rc2, rc3 = st.columns(3)

  rel_escolhido = None
  if rc1.button("💳 Extrato Financeiro (Stripe)", use_container_width=True):
    rel_escolhido = ("stripe", ["customer", "amount", "status", "currency"], None, None, None)
  if rc2.button("👥 Banco de Talentos (RH App)", use_container_width=True):
    rel_escolhido = ("rh_app", ["candidate", "position", "salary_expectation"], None, None, None)
  if rc3.button("📦 Faturamento de Pedidos (ERP)", use_container_width=True):
    rel_escolhido = ("erp", ["order_number", "client", "total"], None, None, None)

  st.divider()

  st.markdown("#### 🛠️ Ou monte sua própria consulta personalizada:")
  qc_source = st.selectbox(
      "Escolha o sistema para consultar:",
      options=all_source_ids,
      format_func=lambda sid: f"{get_meta(sid)['icon']} {get_meta(sid)['name']}",
      key="custom_qc_source",
  )

  fields_resp, _ = api("GET", f"/sources/{qc_source}/fields")
  campos_disponiveis = [item["campo"] for item in (fields_resp or [])]

  if not campos_disponiveis:
    st.info("Esse sistema ainda não possui registros com payload no banco.")
  else:
    st.write(
        f"**Campos detectados automaticamente no payload de `{qc_source}`:** "
        + ", ".join(f"`{c}`" for c in campos_disponiveis)
    )

    col_fields_sel, col_filter_exp = st.columns([2, 1])

    with col_fields_sel:
      campos_selecionados = st.multiselect(
          "Selecione as colunas para o relatório tabular:",
          options=campos_disponiveis,
          default=campos_disponiveis[:3],
      )

    with col_filter_exp:
      with st.expander("Filtrar por valor específico (opcional)"):
        filtro_campo = st.selectbox("Campo para filtrar:", ["(sem filtro)"] + campos_disponiveis)
        filtro_op = st.selectbox("Operador:", ["eq", "gt", "gte", "lt", "lte", "ne"])
        filtro_val = st.text_input("Valor:", placeholder="ex: paid ou 200")

    # Executa a consulta padrão ou o relatório clicado
    exec_source = rel_escolhido[0] if rel_escolhido else qc_source
    exec_fields = rel_escolhido[1] if rel_escolhido else campos_selecionados

    if exec_fields:
      if not rel_escolhido and filtro_campo != "(sem filtro)" and filtro_val:
        # Consulta com filtro
        q_res, q_err = api(
            "GET",
            f"/records/{exec_source}/filter",
            params={"field": filtro_campo, "value": filtro_val, "op": filtro_op},
        )
        if q_err:
          st.error(q_err)
        elif q_res:
          st.markdown("##### 💻 Comando MongoDB executado:")
          st.code(
              f"db.api_records.find({json.dumps(q_res['query'], ensure_ascii=False)})",
              language="javascript",
          )

          linhas = []
          for r in q_res.get("resultados", []):
            linha = {"external_id": r.get("external_id")}
            for f in exec_fields:
              linha[f] = r.get("payload", {}).get(f)
            linhas.append(linha)
          st.dataframe(pd.DataFrame(linhas), use_container_width=True)
      else:
        # Consulta de extração ($project)
        ext_res, ext_err = api(
            "GET", f"/records/{exec_source}/extract", params={"fields": exec_fields}
        )
        if ext_err:
          st.error(ext_err)
        elif ext_res:
          st.markdown("##### 💻 Pipeline de Agregação executado no MongoDB Atlas:")
          st.code(
              f"db.api_records.aggregate({json.dumps(ext_res['pipeline'], indent=2, ensure_ascii=False)})",
              language="javascript",
          )
          st.markdown("##### 📊 Tabela gerada dinamicamente a partir do JSON:")
          st.dataframe(pd.DataFrame(ext_res.get("resultados", [])), use_container_width=True)
