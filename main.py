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
