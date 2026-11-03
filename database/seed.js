// =====================================================================
// seed.js — Insere documentos de demonstração
// Uso:  load("database/seed.js")
// Idempotente: pode rodar várias vezes sem duplicar (usa upsert).
// =====================================================================

const dbHub = db.getSiblingDB("integration_hub");

// ---------------------------------------------------------------------
// 1. Cadastro das fontes (catálogo)
// ---------------------------------------------------------------------
const sources = [
  { _id: "stripe", name: "Stripe", description: "API de pagamentos" },
  { _id: "rh_app", name: "RH App", description: "Sistema de recursos humanos" },
  { _id: "crm", name: "CRM", description: "Gestão de relacionamento com clientes" },
  { _id: "erp", name: "ERP", description: "Sistema de gestão empresarial (pedidos)" }
];

sources.forEach((s) => {
  dbHub.api_sources.updateOne(
    { _id: s._id },
    {
      $set: { name: s.name, description: s.description, active: true },
      $setOnInsert: { created_at: new Date() }
    },
    { upsert: true }
  );
});
print(`Fontes cadastradas: ${dbHub.api_sources.countDocuments()}`);

// ---------------------------------------------------------------------
// 2. Registros recebidos das APIs — formatos DIFERENTES em "payload"
// ---------------------------------------------------------------------
const records = [
  // --- Stripe (pagamentos) ---
  {
    source_id: "stripe",
    external_id: "evt_12345",
    payload: { customer: "Maria", amount: 250.0, currency: "BRL", status: "paid" },
    received_at: new Date("2026-11-03T12:30:00Z")
  },
  {
    source_id: "stripe",
    external_id: "evt_12346",
    payload: { customer: "João", amount: 180.0, currency: "BRL", status: "pending" },
    received_at: new Date("2026-11-03T12:40:00Z")
  },
  {
    source_id: "stripe",
    external_id: "evt_12347",
    payload: { customer: "Fernanda", amount: 1200.0, currency: "BRL", status: "paid", method: "pix" },
    received_at: new Date("2026-11-03T13:05:00Z")
  },

  // --- RH App (candidatos) ---
  {
    source_id: "rh_app",
    external_id: "candidate_987",
    payload: {
      candidate: "Carlos",
      position: "Desenvolvedor",
      salary_expectation: 4500,
      skills: ["JavaScript", "React", "Node.js"]
    },
    received_at: new Date("2026-11-03T12:35:00Z")
  },
  {
    source_id: "rh_app",
    external_id: "candidate_988",
    payload: {
      candidate: "Juliana",
      position: "Engenheira de Dados",
      salary_expectation: 7800,
      skills: ["Python", "MongoDB", "Spark"],
      contact: { email: "juliana@example.com", city: "Uberlândia" }
    },
    received_at: new Date("2026-11-03T13:10:00Z")
  },

  // --- CRM (leads) ---
  {
    source_id: "crm",
    external_id: "lead_501",
    payload: {
      company: "Tech Solutions LTDA",
      contact_name: "Paula",
      stage: "proposal",
      estimated_value: 35000,
      tags: ["software", "b2b"]
    },
    received_at: new Date("2026-11-03T14:00:00Z")
  },

  // --- ERP (pedido com array de itens e documento aninhado) ---
  {
    source_id: "erp",
    external_id: "order_1001",
    payload: {
      order_number: 1001,
      client: "Supermercado Central",
      items: [
        { sku: "CAF-500G", description: "Café 500g", qty: 50, unit_price: 18.9 },
        { sku: "ACU-1KG", description: "Açúcar 1kg", qty: 40, unit_price: 5.2 }
      ],
      total: 1153.0,
      shipping: { carrier: "Transportadora Y", eta_days: 2 }
    },
    received_at: new Date("2026-11-03T14:20:00Z")
  }
];

records.forEach((r) => {
  dbHub.api_records.updateOne(
    { source_id: r.source_id, external_id: r.external_id },
    { $setOnInsert: r },
    { upsert: true }
  );
});
print(`Registros em api_records: ${dbHub.api_records.countDocuments()}`);

print("Documentos de demonstração inseridos!");
