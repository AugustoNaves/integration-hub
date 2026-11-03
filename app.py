"""Integration Hub — Interface de demonstração (Streamlit).

Rodar (com a API já no ar):  streamlit run app.py
"""

import json
import os
from pathlib import Path

import pandas as pd
import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()
API_URL = os.getenv("API_URL", "http://localhost:8000").rstrip("/")
EXAMPLES_DIR = Path(__file__).parent / "examples"

st.set_page_config(page_title="Integration Hub", page_icon="🔗", layout="wide")


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
def api(method: str, path: str, **kwargs):
  try:
    r = requests.request(method, f"{API_URL}{path}", timeout=15, **kwargs)
  except requests.exceptions.ConnectionError:
    st.error("Não foi possível conectar à API. Rode: `uvicorn main:app --reload`")
    st.stop()
  if r.status_code >= 400:
    try:
      detail = r.json().get("detail")
    except ValueError:
      detail = r.text
    return None, f"Erro {r.status_code}: {detail}"
  return r.json(), None


def load_examples():
  examples = {}
  for path in sorted(EXAMPLES_DIR.glob("*.json")):
    data = json.loads(path.read_text(encoding="utf-8"))
    examples[data["source_id"]] = data
  return examples


# ---------------------------------------------------------------------
# Cabeçalho
# ---------------------------------------------------------------------
st.title("🔗 Hub de Integração e Consulta de Dados")
st.caption(
    "Recebe dados de APIs diferentes, armazena o payload original no MongoDB Atlas"
    " (coleção **api_records**) e permite consultá-los depois."
)

health, err = api("GET", "/")
if err:
  st.error(err)
  st.stop()

sources, _ = api("GET", "/sources")
sources = sources or []
source_ids = [s["_id"] for s in sources]
active_ids = [s["_id"] for s in sources if s.get("active")]
examples = load_examples()

# ---------------------------------------------------------------------
# Sidebar — catálogo de fontes (api_sources)
# ---------------------------------------------------------------------
with st.sidebar:
  st.header("📚 Fontes (api_sources)")
  for s in sources:
    icon = "🟢" if s.get("active") else "⚪"
    st.markdown(f"{icon} **{s['name']}** — `{s['_id']}`  \n<small>{s.get('description', '')}</small>",
                unsafe_allow_html=True)

  with st.expander("➕ Cadastrar nova fonte"):
    with st.form("nova_fonte", clear_on_submit=True):
      new_id = st.text_input("ID (minúsculas, sem espaço)", placeholder="ex: ecommerce")
      new_name = st.text_input("Nome", placeholder="ex: Loja Virtual")
      new_desc = st.text_input("Descrição")
      if st.form_submit_button("Cadastrar"):
        _, err = api("POST", "/sources",
                     json={"source_id": new_id, "name": new_name, "description": new_desc})
        if err:
          st.error(err)
        else:
          st.success("Fonte cadastrada!")
          st.rerun()

tab_send, tab_raw, tab_query, tab_stats = st.tabs(
    ["📤 Simular API", "🗄️ Documentos brutos", "🔎 Query Mágica", "📊 Visão geral"]
)

# ---------------------------------------------------------------------
# 1. Simular o envio de uma API externa
# ---------------------------------------------------------------------
with tab_send:
  st.subheader("Simular o recebimento de dados de uma API externa")
  st.write("Cada fonte envia um JSON com estrutura própria. O hub aceita **qualquer formato** no `payload`.")

  if not active_ids:
    st.warning("Nenhuma fonte ativa. Rode `python setup_db.py --seed` ou cadastre uma na barra lateral.")
  else:
    col_a, col_b = st.columns([1, 2])
    with col_a:
      chosen = st.selectbox("Fonte (source_id)", active_ids)
      template = examples.get(chosen, {"external_id": "", "payload": {"campo": "valor"}})
      external_id = st.text_input(
          "external_id (ID na API de origem)",
          value=template.get("external_id", ""),
          key=f"ext_{chosen}",
          help="Usado para evitar duplicidade (índice único parcial).",
      )
    with col_b:
      payload_txt = st.text_area(
          "payload (JSON livre)",
          value=json.dumps(template["payload"], indent=2, ensure_ascii=False),
          height=300,
          key=f"payload_{chosen}",
      )

    if st.button("🚀 Enviar para o hub", type="primary"):
      try:
        payload = json.loads(payload_txt)
        if not isinstance(payload, dict):
          raise ValueError("O payload precisa ser um objeto JSON { ... }")
      except ValueError as e:
        st.error(f"JSON inválido: {e}")
      else:
        body = {"payload": payload, "external_id": external_id or None}
        res, err = api("POST", f"/records/{chosen}", json=body)
        if err:
          st.error(err)
        else:
          st.success(f"Documento armazenado em api_records! `_id = {res['id']}`")
          st.balloons()

# ---------------------------------------------------------------------
# 2. Documentos brutos: formatos diferentes na MESMA coleção
# ---------------------------------------------------------------------
with tab_raw:
  st.subheader("Documentos armazenados em `api_records`")
  st.write("Observe: documentos com **payloads completamente diferentes** convivem na mesma coleção.")
  filtro = st.selectbox("Filtrar por fonte", ["(todas)"] + source_ids, key="raw_filter")
  params = {"limit": 100}
  if filtro != "(todas)":
    params["source_id"] = filtro
  records, err = api("GET", "/records", params=params)
  if err:
    st.error(err)
  else:
    st.caption(f"{len(records)} documento(s)")
    for rec in records:
      label = f"{rec['source_id']} · {rec.get('external_id', '—')} · {rec['received_at'][:19]}"
      with st.expander(label):
        st.json(rec)

# ---------------------------------------------------------------------
# 3. Query Mágica: payload -> tabela
# ---------------------------------------------------------------------
with tab_query:
  st.subheader("Extrair informações específicas do payload")
  st.write("O banco transforma o JSON flexível em **colunas organizadas** na saída "
           "(equivalente ao `dados->>'campo'` do PostgreSQL).")

  if not source_ids:
    st.info("Nenhuma fonte cadastrada.")
  else:
    q_source = st.selectbox("Fonte", source_ids, key="q_source")
    fields_info, _ = api("GET", f"/sources/{q_source}/fields")
    available = [f["campo"] for f in (fields_info or [])]

    if not available:
      st.info("Essa fonte ainda não possui registros.")
    else:
      st.markdown("**Campos descobertos no payload** (schema on read): "
                  + ", ".join(f"`{f['campo']}` ({f['ocorrencias']})" for f in fields_info))

      chosen_fields = st.multiselect("Campos a extrair", available, default=available[:3])

      with st.expander("Filtro opcional dentro do payload"):
        fc1, fc2, fc3 = st.columns(3)
        f_field = fc1.selectbox("Campo", ["(nenhum)"] + available)
        f_op = fc2.selectbox("Operador", ["eq", "ne", "gt", "gte", "lt", "lte"])
        f_value = fc3.text_input("Valor", placeholder="ex: paid ou 200")

      if chosen_fields:
        if f_field != "(nenhum)" and f_value:
          res, err = api("GET", f"/records/{q_source}/filter",
                         params={"field": f_field, "value": f_value, "op": f_op})
          if err:
            st.error(err)
          else:
            st.code("db.api_records.find(" + json.dumps(res["query"], ensure_ascii=False) + ")",
                    language="javascript")
            rows = [{"external_id": r.get("external_id"),
                     **{f: r["payload"].get(f) for f in chosen_fields}}
                    for r in res["resultados"]]
            st.dataframe(pd.DataFrame(rows), use_container_width=True)
        else:
          res, err = api("GET", f"/records/{q_source}/extract", params={"fields": chosen_fields})
          if err:
            st.error(err)
          else:
            st.code("db.api_records.aggregate(" + json.dumps(res["pipeline"], indent=2, ensure_ascii=False) + ")",
                    language="javascript")
            st.dataframe(pd.DataFrame(res["resultados"]), use_container_width=True)

# ---------------------------------------------------------------------
# 4. Visão geral
# ---------------------------------------------------------------------
with tab_stats:
  st.subheader("Registros por fonte")
  data, err = api("GET", "/stats")
  if err:
    st.error(err)
  elif data:
    df = pd.DataFrame(data)
    c1, c2 = st.columns(2)
    c1.metric("Total de registros", int(df["registros"].sum()))
    c2.metric("Fontes com dados", len(df))
    st.bar_chart(df.set_index("nome")["registros"])
    st.dataframe(df, use_container_width=True)
  else:
    st.info("Nenhum registro ainda.")
