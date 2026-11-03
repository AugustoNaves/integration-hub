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

## 🛠️ Pré-requisitos (O que você precisa ter instalado)

Para rodar o projeto na sua máquina, você só precisa de:
1. **Python 3.9+** (com `pip` e módulo `venv`)
2. **Node.js 18+ e npm** (para a interface web em React)
3. **Git**

> 🌐 **Você NÃO precisa criar conta no MongoDB Atlas:** o banco de dados já está hospedado e ativo na nuvem, com as coleções criadas, índices configurados e documentos de demonstração já povoados. O acesso de rede (`Network Access`) já está liberado para conexões externas (`0.0.0.0/0`).

---

## 🔐 Variáveis de Ambiente (`.env`)

O projeto já traz o modelo no `.env.example` apontando diretamente para o cluster do projeto na nuvem.

Basta copiar o arquivo de exemplo para `.env`:
```bash
cp .env.example .env
```

O arquivo `.env` ficará configurado assim:

```env
# Cluster oficial do projeto (MongoDB Atlas)
MONGODB_URI=mongodb+srv://augustonf05_db_user:<SENHA>@cluster0.hxa84ms.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=integration_hub

# URL da API
API_URL=http://localhost:8000
```

> 🔑 **Senha do banco:** substitua `<SENHA>` pela senha do banco de dados informada na entrega da disciplina (ou na documentação privada do grupo).

---

## 🚀 Como Executar Passo a Passo

Como o banco no MongoDB Atlas já está pronto e populado, basta rodar o backend e o frontend:

### 1. Clonar o repositório e configurar o ambiente Python
```bash
git clone https://github.com/AugustoNaves/integration-hub.git
cd integration-hub

# Criar e ativar o ambiente virtual Python
python3 -m venv .venv
source .venv/bin/activate    # No Windows: .venv\Scripts\activate

# Instalar dependências da API
pip install -r requirements.txt

# Configurar o arquivo .env
cp .env.example .env
# (Edite o .env e preencha a <SENHA> do cluster fornecida na entrega)
```

> *(Opcional)*: Se quiser resetar ou recriar os dados de demonstração no banco a qualquer momento, basta rodar:
> ```bash
> python setup_db.py --seed
> ```

---

### 2. Iniciar a API (Backend FastAPI)

Com o terminal na raiz do projeto e o `.venv` ativado:
```bash
uvicorn main:app --reload --port 8000
```
* **Status da API:** http://localhost:8000/
* **Swagger/Documentação Interativa dos Endpoints:** http://localhost:8000/docs

---

### 3. Iniciar o Frontend (React + Vite)

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
