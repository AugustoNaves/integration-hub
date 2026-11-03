import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CreditCard, 
  Users, 
  Handshake, 
  Package, 
  Send, 
  Layers, 
  Search, 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Plus, 
  Code2, 
  ExternalLink,
  Table as TableIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const SYSTEM_META = {
  stripe: {
    name: 'Stripe (Financeiro)',
    icon: CreditCard,
    color: '#635BFF',
    badgeBg: 'rgba(99, 91, 255, 0.15)',
    badgeColor: '#818cf8',
    description: 'Pagamentos e transações de clientes',
    badge: 'Pagamentos'
  },
  rh_app: {
    name: 'RH App (Recrutamento)',
    icon: Users,
    color: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeColor: '#34d399',
    description: 'Currículos, vagas e habilidades de candidatos',
    badge: 'Recursos Humanos'
  },
  crm: {
    name: 'CRM (Vendas)',
    icon: Handshake,
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeColor: '#fbbf24',
    description: 'Leads e propostas comerciais',
    badge: 'Comercial'
  },
  erp: {
    name: 'ERP (Operações)',
    icon: Package,
    color: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeColor: '#60a5fa',
    description: 'Pedidos de compra e itens de estoque',
    badge: 'Logística & Pedidos'
  }
};

const DEFAULT_TEMPLATES = {
  stripe: {
    external_id: `evt_${Math.floor(Date.now() / 1000)}`,
    payload: {
      customer: "Lucas Martins",
      amount: 450.0,
      currency: "BRL",
      status: "paid",
      method: "credit_card"
    }
  },
  rh_app: {
    external_id: `cand_${Math.floor(Date.now() / 1000)}`,
    payload: {
      candidate: "Mariana Costa",
      position: "Arquiteta de Software",
      salary_expectation: 11000,
      skills: ["Python", "MongoDB", "Docker", "Node.js"],
      contact: { email: "mariana@example.com", city: "Uberlândia" }
    }
  },
  crm: {
    external_id: `lead_${Math.floor(Date.now() / 1000)}`,
    payload: {
      company: "Indústria Metalúrgica Triângulo",
      contact_name: "Eduardo",
      stage: "negotiation",
      estimated_value: 48000,
      tags: ["b2b", "indústria"]
    }
  },
  erp: {
    external_id: `order_${Math.floor(Date.now() / 1000)}`,
    payload: {
      order_number: 9021,
      client: "Supermercado Progresso",
      items: [
        { sku: "OLEO-900ML", description: "Óleo de Soja 900ml", qty: 40, unit_price: 7.5 },
        { sku: "FAR-1KG", description: "Farinha de Trigo 1kg", qty: 25, unit_price: 4.8 }
      ],
      total: 420.0,
      shipping: { carrier: "Expresso Rápido", eta_days: 1 }
    }
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({ status: 'connecting', mongodb: '' });
  const [stats, setStats] = useState([]);
  const [sources, setSources] = useState([]);
  const [records, setRecords] = useState([]);
  const [filterSource, setFilterSource] = useState('all');
  
  // State: Simulação
  const [simSource, setSimSource] = useState('stripe');
  const [simExtId, setSimExtId] = useState(DEFAULT_TEMPLATES.stripe.external_id);
  const [simPayload, setSimPayload] = useState(JSON.stringify(DEFAULT_TEMPLATES.stripe.payload, null, 2));
  const [simFeedback, setSimFeedback] = useState(null);

  // State: Consulta / Extração
  const [querySource, setQuerySource] = useState('stripe');
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [queryResult, setQueryResult] = useState(null);
  const [queryFilterField, setQueryFilterField] = useState('');
  const [queryFilterOp, setQueryFilterOp] = useState('eq');
  const [queryFilterVal, setQueryFilterVal] = useState('');

  // Carrega dados iniciais
  const refreshData = async () => {
    try {
      setLoading(true);
      const [hRes, sRes, srcRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/`).then(r => r.json()).catch(() => ({ status: 'error' })),
        fetch(`${API_BASE}/stats`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/sources`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/records?limit=50`).then(r => r.json()).catch(() => [])
      ]);
      setHealth(hRes);
      setStats(Array.isArray(sRes) ? sRes : []);
      setSources(Array.isArray(srcRes) ? srcRes : []);
      setRecords(Array.isArray(rRes) ? rRes : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Quando troca a fonte na simulação, atualiza o template
  const handleSelectSimSource = (sid) => {
    setSimSource(sid);
    const tmpl = DEFAULT_TEMPLATES[sid] || { external_id: `evt_${Date.now()}`, payload: { item: 'exemplo' } };
    setSimExtId(tmpl.external_id);
    setSimPayload(JSON.stringify(tmpl.payload, null, 2));
    setSimFeedback(null);
  };

  // Dispara o evento para o hub
  const handleSendPayload = async () => {
    setSimFeedback(null);
    let parsed;
    try {
      parsed = JSON.parse(simPayload);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('O payload deve ser um objeto JSON { ... }');
      }
    } catch (e) {
      setSimFeedback({ type: 'error', message: `JSON Inválido: ${e.message}` });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/records/${simSource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_id: simExtId || null,
          payload: parsed
        })
      });
      const data = await res.json();
      if (res.status === 201) {
        setSimFeedback({
          type: 'success',
          message: `Evento recebido com sucesso e gravado no MongoDB Atlas! ID gerado: ${data.id}`
        });
        refreshData();
      } else if (res.status === 409) {
        setSimFeedback({
          type: 'warning',
          message: `Duplicata bloqueada pelo índice único parcial do MongoDB (HTTP 409)! O ID '${simExtId}' já existia.`
        });
      } else {
        setSimFeedback({ type: 'error', message: data.detail || 'Erro ao enviar dados.' });
      }
    } catch (e) {
      setSimFeedback({ type: 'error', message: `Erro de conexão: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Carrega campos disponíveis ao trocar fonte de consulta
  useEffect(() => {
    if (!querySource) return;
    fetch(`${API_BASE}/sources/${querySource}/fields`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const fieldNames = data.map(d => d.campo);
          setAvailableFields(fieldNames);
          setSelectedFields(fieldNames.slice(0, 4));
        }
      })
      .catch(() => setAvailableFields([]));
  }, [querySource]);

  // Executa extração ($project) ou filtro
  const handleRunQuery = async (customFields = selectedFields, customSource = querySource) => {
    if (!customFields || customFields.length === 0) return;
    try {
      setLoading(true);
      let url;
      if (queryFilterField && queryFilterVal) {
        const params = new URLSearchParams({
          field: queryFilterField,
          value: queryFilterVal,
          op: queryFilterOp
        });
        url = `${API_BASE}/records/${customSource}/filter?${params}`;
      } else {
        const params = new URLSearchParams();
        customFields.forEach(f => params.append('fields', f));
        url = `${API_BASE}/records/${customSource}/extract?${params}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setQueryResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Botões de 1 clique para relatórios
  const handleQuickReport = (sid, fields) => {
    setQuerySource(sid);
    setSelectedFields(fields);
    setQueryFilterField('');
    setQueryFilterVal('');
    handleRunQuery(fields, sid);
  };

  const totalDocs = stats.reduce((acc, s) => acc + (s.registros || 0), 0);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-badge">
            <Database size={24} />
          </div>
          <div className="title-group">
            <h1>Hub de Integração Universal</h1>
            <p>Centralizando dados heterogêneos no MongoDB Atlas (BSON flexível)</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="status-pill">
            <span className="status-dot"></span>
            <span>MongoDB Atlas: {health.status === 'ok' ? 'Conectado' : 'Verificando...'}</span>
          </div>
          <button className="btn btn-outline" onClick={refreshData} disabled={loading} title="Atualizar dados">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="tabs-nav">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={18} />
          1. Visão Geral (Os 4 Sistemas)
        </button>
        <button 
          className={`tab-btn ${activeTab === 'simulate' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulate')}
        >
          <Send size={18} />
          2. Simular Envio de API
        </button>
        <button 
          className={`tab-btn ${activeTab === 'collection' ? 'active' : ''}`}
          onClick={() => setActiveTab('collection')}
        >
          <Layers size={18} />
          3. Banco Unificado (api_records)
        </button>
        <button 
          className={`tab-btn ${activeTab === 'queries' ? 'active' : ''}`}
          onClick={() => setActiveTab('queries')}
        >
          <Search size={18} />
          4. Consultas & Relatórios
        </button>
      </nav>

      {/* ========================================================= */}
      {/* TAB 1: VISÃO GERAL */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div>
          <div className="callout">
            <CheckCircle2 size={24} className="callout-icon" />
            <div>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>Ponto Central da Arquitetura:</strong>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                Todos os <strong>{totalDocs} documentos</strong> abaixo vieram de APIs independentes e estão unificados 
                dentro da coleção <code>api_records</code> no MongoDB Atlas. Não foi necessário criar tabelas separadas para cada sistema.
              </p>
            </div>
          </div>

          <div className="grid-4">
            {['stripe', 'rh_app', 'crm', 'erp'].map(sid => {
              const meta = SYSTEM_META[sid];
              const Icon = meta.icon;
              const count = stats.find(s => s.source_id === sid)?.registros || 0;
              return (
                <div key={sid} className="card">
                  <div className="card-header">
                    <div className="card-icon-wrap" style={{ background: meta.badgeBg, color: meta.color }}>
                      <Icon size={22} />
                    </div>
                    <span className="badge" style={{ background: meta.badgeBg, color: meta.badgeColor }}>
                      {meta.badge}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>{meta.name}</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.35rem 0 1rem' }}>
                    {meta.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span className="metric-number">{count}</span>
                    <span className="metric-label">registros salvos</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#fff' }}>
              Catálogo de APIs Integradas (<code>api_sources</code>)
            </h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sistema</th>
                    <th>ID de Origem</th>
                    <th>Descrição</th>
                    <th>Status</th>
                    <th>Documentos</th>
                    <th>Último Recebimento</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(s => {
                    const meta = SYSTEM_META[s._id] || {};
                    const stat = stats.find(st => st.source_id === s._id);
                    return (
                      <tr key={s._id}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td><code>{s._id}</code></td>
                        <td style={{ color: 'var(--text-muted)' }}>{s.description}</td>
                        <td>
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.35rem', 
                            color: s.active ? '#34d399' : '#f87171',
                            fontWeight: 600,
                            fontSize: '0.82rem'
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.active ? '#10b981' : '#ef4444' }}></span>
                            {s.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{stat?.registros || 0}</td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                          {stat?.ultimo_recebimento ? new Date(stat.ultimo_recebimento).toLocaleString('pt-BR') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: SIMULAR ENVIO DE API */}
      {/* ========================================================= */}
      {activeTab === 'simulate' && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Simular Recebimento de Webhook</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Escolha uma API externa e dispare um payload JSON para o endpoint <code>/records/{'{source_id}'}</code>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {['stripe', 'rh_app', 'crm', 'erp'].map(sid => {
              const meta = SYSTEM_META[sid];
              const Icon = meta.icon;
              const isSelected = simSource === sid;
              return (
                <button
                  key={sid}
                  onClick={() => handleSelectSimSource(sid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.25rem',
                    background: isSelected ? meta.badgeBg : 'var(--bg-card)',
                    border: `1px solid ${isSelected ? meta.color : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: isSelected ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <Icon size={18} style={{ color: meta.color }} />
                  {meta.name}
                </button>
              );
            })}
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Identificador Externo na Origem (<code>external_id</code>):</label>
              <input 
                type="text" 
                className="form-input" 
                value={simExtId} 
                onChange={e => setSimExtId(e.target.value)}
                placeholder="ex: evt_12345"
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'block' }}>
                Protegido por índice único parcial: se você tentar reenviar o mesmo ID, o MongoDB rejeitará a duplicação.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Payload JSON Recebido (Estrutura Livre):</label>
              <textarea 
                className="form-textarea" 
                rows={10} 
                value={simPayload} 
                onChange={e => setSimPayload(e.target.value)}
              />
            </div>

            {simFeedback && (
              <div style={{
                padding: '0.85rem 1.15rem',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.88rem',
                background: simFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 
                            simFeedback.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                border: `1px solid ${
                  simFeedback.type === 'success' ? '#10b981' : 
                  simFeedback.type === 'warning' ? '#f59e0b' : '#f43f5e'
                }`,
                color: simFeedback.type === 'success' ? '#34d399' : 
                       simFeedback.type === 'warning' ? '#fbbf24' : '#fb7185'
              }}>
                {simFeedback.type === 'success' && <CheckCircle2 size={18} />}
                {simFeedback.type === 'warning' && <AlertTriangle size={18} />}
                {simFeedback.type === 'error' && <AlertTriangle size={18} />}
                <span>{simFeedback.message}</span>
              </div>
            )}

            <button 
              className="btn btn-primary" 
              onClick={handleSendPayload} 
              disabled={loading}
              style={{ minWidth: '220px' }}
            >
              <Send size={16} />
              Disparar Evento para o Hub
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: BANCO UNIFICADO (api_records) */}
      {/* ========================================================= */}
      {activeTab === 'collection' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Coleção Única: <code>api_records</code></h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Documentos com estruturas totalmente diferentes convivendo lado a lado sem regras rígidas de tabela.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filtrar por API:</span>
              <select 
                className="form-select" 
                style={{ width: 'auto', minWidth: '180px' }}
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
              >
                <option value="all">Todas as fontes ({records.length})</option>
                {sources.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {records
              .filter(r => filterSource === 'all' || r.source_id === filterSource)
              .map(rec => {
                const meta = SYSTEM_META[rec.source_id] || { name: rec.source_id, badge: 'API', badgeBg: 'rgba(255,255,255,0.1)', badgeColor: '#fff', icon: Database };
                const Icon = meta.icon;
                return (
                  <DocumentCard key={rec._id} record={rec} meta={meta} Icon={Icon} />
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: CONSULTAS & RELATÓRIOS */}
      {/* ========================================================= */}
      {activeTab === 'queries' && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Consultas & Relatórios Estruturados</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              A "Query Mágica": o MongoDB usa o operador <code>$project</code> para transformar JSONs aninhados em colunas tabulares sob demanda.
            </p>
          </div>

          {/* Atalhos Rápidos */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚡ Relatórios Prontos (1 Clique):
            </h4>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => handleQuickReport('stripe', ['customer', 'amount', 'status', 'currency'])}
              >
                <CreditCard size={16} style={{ color: '#635BFF' }} />
                Extrato Financeiro (Stripe)
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => handleQuickReport('rh_app', ['candidate', 'position', 'salary_expectation'])}
              >
                <Users size={16} style={{ color: '#10b981' }} />
                Banco de Talentos (RH App)
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => handleQuickReport('erp', ['order_number', 'client', 'total'])}
              >
                <Package size={16} style={{ color: '#3b82f6' }} />
                Faturamento de Pedidos (ERP)
              </button>
            </div>
          </div>

          {/* Custom Query Builder */}
          <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff', marginBottom: '1rem' }}>
              🛠️ Montar Consulta Personalizada
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="form-label">Fonte de Origem:</label>
                <select 
                  className="form-select"
                  value={querySource}
                  onChange={e => setQuerySource(e.target.value)}
                >
                  {sources.map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s._id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Filtro por Campo (Opcional):</label>
                <select 
                  className="form-select"
                  value={queryFilterField}
                  onChange={e => setQueryFilterField(e.target.value)}
                >
                  <option value="">(Nenhum filtro)</option>
                  {availableFields.map(f => (
                    <option key={f} value={f}>payload.{f}</option>
                  ))}
                </select>
              </div>

              {queryFilterField && (
                <>
                  <div>
                    <label className="form-label">Operador:</label>
                    <select 
                      className="form-select"
                      value={queryFilterOp}
                      onChange={e => setQueryFilterOp(e.target.value)}
                    >
                      <option value="eq">Igual (=)</option>
                      <option value="gt">Maior que (&gt;)</option>
                      <option value="gte">Maior ou igual (&gt;=)</option>
                      <option value="lt">Menor que (&lt;)</option>
                      <option value="lte">Menor ou igual (&lt;=)</option>
                      <option value="ne">Diferente (!=)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Valor do Filtro:</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="ex: paid ou 200"
                      value={queryFilterVal}
                      onChange={e => setQueryFilterVal(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Colunas para Projeção Tabular (Schema on Read):</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {availableFields.map(f => {
                  const isChecked = selectedFields.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setSelectedFields(selectedFields.filter(x => x !== f));
                        } else {
                          setSelectedFields([...selectedFields, f]);
                        }
                      }}
                      style={{
                        padding: '0.35rem 0.85rem',
                        borderRadius: '9999px',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        background: isChecked ? 'var(--accent-indigo)' : 'var(--bg-secondary)',
                        color: isChecked ? '#fff' : 'var(--text-muted)',
                        border: `1px solid ${isChecked ? 'var(--accent-indigo)' : 'var(--border-color)'}`,
                        fontWeight: 500
                      }}
                    >
                      {isChecked ? '✓ ' : '+ '} {f}
                    </button>
                  );
                })}
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={() => handleRunQuery()}
              disabled={loading || selectedFields.length === 0}
            >
              <Search size={16} />
              Executar Projeção no MongoDB
            </button>
          </div>

          {/* Resultado da Query */}
          {queryResult && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  💻 Comando Executado no MongoDB Atlas:
                </h4>
                <div className="code-box">
                  {queryResult.pipeline ? (
                    `db.api_records.aggregate(${JSON.stringify(queryResult.pipeline, null, 2)})`
                  ) : (
                    `db.api_records.find(${JSON.stringify(queryResult.query, null, 2)})`
                  )}
                </div>
              </div>

              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                📊 Tabela Resultante ({queryResult.resultados?.length || 0} registros):
              </h4>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>external_id</th>
                      {selectedFields.map(f => (
                        <th key={f}>{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.resultados && queryResult.resultados.length > 0 ? (
                      queryResult.resultados.map((row, idx) => (
                        <tr key={idx}>
                          <td><code>{row.external_id || '—'}</code></td>
                          {selectedFields.map(f => {
                            const val = row[f] !== undefined ? row[f] : (row.payload ? row.payload[f] : '—');
                            return (
                              <td key={f}>
                                {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '—')}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={selectedFields.length + 1} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                          Nenhum resultado encontrado para esta consulta.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Subcomponente de Card de Documento com Sanfona
function DocumentCard({ record, meta, Icon }) {
  const [open, setOpen] = useState(false);
  const p = record.payload || {};

  // Resumo amigável
  let preview = '';
  if (record.source_id === 'stripe') {
    preview = `Cliente: ${p.customer || '—'} • Valor: R$ ${(p.amount || 0).toFixed(2)} • Status: ${p.status || '—'}`;
  } else if (record.source_id === 'rh_app') {
    preview = `Candidato: ${p.candidate || '—'} • Cargo: ${p.position || '—'} • Skills: ${Array.isArray(p.skills) ? p.skills.join(', ') : '—'}`;
  } else if (record.source_id === 'crm') {
    preview = `Empresa: ${p.company || '—'} • Estágio: ${p.stage || '—'} • Valor: R$ ${(p.estimated_value || 0).toLocaleString('pt-BR')}`;
  } else if (record.source_id === 'erp') {
    preview = `Pedido: #${p.order_number || '—'} • Cliente: ${p.client || '—'} • Total: R$ ${(p.total || 0).toFixed(2)}`;
  } else {
    preview = Object.entries(p).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' • ');
  }

  return (
    <div className="card" style={{ padding: '1rem 1.25rem' }}>
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div className="card-icon-wrap" style={{ background: meta.badgeBg, color: meta.color, width: 34, height: 34 }}>
            <Icon size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge" style={{ background: meta.badgeBg, color: meta.badgeColor, padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                {meta.badge}
              </span>
              <strong style={{ fontSize: '0.9rem', color: '#fff' }}>
                {record.external_id || 'sem ID externo'}
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                • {new Date(record.received_at).toLocaleTimeString('pt-BR')}
              </span>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {preview}
            </p>
          </div>
        </div>

        <button className="btn btn-outline" style={{ padding: '0.35rem 0.65rem', border: 'none' }}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Documento BSON Completo (Coleção: <code>api_records</code>):
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              _id: {record._id}
            </span>
          </div>
          <div className="code-box">
            {JSON.stringify(record, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}
