"""Conexão compartilhada com o MongoDB Atlas.

Lê a connection string do arquivo .env (nunca versionado).
"""

import os

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB", "integration_hub")

if not MONGODB_URI or "<senha>" in MONGODB_URI:
  raise RuntimeError(
      "MONGODB_URI não configurada. Copie .env.example para .env e preencha"
      " com a connection string do seu cluster Atlas."
  )

# No macOS o Python nem sempre encontra os certificados raiz;
# o certifi resolve o erro "SSL: CERTIFICATE_VERIFY_FAILED" com o Atlas.
# tz_aware=True: datas voltam com fuso (UTC), e não "ingênuas".
_client_kwargs = {"serverSelectionTimeoutMS": 10000, "tz_aware": True}
if MONGODB_URI.startswith("mongodb+srv://"):
  _client_kwargs["tlsCAFile"] = certifi.where()

client = MongoClient(MONGODB_URI, **_client_kwargs)
db = client[DB_NAME]

api_sources = db["api_sources"]
api_records = db["api_records"]
