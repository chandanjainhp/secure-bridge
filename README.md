<div align="center">

# 🔐 Secure Bridge

**Encrypted AI messaging with Bring Your Own Key (BYOK), MCP integrations, and Fully Homomorphic Encryption (FHE) via WebAssembly.**



</div>

---

## 📖 Overview

Secure Bridge is a hybrid web application that provides an encrypted messaging and chat environment. The backend manages third-party LLM API keys through a secure **Bring Your Own Key (BYOK)** model, tracks API usage, supports **Model Context Protocol (MCP)** integrations, and uses **Fully Homomorphic Encryption (FHE)** with OpenFHE compiled to WebAssembly for confidential data processing.

### Components

| # | Component | Location | Stack |
|---|-----------|----------|-------|
| 1 | **Frontend** | `client/` | React + Vite, Tailwind CSS, shadcn/ui, React Query |
| 2 | **Backend API** | `server/` | Node.js + Express, MongoDB, Redis, JWT |
| 3 | **FHE / WASM build** | `server/emsdk/`, `server/fhe/` | C++ OpenFHE, Emscripten |
| 4 | **MCP Server** | `server/mcp-server/` | FastMCP (Python), streamable-HTTP transport |

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Environment Configuration](#-environment-configuration)
- [Homomorphic Encryption (FHE)](#-homomorphic-encryption-fhe)
- [Model Context Protocol (MCP)](#-model-context-protocol-mcp)
- [Chat Encryption](#-chat-encryption)
- [Testing & Code Quality](#-testing--code-quality)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔑 **Authentication** | JWT-based sessions with optional OTP verification sent via Gmail SMTP. |
| 🗂️ **Project Workspaces** | Organization-level workspaces with separate system prompts, settings, and conversation history. |
| 🛡️ **BYOK Key Caching** | Third-party keys (OpenAI, Anthropic, Gemini, Azure) encrypted at rest with AES-256-GCM. Plaintext keys are never exposed in responses or logs. |
| 📊 **Usage Tracking** | Free tiers with strict limits enforced by middleware; usage cached in MongoDB/Redis. |
| 🧮 **Experimental OpenFHE** | BFV-scheme FHE via C++ wrappers compiled to WebAssembly, with a JavaScript `FHEStub.js` fallback in mock mode. |
| 🔌 **MCP Integration** | AI models can use context tools (external calls, diagnostics) through a dedicated FastMCP Python server. |
| 💬 **Chat Encryption** | End-to-end AES-256-GCM message encryption, plus optional FHE-based homomorphic scoring for context selection. |

---

## 🗺️ Project Structure

Secure Bridge combines a layered architecture with domain-specific feature folders (`client/src/features`, `server/src/features`) to isolate the core BYOK and usage features.

```text
Secure-Bridge/
├── client/                     # Frontend (React + Vite)
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── app/                # Global config (store, router, ErrorBoundary)
│   │   ├── features/           # Modular features
│   │   │   ├── api-key/        #   BYOK management
│   │   │   ├── auth/           #   Login, registration, OTP
│   │   │   ├── chat/           #   Conversational interface
│   │   │   ├── layout/         #   Sidebars & panels
│   │   │   ├── profile/        #   User profile settings
│   │   │   ├── projects/       #   Workspaces / Projects CRUD
│   │   │   └── usage/          #   Usage graphs & limits
│   │   ├── pages/              # Route-level page views
│   │   ├── shared/             # Global components, hooks, API client
│   │   └── test/               # UI test suites
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                     # Backend API (Express.js)
│   ├── src/
│   │   ├── config/             # Redis & other connection configs
│   │   ├── controllers/        # General controllers
│   │   ├── db/                 # Mongoose initialization & connection
│   │   ├── email/              # Templates & transport setup
│   │   ├── features/           # Feature logic (api-key, chat, usage)
│   │   ├── middlewares/        # Security headers, auth, validation
│   │   ├── models/             # Mongoose models (User, Project, apikey)
│   │   ├── routes/             # Users, Auth, Project, apiKey routes
│   │   ├── services/           # Encryption, FHE stub, OpenFHE, MCP client
│   │   ├── tests/              # Jest integration/unit tests
│   │   ├── utils/              # ApiError, asyncHandler, helpers
│   │   └── validation/         # Request validation rules
│   ├── mcp-server/             # FastMCP Python server (context tools)
│   │   ├── src/
│   │   │   ├── tools/          #   fetch_url, search_project_context
│   │   │   └── tests/          #   Unit & integration tests
│   │   └── README.md
│   ├── emsdk/                  # Emscripten toolchain (WASM builds)
│   ├── fhe/                    # Compiled FHE binaries & scripts
│   ├── fhe-wasm/               # Compiled FHE WASM artifacts
│   ├── openfhe-development/    # C++ OpenFHE source
│   └── package.json
│
├── scripts/
│   ├── db-up.sh                # Start MongoDB container
│   └── db-down.sh              # Tear down databases
├── docker-compose.yml          # MongoDB & Redis containers
└── README.md
```

---

## 🧰 Prerequisites

| Tool | Version | Used for |
|------|---------|----------|
| **Node.js** | `20.x` or later | Backend and tooling |
| **Bun** | `1.3.x` or later | Client dependencies and Vite tooling |
| **Docker & Docker Compose** | Latest | Local database services |
| **Python** | `3.10+` | MCP server (FastMCP) |
| **pip** | Latest | Installing MCP server dependencies |

---

## 🚀 Quick Start

### 1. Start database services

```bash
docker compose up -d mongodb redis
```

> [!NOTE]
> Redis is mapped to host port **`6380`** (container port `6379`) to avoid conflicts with native Redis instances.

Verify MongoDB status:

```bash
./scripts/db-up.sh
```

<details>
<summary><b>Optional: Mongo Express dashboard</b></summary>

```bash
docker compose --profile tools up -d mongo-express
```

Then open <http://localhost:8081> to browse database collections.

</details>

### 2. Start the backend

```bash
cd server
npm install
npm run db:seed   # optional: seed default collections
npm run dev
```

The API runs at <http://localhost:8000>.

### 3. Start the frontend

```bash
cd client
npm install
npm run dev
```

The app opens at <http://localhost:5173>.

### 4. Shut down services

```bash
./scripts/db-down.sh
```

---

## ⚙️ Environment Configuration

Configure environment variables before starting the services.

### Backend — `server/.env`

Create the file using `server/.env.docker` or `server/.env.example` as a template.

```env
# ── Server ──────────────────────────────────────────────
PORT=8000
NODE_ENV=development
MONGODB_URI=mongodb://admin:admin123@localhost:27017/Secure-Bridge?authSource=admin
CORS_ORIGIN=http://localhost:5173

# ── JWT ─────────────────────────────────────────────────
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
JWT_REFRESH_EXPIRES_IN=7d

# ── Cryptography ────────────────────────────────────────
ENCRYPTION_KEY=replace-with-a-base64-encoded-32-byte-key
API_KEY_ENCRYPTION_SECRET=your_api_key_encryption_secret_here

# ── Redis ───────────────────────────────────────────────
REDIS_URL=redis://localhost:6380

# ── Email (Nodemailer / Gmail SMTP) ─────────────────────
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-smtp-password

# ── FHE ─────────────────────────────────────────────────
ENCRYPTION_MODE=mock
FHE_WASM_PATH=
FHE_JS_PATH=

# ── MCP (Model Context Protocol) ────────────────────────
ENABLE_MCP=false
OUTBOUND_ALLOWLIST=
MCP_TRANSPORT=streamable-http
MCP_SERVER_HOST=127.0.0.1
MCP_SERVER_PORT=8787
MCP_SERVER_URL=http://127.0.0.1:8787/mcp
EXPRESS_API_BASE_URL=http://127.0.0.1:8000
MCP_SERVICE_TOKEN=change-me-to-a-long-random-hex
```

> [!IMPORTANT]
> Never commit real secrets. Replace every placeholder value and keep `.env` files out of version control.

**`ENCRYPTION_MODE` values**

| Mode | Behavior |
|------|----------|
| `mock` | Uses `FHEStub.js` (AES-256-GCM stub). Always starts. |
| `fhe` | Uses real OpenFHE WASM (BFV scheme), with automatic stub fallback if the WASM module cannot load. |

> [!NOTE]
> When `ENABLE_MCP=true`, make sure the MCP server is running and `OUTBOUND_ALLOWLIST` lists the allowed hostnames. An empty allowlist denies all outbound requests (fail-closed).

### Frontend — `client/.env`

```env
VITE_API_URL=http://localhost:8000/api/v1
```

---

## 🧮 Homomorphic Encryption (FHE)

Secure Bridge supports real OpenFHE-based homomorphic encryption through WebAssembly when `ENCRYPTION_MODE=fhe`.

### OpenFHE Service

**File:** `server/src/services/OpenFheService.js`

| Property | Value |
|----------|-------|
| **Scheme** | BFV (Brakerski/Fan-Vercauteren) |
| **Ring dimension** | 8192 (supports chat-message-sized inputs) |
| **Data handling** | UTF-8 bytes packed into BFV slots, with AES-256-GCM at-rest encryption |
| **Operations** | Homomorphic addition, multiplication, and rotation-based scoring |

### FHE Chat Service

**File:** `server/src/services/fheChat.js`

Provides homomorphic scoring for chat context selection. Messages are encrypted and scored without decrypting their content.

### Rebuilding the WASM artifacts

To recompile the C++ OpenFHE source into browser-ready WebAssembly and JavaScript wrappers:

1. Set up the Emscripten compiler environment in `server/emsdk/`.
2. Go to `server/openfhe-development/` and run the build recipe (requires `cmake` and the toolchain).
3. The build outputs JS glue code and WASM files (e.g. `openfhe_pke_es6.js`, `openfhe_pke_es6.wasm`) into `server/fhe/` and `server/fhe-wasm/`.
4. Update `FHE_WASM_PATH` and `FHE_JS_PATH` in `server/.env` to point to the new files.

> [!TIP]
> In mock mode (`ENCRYPTION_MODE=mock`), the backend falls back to `server/src/services/FHEStub.js` without failing startup.

---

## 🔌 Model Context Protocol (MCP)

Secure Bridge includes a dedicated MCP server (`server/mcp-server/`) built with **FastMCP (Python)** that gives AI models context-aware tools. It communicates with the Express backend over streamable-HTTP transport.

### Available tools

| Tool | Description |
|------|-------------|
| `fetch_url(url)` | Fetches content from allowlisted URLs and returns cleaned text. Rejects non-allowlisted hosts. |
| `search_project_context(project_id, query)` | Searches project context by calling back into the Express API (`/api/v1/projects/:id/context`). |

### Setup

**1. Install dependencies**

```bash
cd server/mcp-server
pip install -e ".[dev]"
```

**2. Run the server** (choose one)

<details open>
<summary><b>Option A — stdio (local development)</b></summary>

```bash
ENABLE_MCP=true \
OUTBOUND_ALLOWLIST=api.example.com,localhost \
MCP_TRANSPORT=stdio \
python -m server
```

</details>

<details open>
<summary><b>Option B — streamable-HTTP (sidecar)</b></summary>

```bash
ENABLE_MCP=true \
OUTBOUND_ALLOWLIST=api.example.com,localhost,127.0.0.1 \
MCP_TRANSPORT=streamable-http \
MCP_SERVER_PORT=8787 \
python -m server
```

</details>

The Express backend connects to `http://127.0.0.1:8787/mcp` when `ENABLE_MCP=true`.

### Configuration reference

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_MCP` | `false` | Master switch for MCP features |
| `OUTBOUND_ALLOWLIST` | _(empty)_ | Comma-separated hostnames. Empty = deny all (fail-closed) |
| `MCP_TRANSPORT` | `stdio` | `stdio` for local dev, `streamable-http` for sidecar |
| `MCP_SERVER_HOST` | `127.0.0.1` | HTTP transport bind host |
| `MCP_SERVER_PORT` | `8787` | HTTP transport bind port |
| `MCP_SERVER_URL` | `http://127.0.0.1:8787/mcp` | Full MCP server URL |
| `EXPRESS_API_BASE_URL` | `http://127.0.0.1:8000` | Express API base URL for callback tools |
| `MCP_SERVICE_TOKEN` | _(required)_ | HMAC secret for user-scoped tool authentication |
| `OUTBOUND_TIMEOUT_SECONDS` | `15` | Per-request HTTP timeout |
| `FETCH_MAX_BYTES` | `1000000` | Maximum response body size |

> [!WARNING]
> **Security model:** the MCP server is fail-closed. If `OUTBOUND_ALLOWLIST` is empty or unset, all outbound requests are denied. Redirects are re-checked hop-by-hop against the allowlist. No API keys, JWTs, or secrets are logged or exposed.

### MCP client (Express backend)

**File:** `server/src/services/mcpClient.js`

- Connects to the MCP server only when `ENABLE_MCP=true`
- Discovers available tools at startup
- Passes tools to LLM calls in the chat service
- Falls back gracefully (chat works without tools) if the MCP server is unreachable
- Verifies HMAC-signed user identities for user-scoped tools

---

## 💬 Chat Encryption

Secure Bridge provides end-to-end encryption for chat messages with multiple encryption backends.

### Services

| Service | File | Purpose |
|---------|------|---------|
| `FHEStub.js` | `server/src/services/FHEStub.js` | Mock FHE implementation (AES-256-GCM) for development |
| `OpenFheService.js` | `server/src/services/OpenFheService.js` | Real OpenFHE WASM-based BFV homomorphic encryption |
| `fheChat.js` | `server/src/services/fheChat.js` | Homomorphic scoring for chat context selection |
| `fheServiceFactory.js` | `server/src/services/fheServiceFactory.js` | Creates the appropriate FHE service based on mode |

### Message flow

```mermaid
flowchart TD
    A[User sends message via frontend] --> B[Backend encrypts with AES-256-GCM<br/>key derived from ENCRYPTION_KEY]
    B --> C{FHE mode enabled?}
    C -- Yes --> D[Apply additional homomorphic encryption]
    C -- No --> E[Store encrypted message in MongoDB]
    D --> E
    E --> F[Homomorphic scoring for context selection<br/>FHE mode only]
    F --> G[Response decrypted and returned to user]
    E -. non-FHE mode .-> G
```

### Modes

| Mode | Behavior |
|------|----------|
| `ENCRYPTION_MODE=mock` _(default)_ | `FHEStub.js` with AES-256-GCM. Always starts; ideal for development and testing. |
| `ENCRYPTION_MODE=fhe` | Real OpenFHE WASM with BFV scheme. Falls back to the stub if WASM cannot load. |

> [!NOTE]
> All API keys are encrypted at rest with AES-256-GCM. Plaintext keys are never exposed in API responses, logs, or client-side code.

---

## 🧪 Testing & Code Quality

Run tests and linters before pushing changes.

| Area | Command | Notes |
|------|---------|-------|
| Backend tests | `cd server && npm test` | Database validation, API mock endpoints, security tests |
| Backend coverage | `cd server && npm run test:coverage` | Coverage stats |
| Frontend lint | `cd client && npm run lint` | Style linting |
| Frontend tests | `cd client && npm test` | Add `npm run test:watch` for watch mode |

<details>
<summary><b>Backend test files</b></summary>

| File | Covers |
|------|--------|
| `apiKey.test.js` | API key encryption and management |
| `chatProviders.test.js` | Chat provider integration |
| `fheChat.test.js` | FHE chat encryption and scoring |
| `fheSelftestRunner.mjs` | FHE self-test runner |
| `localLlm.test.js` | Local LLM integration |
| `mcpClient.test.js` | MCP client integration |
| `security.test.js` | Security validation |

</details>

---

## 🛠️ Troubleshooting

| Problem | What happens / How to fix |
|---------|---------------------------|
| **Redis offline warning** | The backend logs `Failed to connect to Redis` and warns. OTP flows fall back to in-memory storage (codes are lost on server restart). |
| **CORS failures** | Make sure `CORS_ORIGIN` in `server/.env` exactly matches the client URL (e.g. `http://localhost:5173`). |
| **Database connection failures** | Verify `MONGODB_URI` in `server/.env`. For local Docker, use `mongodb://admin:admin123@localhost:27017/Secure-Bridge?authSource=admin`. |
| **MCP server unreachable** | If `ENABLE_MCP=true` but the server is down, the backend logs a warning and continues without MCP tools. Check the server is running and `MCP_SERVER_URL` is correct. |
| **FHE WASM loading errors** | If `ENCRYPTION_MODE=fhe` but WASM files are missing, the backend falls back to `FHEStub.js`. Point `FHE_WASM_PATH` / `FHE_JS_PATH` to valid files or place them in `server/fhe/`. |
| **`OUTBOUND_ALLOWLIST` denials** | If MCP tools reject every URL, check that the allowlist contains valid comma-separated hostnames. An empty list denies everything by design. |
| **HMAC signature failures** | If user-scoped MCP tools fail authentication, confirm `MCP_SERVICE_TOKEN` is set and identical on the MCP server and the Express backend. |
