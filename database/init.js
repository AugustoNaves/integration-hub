// =====================================================================
// init.js — Cria o banco, as coleções e os índices do Integration Hub
// Uso (dentro do mongosh conectado ao Atlas):  load("database/init.js")
// =====================================================================

// Seleciona o banco de dados (o MongoDB cria o banco sob demanda)
const dbHub = db.getSiblingDB("integration_hub");

// Cria as coleções caso ainda não existam
const collections = ["api_sources", "api_records"];

collections.forEach((collectionName) => {
  if (!dbHub.getCollectionNames().includes(collectionName)) {
    dbHub.createCollection(collectionName);
    print(`Coleção criada: ${collectionName}`);
  } else {
    print(`Coleção já existe: ${collectionName}`);
  }
});

// ---------------------------------------------------------------------
// Índices para otimizar consultas
// ---------------------------------------------------------------------

// Consultas por fonte: find({ source_id: "stripe" })
dbHub.api_records.createIndex({ source_id: 1 }, { name: "idx_source" });

// Consultas por fonte ordenadas pelos mais recentes
dbHub.api_records.createIndex(
  { source_id: 1, received_at: -1 },
  { name: "idx_source_received" }
);

// Evita duplicar o mesmo evento de uma mesma fonte (idempotência).
// Parcial: só vale quando external_id existe e é string.
dbHub.api_records.createIndex(
  { source_id: 1, external_id: 1 },
  {
    name: "uniq_source_external",
    unique: true,
    partialFilterExpression: {
      external_id: { $type: "string" }
    }
  }
);

// Busca textual universal em todos os campos do payload (Wildcard Text Index)
dbHub.api_records.createIndex(
  { "payload.$**": "text" },
  { name: "idx_text_payload", default_language: "none" }
);

print("Estrutura do banco preparada!");
