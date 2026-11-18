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
  ChevronUp,
  FileSearch,
  Sparkles,
  Tag,
  X,
  Zap,
  ShieldCheck,
  Activity,
  Key,
  LogIn,
  LogOut,
  User,
  Cpu
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

  // State: Busca Textual Global
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchMeta, setSearchMeta] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // State: Raio-X do Schema (Inferência BSON)
  const [schemaSource, setSchemaSource] = useState('stripe');
  const [schemaData, setSchemaData] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // State: Dashboard Analítico Multidimensional ($facet)
  const [facetData, setFacetData] = useState(null);
  const [facetSource, setFacetSource] = useState('all');
  const [facetLoading, setFacetLoading] = useState(false);
  const [showFacetCode, setShowFacetCode] = useState(false);

  // State: Autenticação & Redis
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('hub_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [demoUsers, setDemoUsers] = useState([]);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('augusto');
  const [loginPassword, setLoginPassword] = useState('123');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // State: Estatísticas Probabilísticas (Redis)
  const [redisStats, setRedisStats] = useState(null);
  const [redisLoading, setRedisLoading] = useState(false);
  const [bfInput, setBfInput] = useState('evt_12345');
  const [bfResult, setBfResult] = useState(null);
  const [bfLoading, setBfLoading] = useState(false);
  const [bfNotice, setBfNotice] = useState('');
  const [simTrafficLoading, setSimTrafficLoading] = useState(false);

  const authHeaders = () => {
    return currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {};
  };

  const fetchDemoUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/demo-users`);
      if (res.ok) {
        const data = await res.json();
        setDemoUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRedisStats = async () => {
    try {
      setRedisLoading(true);
      const res = await fetch(`${API_BASE}/analytics/redis-stats`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setRedisStats(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRedisLoading(false);
    }
  };

  const handleLogin = async (username, password) => {
    try {
      setLoginLoading(true);
      setLoginError('');
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao autenticar');
      }
      const data = await res.json();
      setCurrentUser(data);
      localStorage.setItem('hub_user_session', JSON.stringify(data));
      setLoginModalOpen(false);
      fetchRedisStats();
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    if (currentUser?.token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: authHeaders()
        });
      } catch (e) {
        console.error(e);
      }
    }
    setCurrentUser(null);
    localStorage.removeItem('hub_user_session');
    fetchRedisStats();
  };

  const checkBloomFilter = async (id) => {
    if (!id) return;
    try {
      setBfLoading(true);
      setBfNotice('');
      const res = await fetch(`${API_BASE}/analytics/bloom-filter/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ external_id: id })
      });
      const data = await res.json();
      setBfResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setBfLoading(false);
    }
  };

  const addToBloomFilter = async (id) => {
    if (!id) return;
    try {
      setBfLoading(true);
      const res = await fetch(`${API_BASE}/analytics/bloom-filter/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ external_id: id })
      });
      const data = await res.json();
      setBfNotice(`ID '${id}' registrado no Bloom Filter!`);
      setBfResult({
        external_id: id,
        exists_in_bloom_filter: true,
        propriedade: 'Pode existir no banco ou ser falso positivo controlado (~1%).'
      });
      fetchRedisStats();
    } catch (err) {
      console.error(err);
    } finally {
      setBfLoading(false);
    }
  };

  const simulateHllTraffic = async () => {
    try {
      setSimTrafficLoading(true);
      const batch = Array.from({ length: 10 }, () => `sim_user_${Math.floor(Math.random() * 999999)}`);
      await Promise.all(
        batch.map(u => 
          fetch(`${API_BASE}/sources`, { headers: { 'X-Simulated-User': u } })
        )
      );
      await fetchRedisStats();
    } finally {
      setSimTrafficLoading(false);
    }
  };

  const simulateCmsTraffic = async (route) => {
    try {
      setSimTrafficLoading(true);
      await Promise.all(
        Array.from({ length: 5 }).map(() => fetch(`${API_BASE}${route}`))
      );
      await fetchRedisStats();
    } finally {
      setSimTrafficLoading(false);
    }
  };

  // Carrega dados iniciais
  const refreshData = async () => {
    try {
      setLoading(true);
      const [hRes, sRes, srcRes, rRes, fRes] = await Promise.all([
        fetch(`${API_BASE}/`).then(r => r.json()).catch(() => ({ status: 'error' })),
        fetch(`${API_BASE}/stats`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/sources`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/records?limit=50`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/analytics/dashboard`).then(r => r.json()).catch(() => null)
      ]);
      setHealth(hRes);
      setStats(Array.isArray(sRes) ? sRes : []);
      setSources(Array.isArray(srcRes) ? srcRes : []);
      setRecords(Array.isArray(rRes) ? rRes : []);
      if (fRes) setFacetData(fRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega $facet quando muda a fonte do filtro
  const handleFacetSourceChange = async (sid) => {
    setFacetSource(sid);
    try {
      setFacetLoading(true);
      const url = sid && sid !== 'all' 
        ? `${API_BASE}/analytics/dashboard?source_id=${sid}` 
        : `${API_BASE}/analytics/dashboard`;
      const res = await fetch(url);
      const data = await res.json();
      setFacetData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setFacetLoading(false);
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

  // Busca Textual Global
  const handleTextSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults(null);
      setSearchMeta(null);
      return;
    }
    try {
      setSearchLoading(true);
      const url = `${API_BASE}/records/search?q=${encodeURIComponent(searchTerm)}&source_id=${filterSource}`;
      const res = await fetch(url);
      const data = await res.json();
      setSearchResults(Array.isArray(data.resultados) ? data.resultados : []);
      setSearchMeta(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults(null);
    setSearchMeta(null);
  };

  // Raio-X de Schema (Inferência BSON)
  const fetchSchema = async (sourceId) => {
    try {
      setSchemaLoading(true);
      const res = await fetch(`${API_BASE}/sources/${sourceId}/schema`);
      const data = await res.json();
      setSchemaData(data);
    } catch (err) {
      console.error(err);
      setSchemaData(null);
    } finally {
      setSchemaLoading(false);
    }
  };

  useEffect(() => {
    fetchDemoUsers();
    fetchRedisStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'schema' && schemaSource) {
      fetchSchema(schemaSource);
    }
    if (activeTab === 'redis') {
      fetchRedisStats();
    }
  }, [activeTab, schemaSource]);

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
            <p>MongoDB Atlas (BSON flexível) + Redis Stack (Cache & Métricas Probabilísticas)</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="status-pill">
            <span className="status-dot"></span>
            <span>MongoDB Atlas: {health.status === 'ok' ? 'Conectado' : 'Verificando...'}</span>
          </div>

          <div className="status-pill" style={{ background: 'rgba(244, 63, 94, 0.12)', borderColor: 'rgba(244, 63, 94, 0.3)', color: '#f43f5e' }}>
            <span className="status-dot" style={{ backgroundColor: '#f43f5e', boxShadow: '0 0 8px #f43f5e' }}></span>
            <span>Redis Stack: Ativo</span>
          </div>

          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--bg-secondary)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <User size={15} color="#818cf8" />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>{currentUser.user.name}</span>
                <span style={{ fontSize: '0.65rem', color: '#818cf8', textTransform: 'uppercase' }}>{currentUser.user.role}</span>
              </div>
              <button 
                onClick={handleLogout} 
                className="btn btn-outline" 
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', marginLeft: '0.2rem', borderColor: 'rgba(244, 63, 94, 0.3)', color: '#f43f5e' }}
                title="Encerrar sessão no Redis"
              >
                <LogOut size={13} />
                Sair
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-primary" 
              onClick={() => setLoginModalOpen(true)}
              style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem' }}
            >
              <LogIn size={15} />
              Login (Cache Redis)
            </button>
          )}

          <button className="btn btn-outline" onClick={() => { refreshData(); fetchRedisStats(); }} disabled={loading} title="Atualizar dados">
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
        <button 
          className={`tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
          onClick={() => setActiveTab('schema')}
        >
          <Code2 size={18} />
          5. Raio-X do Schema (BSON)
        </button>
        <button 
          className={`tab-btn ${activeTab === 'redis' ? 'active' : ''}`}
          onClick={() => setActiveTab('redis')}
          style={activeTab === 'redis' ? { borderColor: '#f43f5e', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)' } : {}}
        >
          <Zap size={18} color="#f43f5e" />
          6. Redis & Probabilístico
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

          {/* Painel Analítico Multidimensional via $facet */}
          <div style={{ marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={20} style={{ color: 'var(--accent-indigo)' }} />
                  Dashboard Analítico Multidimensional (Pipeline <code>$facet</code>)
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  O operador <code>$facet</code> bifurca o pipeline e processa 4 análises estatísticas em paralelo em uma única consulta ao MongoDB.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <select 
                  className="form-select" 
                  style={{ width: 'auto', minWidth: '160px' }}
                  value={facetSource}
                  onChange={e => handleFacetSourceChange(e.target.value)}
                  disabled={facetLoading}
                >
                  <option value="all">Todas as Fontes</option>
                  {sources.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setShowFacetCode(!showFacetCode)}
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.8rem' }}
                >
                  <Code2 size={15} />
                  {showFacetCode ? 'Ocultar Pipeline' : 'Ver Pipeline $facet'}
                </button>
              </div>
            </div>

            {showFacetCode && facetData?.pipeline_usado && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="code-box">
                  {`db.api_records.aggregate(${JSON.stringify(facetData.pipeline_usado, null, 2)})`}
                </div>
              </div>
            )}

            {facetLoading ? (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                <span>Processando facetas analíticas no Atlas...</span>
              </div>
            ) : facetData && (
              <div>
                {/* KPIs Rápidos da Faceta */}
                <div className="grid-4" style={{ marginBottom: '1.25rem' }}>
                  <div className="card" style={{ padding: '1rem 1.25rem' }}>
                    <span className="metric-label">Total de Eventos Analisados</span>
                    <div className="metric-number" style={{ color: '#fff' }}>
                      {facetData.kpis?.total_registros || 0}
                    </div>
                  </div>
                  <div className="card" style={{ padding: '1rem 1.25rem' }}>
                    <span className="metric-label">APIs Únicas na Faceta</span>
                    <div className="metric-number" style={{ color: 'var(--accent-indigo)' }}>
                      {facetData.kpis?.total_fontes || 0}
                    </div>
                  </div>
                  <div className="card" style={{ padding: '1rem 1.25rem' }}>
                    <span className="metric-label">Com Idempotência (external_id)</span>
                    <div className="metric-number" style={{ color: '#10b981' }}>
                      {facetData.kpis?.com_external_id || 0}
                    </div>
                  </div>
                  <div className="card" style={{ padding: '1rem 1.25rem' }}>
                    <span className="metric-label">Faixas no Histograma</span>
                    <div className="metric-number" style={{ color: '#f59e0b' }}>
                      {facetData.faixas_valores?.length || 0}
                    </div>
                  </div>
                </div>

                {/* Duas Colunas: $bucketAuto (Valores) e $sortByCount (Status) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  {/* Histograma com $bucketAuto */}
                  <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.92rem', color: '#fff' }}>
                        📊 Histograma de Valores (<code>$bucketAuto</code>)
                      </strong>
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '0.72rem' }}>
                        Auto-Buckets BSON
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Agrupamento probabilístico em faixas de valores (preços, totais e salários) calculado pelo MongoDB.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {facetData.faixas_valores && facetData.faixas_valores.length > 0 ? (
                        facetData.faixas_valores.map((b, idx) => (
                          <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 600, color: '#fff' }}>
                              <span>Faixa: R$ {(b._id?.min || b.min || 0).toLocaleString('pt-BR')} — R$ {(b._id?.max || b.max || 0).toLocaleString('pt-BR')}</span>
                              <span style={{ color: 'var(--accent-indigo)' }}>{b.contagem} {b.contagem === 1 ? 'doc' : 'docs'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                              <span>Média: R$ {Number(b.media || 0).toFixed(2)}</span>
                              <span>Soma: R$ {Number(b.total || 0).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textAlign: 'center', padding: '1rem' }}>
                          Nenhum campo numérico elegível para histograma nesta seleção.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Distribuição por Status com $sortByCount */}
                  <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.92rem', color: '#fff' }}>
                        🏷️ Distribuição por Status (<code>$sortByCount</code>)
                      </strong>
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.72rem' }}>
                        Status & Estágios
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Contagem e ordenação por popularidade de status/estágios entre as APIs integradas.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {facetData.status_distribuicao && facetData.status_distribuicao.length > 0 ? (
                        facetData.status_distribuicao.map((st, idx) => (
                          <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: '#38bdf8' }}>
                                {String(st._id || 'não informado')}
                              </span>
                              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.75rem' }}>
                                {st.count} {st.count === 1 ? 'ocorrência' : 'ocorrências'}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textAlign: 'center', padding: '1rem' }}>
                          Nenhum status detectado nos documentos desta seleção.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline de Recebimento ($dateToString) */}
                {facetData.timeline && facetData.timeline.length > 0 && (
                  <div className="card" style={{ padding: '1rem 1.25rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#fff', display: 'block', marginBottom: '0.75rem' }}>
                      ⏱️ Linha do Tempo de Recebimento (<code>$dateToString</code> + <code>$group</code>)
                    </strong>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {facetData.timeline.map((t, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>{t._id}</span>
                          <strong style={{ color: '#fff' }}>{t.contagem} {t.contagem === 1 ? 'evento' : 'eventos'}</strong>
                          {Array.isArray(t.fontes) && (
                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                              Fontes: {t.fontes.join(', ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
                onChange={e => {
                  setFilterSource(e.target.value);
                  if (searchResults !== null) {
                    setSearchResults(null);
                    setSearchMeta(null);
                  }
                }}
              >
                <option value="all">Todas as fontes ({records.length})</option>
                {sources.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Barra de Busca Textual Global (Wildcard Text Search) */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <form onSubmit={handleTextSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Buscar texto em qualquer campo do payload (ex: Uberlândia, Maria, CAF-500G, pix)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={searchLoading || !searchTerm.trim()}>
                <FileSearch size={16} />
                {searchLoading ? 'Buscando...' : 'Buscar Texto ($text)'}
              </button>
              {searchResults !== null && (
                <button type="button" className="btn btn-outline" onClick={handleClearSearch}>
                  <X size={16} />
                  Limpar Busca
                </button>
              )}
            </form>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                🔍 <strong>Wildcard Text Search:</strong> consulta o índice de texto sobre <code>payload.$**</code> no MongoDB Atlas.
              </span>
              {searchMeta && (
                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontSize: '0.75rem' }}>
                  {searchResults.length} {searchResults.length === 1 ? 'resultado encontrado' : 'resultados encontrados'} • Modo: {searchMeta.modo}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(searchResults !== null 
              ? searchResults 
              : records.filter(r => filterSource === 'all' || r.source_id === filterSource)
            ).map(rec => {
              const meta = SYSTEM_META[rec.source_id] || { name: rec.source_id, badge: 'API', badgeBg: 'rgba(255,255,255,0.1)', badgeColor: '#fff', icon: Database };
              const Icon = meta.icon;
              return (
                <DocumentCard key={rec._id} record={rec} meta={meta} Icon={Icon} />
              );
            })}

            {searchResults !== null && searchResults.length === 0 && (
              <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ marginBottom: '1rem' }}>Nenhum documento encontrado contendo o termo <strong>"{searchTerm}"</strong>.</p>
                <button className="btn btn-outline" onClick={handleClearSearch} style={{ margin: '0 auto' }}>
                  Voltar para todos os documentos
                </button>
              </div>
            )}
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

      {/* ========================================================= */}
      {/* TAB 5: RAIO-X DO SCHEMA (BSON) */}
      {/* ========================================================= */}
      {activeTab === 'schema' && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Raio-X de Schema & Inferência de Tipos BSON</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Como o MongoDB não impõe tabelas estáticas, usamos pipelines de agregação (<code>$objectToArray</code> + <code>$type</code>) para auditar a estrutura viva e a evolução das APIs em tempo real.
            </p>
          </div>

          {/* Seletor de Fonte */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {['stripe', 'rh_app', 'crm', 'erp'].map(sid => {
              const meta = SYSTEM_META[sid] || {};
              const Icon = meta.icon || Database;
              const isSelected = schemaSource === sid;
              return (
                <button
                  key={sid}
                  onClick={() => setSchemaSource(sid)}
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

          {schemaLoading ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
              <p>Inspecionando documentos no MongoDB Atlas...</p>
            </div>
          ) : schemaData && (
            <div>
              {/* Cards de Métricas do Schema */}
              <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                <div className="card">
                  <span className="metric-label">Documentos Inspecionados</span>
                  <div className="metric-number" style={{ color: '#fff' }}>{schemaData.total_records}</div>
                </div>
                <div className="card">
                  <span className="metric-label">Campos Distintos Detectados</span>
                  <div className="metric-number" style={{ color: 'var(--accent-indigo)' }}>
                    {schemaData.fields?.length || 0}
                  </div>
                </div>
                <div className="card">
                  <span className="metric-label">Campos Obrigatórios (100%)</span>
                  <div className="metric-number" style={{ color: '#10b981' }}>
                    {schemaData.fields?.filter(f => f.obrigatorio).length || 0}
                  </div>
                </div>
                <div className="card">
                  <span className="metric-label">Campos Opcionais / Drift</span>
                  <div className="metric-number" style={{ color: '#f59e0b' }}>
                    {schemaData.fields?.filter(f => !f.obrigatorio).length || 0}
                  </div>
                </div>
              </div>

              {/* Tabela do Raio-X */}
              <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Tipos BSON</th>
                      <th>Frequência / Presença</th>
                      <th>Status de Contrato</th>
                      <th>Amostra de Dado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemaData.fields && schemaData.fields.length > 0 ? (
                      schemaData.fields.map(f => (
                        <tr key={f.campo}>
                          <td>
                            <code style={{ fontSize: '0.85rem', fontWeight: 600 }}>payload.{f.campo}</code>
                          </td>
                          <td>
                            {f.tipos.map(t => (
                              <span key={t} className={`type-badge type-${t}`}>
                                {t}
                              </span>
                            ))}
                          </td>
                          <td style={{ minWidth: '160px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              <span>{f.frequencia_pct}%</span>
                              <span>{f.ocorrencias}/{schemaData.total_records} docs</span>
                            </div>
                            <div className="progress-bar-bg">
                              <div 
                                className="progress-bar-fill" 
                                style={{ 
                                  width: `${f.frequencia_pct}%`,
                                  background: f.obrigatorio ? '#10b981' : '#f59e0b'
                                }}
                              />
                            </div>
                          </td>
                          <td>
                            {f.obrigatorio ? (
                              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                                Obrigatório (100%)
                              </span>
                            ) : (
                              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                                Evolutivo / Opcional
                              </span>
                            )}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {typeof f.amostra === 'object' && f.amostra !== null 
                              ? JSON.stringify(f.amostra) 
                              : String(f.amostra ?? '—')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                          Nenhum documento encontrado para analisar o schema desta fonte.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pipeline usado */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  💻 Pipeline de Agregação executado no Atlas:
                </h4>
                <div className="code-box">
                  {`db.api_records.aggregate(${JSON.stringify(schemaData.pipeline_usado, null, 2)})`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: REDIS & ESTRUTURAS DE DADOS PROBABILÍSTICAS */}
      {/* ========================================================= */}
      {activeTab === 'redis' && (
        <div>
          {/* Header do Redis */}
          <div className="callout" style={{ borderLeftColor: '#f43f5e', background: 'rgba(244, 63, 94, 0.05)', marginBottom: '1.5rem' }}>
            <Zap size={26} color="#f43f5e" className="callout-icon" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <strong style={{ color: '#fff', fontSize: '1.05rem' }}>
                  Redis Stack: Cache de Sessões & Estruturas de Dados Probabilísticas
                </strong>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a 
                    href="http://localhost:8001" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-outline" 
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', borderColor: 'rgba(244, 63, 94, 0.4)', color: '#f43f5e' }}
                  >
                    <ExternalLink size={14} />
                    Abrir RedisInsight (GUI)
                  </a>
                  <button 
                    onClick={fetchRedisStats} 
                    className="btn btn-outline" 
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                    disabled={redisLoading}
                  >
                    <RefreshCw size={14} className={redisLoading ? 'animate-spin' : ''} />
                    Atualizar Métricas
                  </button>
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.3rem' }}>
                O Redis opera 100% em memória RAM. Aqui resolvemos dois gargalos comuns: autenticação ultra-rápida via <strong>cache com TTL</strong> e estatísticas de tráfego de alto volume via <strong>estruturas probabilísticas</strong> (economizando até 99% de memória).
              </p>
            </div>
          </div>

          {/* Grid Principal: 2 Colunas */}
          <div className="grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
            
            {/* 1. CACHE DE SESSÃO / LOGIN (TTL) */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                <div className="card-icon-wrap" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
                  <Key size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 600 }}>1. Cache de Login de Usuário (TTL)</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Armazenamento Chave-Valor em memória RAM com expiração automática</p>
                </div>
              </div>

              {currentUser ? (
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                      Sessão Ativa no Redis
                    </span>
                    <button 
                      onClick={handleLogout} 
                      className="btn btn-outline" 
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderColor: 'rgba(244, 63, 94, 0.3)', color: '#f43f5e' }}
                    >
                      <LogOut size={13} />
                      Encerrar Sessão (DEL)
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '0.25rem' }}>
                    <strong>{currentUser.user.name}</strong> ({currentUser.user.email})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Nível de Acesso: <span style={{ color: 'var(--accent-indigo)', fontWeight: 600 }}>{currentUser.user.role.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: '#94a3b8', wordBreak: 'break-all' }}>
                    Chave Redis: <code>session:{currentUser.token}</code> (TTL: 7200s)
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Nenhum usuário logado no momento. Faça login para gerar uma sessão com TTL no Redis:
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button 
                      onClick={() => handleLogin('augusto', '123')} 
                      className="btn btn-primary" 
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      disabled={loginLoading}
                    >
                      Logar como Augusto (Admin)
                    </button>
                    <button 
                      onClick={() => handleLogin('pedro', '123')} 
                      className="btn btn-outline" 
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      disabled={loginLoading}
                    >
                      Logar como Pedro (Analyst)
                    </button>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong>Comando executado no Redis:</strong>
                <div className="code-box" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                  {currentUser 
                    ? `SET session:${currentUser.token} '${JSON.stringify(currentUser.user)}' EX 7200\nGET session:${currentUser.token}` 
                    : `SET session:<uuid> '{"user_id": "...", "role": "admin"}' EX 7200\nDEL session:<uuid>  # no logout instantâneo`}
                </div>
              </div>
            </div>

            {/* 2. HYPERLOGLOG (HLL) */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                <div className="card-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 600 }}>2. HyperLogLog (Cardinalidade de Usuários)</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Contagem de elementos únicos consumindo apenas ~12 KB de RAM</p>
                </div>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span className="metric-label" style={{ fontSize: '0.75rem' }}>Usuários Únicos Hoje (DAU)</span>
                  <div className="metric-number" style={{ color: '#3b82f6', fontSize: '1.8rem', marginTop: '0.2rem' }}>
                    {redisStats?.hyperloglog?.daily_unique_users_estimate ?? '—'}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Chave: hll:active_users:{redisStats?.hyperloglog?.date || 'hoje'}</span>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span className="metric-label" style={{ fontSize: '0.75rem' }}>Total Histórico Estimado</span>
                  <div className="metric-number" style={{ color: '#818cf8', fontSize: '1.8rem', marginTop: '0.2rem' }}>
                    {redisStats?.hyperloglog?.total_unique_users_estimate ?? '—'}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Erro padrão: ~0.81% (fixo)</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Memória consumida: <strong>~12 KB</strong> (independente de ter 10 ou 10 milhões de usuários)
                </span>
                <button 
                  onClick={simulateHllTraffic} 
                  className="btn btn-outline" 
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                  disabled={simTrafficLoading}
                >
                  <Plus size={13} />
                  Simular 10 Novos Usuários (PFADD)
                </button>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong>Comandos executados no Redis:</strong>
                <div className="code-box" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                  PFADD hll:active_users:2026-11-17 user_123 user_456{'\n'}
                  PFCOUNT hll:active_users:2026-11-17  # Retorna: {redisStats?.hyperloglog?.daily_unique_users_estimate ?? 1}
                </div>
              </div>
            </div>

            {/* 3. COUNT-MIN SKETCH (CMS) */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                <div className="card-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                  <Activity size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 600 }}>3. Count-Min Sketch (Frequência de Requisições)</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Contador de alta frequência sem subestimar (Heavy Hitters)</p>
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Cada chamada aos endpoints da API é registrada automaticamente no Count-Min Sketch via middleware HTTP:
              </p>

              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: '0.75rem' }}>
                {redisStats?.count_min_sketch?.routes?.length > 0 ? (
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: '0.75rem' }}>Endpoint / Rota</th>
                        <th style={{ fontSize: '0.75rem', textAlign: 'right' }}>Hits Estimados (CMS)</th>
                        <th style={{ fontSize: '0.75rem', textAlign: 'right' }}>Ação Rápida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redisStats.count_min_sketch.routes.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#fff' }}>
                            {r.route}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: '0.85rem' }}>
                            {r.estimated_hits}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              onClick={() => simulateCmsTraffic(r.route)} 
                              className="btn btn-outline" 
                              style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}
                              title="Dispara 5 requisições para este endpoint"
                            >
                              +5 Hits
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                    Nenhuma rota registrada ainda no Count-Min Sketch.
                  </div>
                )}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong>Comandos executados no Redis:</strong>
                <div className="code-box" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                  CMS.INCRBY cms:route_stats /records 1{'\n'}
                  CMS.QUERY cms:route_stats /records /sources
                </div>
              </div>
            </div>

            {/* 4. BLOOM FILTER (BF) */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                <div className="card-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', color: '#fff', fontWeight: 600 }}>4. Bloom Filter (Filtro de Existência de Registros)</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Idempotência ultra-rápida em O(1): zero falsos negativos</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  value={bfInput} 
                  onChange={e => setBfInput(e.target.value)}
                  placeholder="Ex: evt_12345, order_1001..."
                  style={{ flex: 1, fontSize: '0.85rem' }}
                />
                <button 
                  onClick={() => checkBloomFilter(bfInput)} 
                  className="btn btn-primary" 
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', background: '#a855f7' }}
                  disabled={bfLoading || !bfInput}
                >
                  <Search size={14} />
                  Checar no BF
                </button>
                <button 
                  onClick={() => addToBloomFilter(bfInput)} 
                  className="btn btn-outline" 
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', borderColor: '#a855f7', color: '#c084fc' }}
                  disabled={bfLoading || !bfInput}
                >
                  <Plus size={14} />
                  Inserir no BF
                </button>
              </div>

              {bfNotice && (
                <div style={{ padding: '0.45rem 0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                  {bfNotice}
                </div>
              )}

              {bfResult && (
                <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>ID Consultado:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontSize: '0.85rem' }}>{bfResult.external_id}</strong>
                    {bfResult.exists_in_bloom_filter ? (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                        Pode Existir (Provável Positivo)
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                        Com Certeza NÃO Existe (Zero Falso Negativo)
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    {bfResult.propriedade || bfResult.conclusao}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                <span>Capacidade: <strong>{redisStats?.bloom_filter?.capacity ?? 50000}</strong></span>
                <span>Itens Inseridos: <strong>{redisStats?.bloom_filter?.items_inserted ?? 0}</strong></span>
                <span>Taxa de Erro: <strong>1.0%</strong></span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong>Comandos executados no Redis:</strong>
                <div className="code-box" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                  BF.EXISTS bf:seen_external_ids {bfInput || 'evt_12345'}{'\n'}
                  BF.ADD bf:seen_external_ids {bfInput || 'evt_12345'}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE LOGIN (DEMO) */}
      {/* ========================================================= */}
      {loginModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 440, width: '90%', padding: '1.75rem', position: 'relative' }}>
            <button 
              onClick={() => setLoginModalOpen(false)} 
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div className="card-icon-wrap" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
                <Key size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#fff' }}>Login & Sessão no Redis</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Gera um token com TTL armazenado em memória</p>
              </div>
            </div>

            {loginError && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                {loginError}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Escolha um usuário demonstrativo para entrar:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {demoUsers.map(u => (
                  <button 
                    key={u.username}
                    onClick={() => handleLogin(u.username, '123')}
                    className="btn btn-outline"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem' }}
                    disabled={loginLoading}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{u.name}</strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </div>
                    <span className="badge" style={{ background: u.role === 'admin' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(99, 102, 241, 0.15)', color: u.role === 'admin' ? '#f43f5e' : '#818cf8' }}>
                      {u.role.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.35rem' }}>
                Ou informe credenciais personalizadas (senha padrão: <code>123</code>):
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Usuário" 
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                />
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="Senha" 
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  style={{ width: 90, fontSize: '0.85rem' }}
                />
                <button 
                  onClick={() => handleLogin(loginUsername, loginPassword)}
                  className="btn btn-primary"
                  style={{ background: '#f43f5e' }}
                  disabled={loginLoading}
                >
                  Entrar
                </button>
              </div>
            </div>

          </div>
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
              {record.score !== undefined && (
                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                  Score: {Number(record.score).toFixed(2)}
                </span>
              )}
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
