"""Prepara o banco no Atlas sem precisar do mongosh.

Equivalente Python de database/init.js + database/seed.js.

Uso:
  python setup_db.py           # cria coleções e índices
  python setup_db.py --seed    # cria + insere dados de demonstração
  python setup_db.py --reset   # APAGA as coleções e recria tudo com seed
"""

import argparse
from datetime import datetime, timezone

from pymongo import ASCENDING, DESCENDING

from db import DB_NAME, api_records, api_sources, db


def utc(iso: str) -> datetime:
  return datetime.fromisoformat(iso.replace("Z", "+00:00"))


SOURCES = [
    {"_id": "stripe", "name": "Stripe", "description": "API de pagamentos"},
    {"_id": "rh_app", "name": "RH App", "description": "Sistema de recursos humanos"},
    {"_id": "crm", "name": "CRM", "description": "Gestão de relacionamento com clientes"},
    {"_id": "erp", "name": "ERP", "description": "Sistema de gestão empresarial (pedidos)"},
]

RECORDS = [
    {
        "source_id": "stripe",
        "external_id": "evt_12345",
        "payload": {"customer": "Maria", "amount": 250.0, "currency": "BRL", "status": "paid"},
        "received_at": utc("2026-11-03T12:30:00Z"),
    },
    {
        "source_id": "stripe",
        "external_id": "evt_12346",
        "payload": {"customer": "João", "amount": 180.0, "currency": "BRL", "status": "pending"},
        "received_at": utc("2026-11-03T12:40:00Z"),
    },
    {
        "source_id": "stripe",
        "external_id": "evt_12347",
        "payload": {
            "customer": "Fernanda",
            "amount": 1200.0,
            "currency": "BRL",
            "status": "paid",
            "method": "pix",
        },
        "received_at": utc("2026-11-03T13:05:00Z"),
    },
    {
        "source_id": "rh_app",
        "external_id": "candidate_987",
        "payload": {
            "candidate": "Carlos",
            "position": "Desenvolvedor",
            "salary_expectation": 4500,
            "skills": ["JavaScript", "React", "Node.js"],
        },
        "received_at": utc("2026-11-03T12:35:00Z"),
    },
    {
        "source_id": "rh_app",
        "external_id": "candidate_988",
        "payload": {
            "candidate": "Juliana",
            "position": "Engenheira de Dados",
            "salary_expectation": 7800,
            "skills": ["Python", "MongoDB", "Spark"],
            "contact": {"email": "juliana@example.com", "city": "Uberlândia"},
        },
        "received_at": utc("2026-11-03T13:10:00Z"),
    },
    {
        "source_id": "crm",
        "external_id": "lead_501",
        "payload": {
            "company": "Tech Solutions LTDA",
            "contact_name": "Paula",
            "stage": "proposal",
            "estimated_value": 35000,
            "tags": ["software", "b2b"],
        },
        "received_at": utc("2026-11-03T14:00:00Z"),
    },
    {
        "source_id": "erp",
        "external_id": "order_1001",
        "payload": {
            "order_number": 1001,
            "client": "Supermercado Central",
            "items": [
                {"sku": "CAF-500G", "description": "Café 500g", "qty": 50, "unit_price": 18.9},
                {"sku": "ACU-1KG", "description": "Açúcar 1kg", "qty": 40, "unit_price": 5.2},
            ],
            "total": 1153.0,
            "shipping": {"carrier": "Transportadora Y", "eta_days": 2},
        },
        "received_at": utc("2026-11-03T14:20:00Z"),
    },
]


def init() -> None:
  existing = db.list_collection_names()
  for name in ("api_sources", "api_records"):
    if name not in existing:
      db.create_collection(name)
      print(f"Coleção criada: {name}")
    else:
      print(f"Coleção já existe: {name}")

  api_records.create_index([("source_id", ASCENDING)], name="idx_source")
  api_records.create_index(
      [("source_id", ASCENDING), ("received_at", DESCENDING)],
      name="idx_source_received",
  )
  api_records.create_index(
      [("source_id", ASCENDING), ("external_id", ASCENDING)],
      name="uniq_source_external",
      unique=True,
      partialFilterExpression={"external_id": {"$type": "string"}},
  )
  print("Índices criados.")


def seed() -> None:
  now = datetime.now(timezone.utc)
  for s in SOURCES:
    api_sources.update_one(
        {"_id": s["_id"]},
        {
            "$set": {"name": s["name"], "description": s["description"], "active": True},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
  for r in RECORDS:
    api_records.update_one(
        {"source_id": r["source_id"], "external_id": r["external_id"]},
        {"$setOnInsert": r},
        upsert=True,
    )
  print(
      f"Seed concluído: {api_sources.count_documents({})} fontes,"
      f" {api_records.count_documents({})} registros."
  )


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--seed", action="store_true", help="insere dados de demonstração")
  parser.add_argument("--reset", action="store_true", help="apaga e recria tudo (com seed)")
  args = parser.parse_args()

  db.client.admin.command("ping")
  print(f"Conectado ao Atlas. Banco: {DB_NAME}")

  if args.reset:
    api_records.drop()
    api_sources.drop()
    print("Coleções removidas.")

  init()
  if args.seed or args.reset:
    seed()
  print("Estrutura do banco preparada!")


if __name__ == "__main__":
  main()
