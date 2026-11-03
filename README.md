# 🔗 Integration Hub: Hub de Integração e Consulta de Dados

Trabalho de **Banco de Dados NoSQL** (UFU).
Augusto Naves Fernandes · Pedro Henrique Oliveira Santos

Sistema que **recebe dados de diferentes APIs** (Stripe, RH, ERP, CRM...), guarda o
**payload original** numa estrutura flexível no **MongoDB Atlas** e permite **consultas posteriores**,
sem exigir que todos os sistemas externos usem o mesmo formato.

> **Ponto de defesa:** documentos com estruturas completamente diferentes convivem
> na **mesma coleção** (`api_records`), sem alterar o schema. A inteligência fica na
> consulta, e não na inserção.

![Proposta](docs/img/slide-proposta.png)

---

## 📁 Estrutura do repositório

```
.
├── README.md
├── docs/
│   ├── system-description.md      # Problema, objetivo e funcionalidade principal
│   └── database-architecture.md   # Banco, coleções, índices e comparação com JSONB
├── database/                      # Scripts para o mongosh
│   ├── init.js                    # Cria banco, coleções e índices
│   ├── seed.js                    # Insere fontes e documentos fictícios
│   └── queries.js                 # 12 consultas de demonstração
├── examples/                      # Payloads de exemplo em JSON de cada API
├── frontend/                      # Aplicação Web Moderna (React + Vite + Tailwind/CSS)
│   ├── src/
│   │   ├── App.jsx                # Interface com as 4 abas e chamadas à API
│   │   └── index.css              # Estilos modernos e responsivos
│   └── package.json
├── db.py                          # Conexão com o Atlas (lê o .env)
├── setup_db.py                    # Script Python para criar banco, índices e dados (sem mongosh)
├── main.py                        # API REST FastAPI com suporte a CORS
├── requirements.txt               # Dependências Python do backend
└── .env.example                   # Modelo de configuração das variáveis de ambiente
```

## 🗄️ Banco de dados

| Coleção       | Papel                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| `api_sources` | Catálogo das fontes integradas (Stripe, RH App, CRM, ERP)              |
| `api_records` | **Coleção principal.** Metadados fixos + `payload` com estrutura livre |

Detalhes em [docs/database-architecture.md](docs/database-architecture.md).

---

## 🛠️ Pré-requisitos (O que precisa ter instalado)

Antes de começar, certifique-se de ter instalado na sua máquina:
1. **Python 3.9+** (com `pip` e módulo `venv`)
2. **Node.js 18+ e npm** (necessário para rodar o frontend em React)
3. **Git**
4. **Cluster Gratuito no MongoDB Atlas** (M0)

---

## 🔐 Variáveis de Ambiente (`.env`)

O projeto utiliza um arquivo `.env` na raiz para guardar as credenciais de conexão sem expô-las no GitHub (o `.env` está protegido pelo `.gitignore`).

Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

Abra o arquivo `.env` e configure os valores:

| Variável | Descrição | Exemplo de Valor |
| :--- | :--- | :--- |
| `MONGODB_URI` | Connection string do seu cluster MongoDB Atlas | `mongodb+srv://usuario:senha@cluster0.abcde.mongodb.net/` |
| `MONGODB_DB` | Nome do banco de dados | `integration_hub` |
| `API_URL` | URL base da API FastAPI | `http://localhost:8000` |

> 💡 **Como pegar a `MONGODB_URI` no MongoDB Atlas:**
> 1. No painel do Atlas, clique em **Database** ➔ **Connect**.
> 2. Escolha **Drivers** ➔ Driver **Python** (versão 3.12 ou mais recente).
> 3. Copie a connection string e substitua `<password>` pela sua senha real.
> 4. Em **Network Access**, certifique-se de que o acesso de IP está liberado (`0.0.0.0/0` para testes).

---

## 🚀 Como Executar Passo a Passo

### 1. Clonar o repositório e preparar o ambiente Python
```bash
git clone https://github.com/AugustoNaves/integration-hub.git
cd integration-hub

# Criar e ativar o ambiente virtual Python
python3 -m venv .venv
source .venv/bin/activate    # No Windows: .venv\Scripts\activate

# Instalar dependências do backend
pip install -r requirements.txt

# Configurar as variáveis de ambiente
cp .env.example .env
# (Edite o .env e insira a sua MONGODB_URI)
```

### 2. Criar coleções, índices e popular o banco no MongoDB Atlas

Você pode rodar o script automático em Python (não precisa ter o `mongosh` instalado):
```bash
python setup_db.py --seed
```
*(Opcional: para apagar tudo e recriar do zero a qualquer momento, use `python setup_db.py --reset`).*

> **Se preferir usar o `mongosh` oficial:**
> ```bash
> mongosh "sua_connection_string"
> load("database/init.js")
> load("database/seed.js")
> load("database/queries.js")
> ```

---

### 3. Iniciar o Backend (API FastAPI)

Com o terminal na raiz do projeto e o `.venv` ativado:
```bash
uvicorn main:app --reload --port 8000
```
* **Status da API:** http://localhost:8000/
* **Swagger/Documentação Interativa dos Endpoints:** http://localhost:8000/docs

---

### 4. Iniciar o Frontend (React + Vite)

Abra um **segundo terminal** para iniciar a interface visual em React:
```bash
cd frontend
npm install
npm run dev
```
* Acesse no navegador: 👉 **http://localhost:5173**

---

## 🔌 Endpoints da API

| Método | Rota                                  | Descrição                                        |
| ------ | ------------------------------------- | ------------------------------------------------ |
| GET    | `/`                                   | Saúde da API e conexão com o MongoDB             |
| GET    | `/sources`                            | Lista as fontes cadastradas                      |
| POST   | `/sources`                            | Cadastra uma nova fonte                          |
| PATCH  | `/sources/{id}?active=false`          | Ativa/desativa uma fonte                         |
| GET    | `/sources/{id}/fields`                | Descobre os campos que a fonte envia no payload  |
| POST   | `/records/{source_id}`                | **Recebe um payload de qualquer formato**        |
| GET    | `/records?source_id=stripe`           | Lista os documentos brutos                       |
| GET    | `/records/{id}/filter?field=status&value=paid` | Filtra por campo interno do payload     |
| GET    | `/records/{id}/extract?fields=customer&fields=amount` | **Query Mágica** (payload → colunas) |
| GET    | `/stats`                              | Registros por fonte (`$group` + `$lookup`)       |

Exemplo de recebimento:
```bash
curl -X POST http://localhost:8000/records/stripe \
  -H "Content-Type: application/json" \
  -d '{"external_id": "evt_999", "payload": {"customer": "Ana", "amount": 99.9, "status": "paid"}}'
```

---

## 🎤 Roteiro da demonstração

1. **Visão geral** → mostrar as fontes em `api_sources` e a contagem por fonte.
2. **Documentos brutos** → abrir um registro da Stripe e um do ERP: formatos diferentes, mesma coleção.
3. **Simular API** → enviar um payload novo, ou até inventar campos novos: o banco aceita sem migração.
4. Reenviar o **mesmo `external_id`** → o índice único parcial bloqueia a duplicata (HTTP 409).
5. **Cadastrar nova fonte** na barra lateral → enviar dados dela sem criar coleção nova.
6. **Query Mágica** → escolher campos e ver o payload virar tabela, com o pipeline exibido.

## 🧭 Fora do escopo (evolução futura)
Conexão automática com APIs reais (webhooks), autenticação das integrações,
sincronização automática e validação de schema por fonte (`$jsonSchema`).
