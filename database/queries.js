// =====================================================================
// queries.js — Demonstração da funcionalidade principal:
//              consultar dados heterogêneos armazenados na MESMA coleção.
// Uso:  load("database/queries.js")
// =====================================================================

const dbHub = db.getSiblingDB("integration_hub");

function show(title, cursorOrArray) {
  print("\n=== " + title + " ===");
  printjson(cursorOrArray.toArray ? cursorOrArray.toArray() : cursorOrArray);
}

// 1. Todos os pagamentos da Stripe
show(
  "1. Todos os registros da Stripe",
  dbHub.api_records.find({ source_id: "stripe" })
);

// 2. Somente pagamentos aprovados — acesso direto a campos dentro de payload
show(
  "2. Pagamentos aprovados (payload.status = paid)",
  dbHub.api_records.find({ source_id: "stripe", "payload.status": "paid" })
);

// 3. "Query Mágica": transforma o payload em um formato tabular
//    (equivalente ao  dados->>'cliente' AS nome_cliente  do PostgreSQL)
show(
  "3. Extração organizada (cliente, valor, status)",
  dbHub.api_records.aggregate([
    { $match: { source_id: "stripe" } },
    {
      $project: {
        _id: 0,
        cliente: "$payload.customer",
        valor: "$payload.amount",
        status: "$payload.status"
      }
    }
  ])
);

// 4. Consulta numérica dentro do payload: pagamentos acima de R$ 200
show(
  "4. Pagamentos com valor > 200",
  dbHub.api_records.find(
    { source_id: "stripe", "payload.amount": { $gt: 200 } },
    { _id: 0, "payload.customer": 1, "payload.amount": 1 }
  )
);

// 5. Consulta em array: candidatos que sabem Python
show(
  "5. Candidatos com a skill 'Python'",
  dbHub.api_records.find(
    { source_id: "rh_app", "payload.skills": "Python" },
    { _id: 0, "payload.candidate": 1, "payload.skills": 1 }
  )
);

// 6. Consulta em documento aninhado + array de objetos (ERP)
show(
  "6. Pedidos do ERP que contêm o SKU CAF-500G",
  dbHub.api_records.find(
    { source_id: "erp", "payload.items.sku": "CAF-500G" },
    { _id: 0, "payload.order_number": 1, "payload.client": 1, "payload.shipping": 1 }
  )
);

// 7. Heterogeneidade: campo que só existe em ALGUNS documentos
show(
  "7. Registros que possuem payload.method (campo opcional)",
  dbHub.api_records.find(
    { "payload.method": { $exists: true } },
    { _id: 0, source_id: 1, payload: 1 }
  )
);

// 8. Agregação: total faturado por status na Stripe
show(
  "8. Soma de valores por status (Stripe)",
  dbHub.api_records.aggregate([
    { $match: { source_id: "stripe" } },
    { $group: { _id: "$payload.status", total: { $sum: "$payload.amount" }, qtd: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ])
);

// 9. Quantidade de registros por fonte + último recebimento
show(
  "9. Registros por fonte",
  dbHub.api_records.aggregate([
    {
      $group: {
        _id: "$source_id",
        registros: { $sum: 1 },
        ultimo_recebimento: { $max: "$received_at" }
      }
    },
    { $sort: { registros: -1 } }
  ])
);

// 10. Descoberta de schema: quais campos cada fonte envia no payload?
show(
  "10. Campos encontrados no payload de cada fonte",
  dbHub.api_records.aggregate([
    { $project: { source_id: 1, campos: { $objectToArray: "$payload" } } },
    { $unwind: "$campos" },
    { $group: { _id: "$source_id", campos: { $addToSet: "$campos.k" } } },
    { $sort: { _id: 1 } }
  ])
);

// 11. Junção com o catálogo de fontes ($lookup)
show(
  "11. Registros com o nome da fonte (lookup em api_sources)",
  dbHub.api_records.aggregate([
    { $lookup: { from: "api_sources", localField: "source_id", foreignField: "_id", as: "fonte" } },
    { $unwind: "$fonte" },
    { $project: { _id: 0, fonte: "$fonte.name", external_id: 1, received_at: 1 } },
    { $sort: { received_at: -1 } }
  ])
);

// 12. Prova do índice: o plano de execução usa IXSCAN (não COLLSCAN)
const plan = dbHub.api_records
  .find({ source_id: "stripe" })
  .sort({ received_at: -1 })
  .explain("queryPlanner");
print("\n=== 12. Plano de execução (deve usar índice) ===");
printjson(plan.queryPlanner.winningPlan);
