# Secure Bridge

Secure Bridge is a hybrid web application that provides an encrypted messaging and chat environment. The backend manages third-party LLM API keys via a secure **Bring Your Own Key (BYOK)** model, tracks API usage, supports Model Context Protocol (MCP) integrations, and leverages Fully Homomorphic Encryption (FHE) with OpenFHE compiled to WebAssembly for confidential data processing.

The project consists of:
1. **React + Vite Frontend (`client/`)** using Tailwind CSS, shadcn/ui, and React Query.
2. **Node.js + Express Backend (`server/`)** using MongoDB for primary storage, Redis for OTP caching/rate limiting, and JSON Web Token (JWT) credentials.
3. **C++ OpenFHE & Emscripten Build Setup (`server/emsdk/`, `server/fhe/`)** for compiling homomorphic encryption logic to WASM/JS wrappers.
4. **MCP Server (`server/mcp-server/`)** - A FastMCP Python server that provides context tools for AI models via streamable-HTTP transport.

---

## Table of Contents

- [Project Architecture & Directory Structure](#project-architecture--directory-structure)
- [Key Features](#key-features)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database & Services Setup (Docker)](#database--services-setup-docker)
- [Running the Project Locally](#running-the-project-locally)
  - [Start Backend](#start-backend)
  - [Start Frontend](#start-frontend)
- [Homomorphic Encryption (FHE) WebAssembly Build](#homomorphic-encryption-fhe-webassembly-build)
- [Model Context Protocol (MCP) Features](#model-context-protocol-mcp-features)
  - [MCP Server Setup](#mcp-server-setup)
  - [MCP Configuration](#mcp-configuration)
- [Chat Encryption](#chat-encryption)
- [Testing & Code Quality](#testing--code-quality)
- [Troubleshooting](#troubleshooting)

---

## Project Architecture & Directory Structure

Secure Bridge uses a hybrid structure that combines a traditional layered architecture with domain-specific feature folders (`client/src/features` and `server/src/features`) to isolate core BYOK and usage features:

```
Secure-Bridge/
├── client/                     # Frontend Application (React + Vite)
│   ├── public/                 # Static public assets
│   ├── src/                    # Source Code
│   │   ├── app/                # Global config (store, router, ErrorBoundary)
│   │   ├── features/           # Modular features
│   │   │   ├── api-key/        # BYOK management components
│   │   │   ├── auth/           # Login, registration, & OTP auth state/components
│   │   │   ├── chat/           # Conversational messaging interface
│   │   │   ├── layout/         # Persistent sidebars & panels
│   │   │   ├── profile/        # User profile configuration
│   │   │   ├── projects/       # Workspaces/Projects CRUD
│   │   │   └── usage/          # API usage visual graphs & limits
│   │   ├── pages/              # Page views matching routing paths
│   │   ├── shared/             # Global components, hooks, & API client
│   │   └── test/               # UI components test suites
│   ├── vite.config.js          # Vite build config
│   ├── tailwind.config.js      # Tailwind CSS configuration
│   └── package.json            # Frontend package details
├── server/                     # Backend API Server (Express.js)
│   ├── src/                    # Backend Source Code
│   │   ├── config/             # Connection configurations (Redis, etc.)
│   │   ├── controllers/        # General controller classes
│   │   ├── db/                 # Database initialization and connection (Mongoose)
│   │   ├── email/              # Email templates & transport setups
│   │   ├── features/           # Feature-based backend logic (api-key, chat, usage)
│   │   ├── middlewares/        # Security headers, auth verification, validation
│   │   ├── models/             # Mongoose database models (User, Project, apikey)
│   │   ├── routes/             # App Router registers (Users, Auth, Project, apiKey)
│   │   ├── services/           # Encryption services, FHE Stub, OpenFHE, MCP client
│   │   ├── tests/              # Jest integration/unit test suite
│   │   ├── utils/              # Response/Error helpers (ApiError, asyncHandler)
│   │   └── validation/         # Request input validation rules
│   ├── mcp-server/             # MCP Server (FastMCP Python) - provides context tools
│   │   ├── src/                # MCP server source code
│   │   │   ├── tools/          # MCP tool implementations (fetch_url, search_project_context)
│   │   │   └── tests/          # MCP server unit and integration tests
│   │   └── README.md           # MCP server documentation
│   ├── emsdk/                  # Emscripten toolchain for WebAssembly compiling
│   ├── fhe/                    # Precompiled FHE compiled binaries & scripts
│   ├── fhe-wasm/               # Precompiled FHE WASM artifacts
│   ├── openfhe-development/    # C++ OpenFHE source folder
│   └── package.json            # Backend package details
├── scripts/                    # Script helpers for dev setup
│   ├── db-up.sh                # Script to start MongoDB container
│   └── db-down.sh              # Script to tear down databases
├── docker-compose.yml          # Container configuration for MongoDB & Redis
└── README.md                   # Main Project Documentation
```

---

## Key Features

1. **Authentication**: JWT-based session security with optional One-Time Password (OTP) verification sent via Gmail SMTP.
2. **Project-based Workspaces**: Organization-level workspaces allowing different system prompts, settings, and conversation history.
3. **BYOK API-Key Caching**: Secure caching of third-party keys (OpenAI, Anthropic, Gemini, Azure) encrypted at rest using AES-256-GCM. Plaintext keys are never revealed in responses or logs.
4. **Token & Message Usage Tracking**: Free tiers with strict limits enforced by middleware, caching usage records in MongoDB/Redis.
5. **Experimental OpenFHE Support**: Fully Homomorphic Encryption (FHE) support utilizing C++ wrappers compiled to WebAssembly (fallback to a javascript `FHEStub.js` in mock environment). Supports BFV scheme with configurable encryption modes.
6. **Model Context Protocol (MCP)**: Server integrations allowing AI models to leverage context tools (e.g. executing external calls and system diagnostics). Includes a dedicated FastMCP Python server with tools for URL fetching and project context search.
7. **Chat Encryption**: End-to-end encryption for chat messages with AES-256-GCM, with optional FHE-based homomorphic scoring for context selection.

---

## Prerequisites

- **Node.js**: `20.x` or later recommended
- **Bun**: `1.3.x` or later (used primarily for client dependencies and Vite tooling)
- **Docker & Docker Compose**: Needed to run database services locally
- **Python 3.10+**: Required for MCP Server (FastMCP)
- **pip**: Required to install MCP Server dependencies

---

## Environment Configuration

Configure environmental secrets before executing the services.

### Backend Configurations (`server/.env`)
Create a `.env` file under `server/` (see `server/.env.docker` or `server/.env.example` as a template):
```env
PORT=8000
NODE_ENV=development
MONGODB_URI=mongodb://admin:admin123@localhost:27017/Secure-Bridge?authSource=admin
CORS_ORIGIN=http://localhost:5173

# JWT Credentials
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
JWT_REFRESH_EXPIRES_IN=7d

# Cryptography
ENCRYPTION_KEY=replace-with-a-base64-encoded-32-byte-key
API_KEY_ENCRYPTION_SECRET=your_api_key_encryption_secret_here

# Redis
REDIS_URL=redis://localhost:6380

# Nodemailer SMTP Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-smtp-password

# FHE Configuration
ENCRYPTION_MODE=mock
FHE_WASM_PATH=
FHE_JS_PATH=

# MCP (Model Context Protocol) Configuration
ENABLE_MCP=false
OUTBOUND_ALLOWLIST=
MCP_TRANSPORT=streamable-http
MCP_SERVER_HOST=127.0.0.1
MCP_SERVER_PORT=8787
MCP_SERVER_URL=http://127.0.0.1:8787/mcp
EXPRESS_API_BASE_URL=http://127.0.0.1:8000
MCP_SERVICE_TOKEN=change-me-to-a-long-random-hex
```

> **Note on ENCRYPTION_MODE**: 
> - `mock`: Uses FHEStub.js (AES-256-GCM stub, always starts)
> - `fhe`: Uses real OpenFHE WASM (BFV scheme) with automatic stub fallback if WASM module cannot load

> **Note on MCP**: When `ENABLE_MCP=true`, ensure the MCP server is running and `OUTBOUND_ALLOWLIST` is configured with allowed hostnames. Empty allowlist denies all outbound requests (fail-closed).

### Frontend Configurations (`client/.env`)
Create a `.env` file under `client/`:
```env
VITE_API_URL=http://localhost:8000/api/v1
```

---

## Database & Services Setup (Docker)

We run database components inside isolated Docker containers.

1. **Start Services**:
   Start MongoDB and Redis in the background:
   ```bash
   docker compose up -d mongodb redis
   ```
   *Note: Redis is mapped to host port `6380` (container port `6379`) to avoid conflicts with native instances.*

2. **Verify Database Status**:
   You can verify MongoDB status using the convenience shell script:
   ```bash
   ./scripts/db-up.sh
   ```

3. **Optional Database Dashboard (Mongo Express)**:
   Launch the Mongo-Express visual interface:
   ```bash
   docker compose --profile tools up -d mongo-express
   ```
   Open http://localhost:8081 inside your browser to view the database collections.

4. **Shutdown Services**:
   ```bash
   ./scripts/db-down.sh
   ```

---

## Running the Project Locally

With database services running, boot up the local Node server and Vite client.

### Start Backend

1. Navigate to the server folder and install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Seed default DB collections (Optional):
   ```bash
   npm run db:seed
   ```

3. Boot the Express API Server in development mode:
   ```bash
   npm run dev
   ```
   The backend server will run on http://localhost:8000.

### Start Frontend

1. Navigate to the client folder and install dependencies:
   ```bash
   cd ../client
   npm install
   ```

2. Boot the Vite development server:
   ```bash
   npm run dev
   ```
   Open the client interface in your browser at http://localhost:5173.

---

## Homomorphic Encryption (FHE) WebAssembly Build

Secure Bridge supports real OpenFHE-based homomorphic encryption via WebAssembly when `ENCRYPTION_MODE=fhe`. The implementation uses BFV scheme with ring dimension 8192, supporting batch operations over encrypted data.

### OpenFHE Service (`server/src/services/OpenFheService.js`)
- **Scheme**: BFV (Brakerski/Fan-Vercauteren)
- **Ring Dimension**: 8192 (supports chat-message-sized inputs)
- **Security**: All text is UTF-8 byte-packed into BFV slots with AES-256-GCM at-rest encryption
- **Operations**: Homomorphic addition, multiplication, and rotation-based scoring

If you need to re-compile the C++ OpenFHE source into browser-ready WebAssembly and Javascript wrappers:

1. Setup the Emscripten Compiler Environment inside `server/emsdk/`.
2. Navigate to `server/openfhe-development/` and trigger the compiling recipe (requires `cmake` and toolchain setup).
3. The build output will output Javascript glue-code and WASM files (e.g. `openfhe_pke_es6.js` and `openfhe_pke_es6.wasm`) into `server/fhe/` and `server/fhe-wasm/`.
4. Update the server env var paths (`FHE_WASM_PATH`, `FHE_JS_PATH`) to point to these newly compiled WASM configurations.

*Note: In mock environment modes (`ENCRYPTION_MODE=mock`), the backend routes fallback gracefully to `server/src/services/FHEStub.js` without failing application startup.*

### FHE Chat Service (`server/src/services/fheChat.js`)
Provides homomorphic scoring for chat context selection. Messages are encrypted and scored homomorphically without decrypting the content.

---

## Model Context Protocol (MCP) Features

Secure Bridge includes a dedicated MCP Server (`server/mcp-server/`) built with FastMCP (Python) that provides context-aware tools for AI models. The server communicates with the Express backend via streamable-HTTP transport.

### Available MCP Tools

1. **`fetch_url(url)`** - Fetches content from allowlisted URLs and returns cleaned text. Rejects non-allowlisted hosts.
2. **`search_project_context(project_id, query)`** - Searches project context by calling back into the Express API (`/api/v1/projects/:id/context`).

### MCP Server Setup

1. Navigate to the MCP server directory:
   ```bash
   cd server/mcp-server
   ```

2. Install Python dependencies:
   ```bash
   pip install -e ".[dev]"
   ```

3. Start the MCP server (stdio transport for local dev):
   ```bash
   ENABLE_MCP=true \
   OUTBOUND_ALLOWLIST=api.example.com,localhost \
   MCP_TRANSPORT=stdio \
   python -m server
   ```

4. Or start as a sidecar (streamable-HTTP transport):
   ```bash
   ENABLE_MCP=true \
   OUTBOUND_ALLOWLIST=api.example.com,localhost,127.0.0.1 \
   MCP_TRANSPORT=streamable-http \
   MCP_SERVER_PORT=8787 \
   python -m server
   ```

The Express backend will connect to `http://127.0.0.1:8787/mcp` when `ENABLE_MCP=true`.

### MCP Configuration

| Variable | Default | Description |
|---|---|---|
| `ENABLE_MCP` | `false` | Master switch for MCP features |
| `OUTBOUND_ALLOWLIST` | _(empty)_ | Comma-separated hostnames. Empty = deny all (fail-closed) |
| `MCP_TRANSPORT` | `stdio` | `stdio` for local dev, `streamable-http` for sidecar |
| `MCP_SERVER_HOST` | `127.0.0.1` | HTTP transport bind host |
| `MCP_SERVER_PORT` | `8787` | HTTP transport bind port |
| `MCP_SERVER_URL` | `http://127.0.0.1:8787/mcp` | Full MCP server URL |
| `EXPRESS_API_BASE_URL` | `http://127.0.0.1:8000` | Express API base URL for callback tools |
| `MCP_SERVICE_TOKEN` | _(required)_ | HMAC secret for user-scoped tool authentication |
| `OUTBOUND_TIMEOUT_SECONDS` | `15` | Per-request HTTP timeout |
| `FETCH_MAX_BYTES` | `1000000` | Max response body size |

> **Security Note**: The MCP server enforces a fail-closed security model. If `OUTBOUND_ALLOWLIST` is empty or unset, all outbound requests are denied. Redirects are re-checked hop-by-hop against the allowlist. No API keys, JWT tokens, or secrets are logged or exposed by the MCP server.

### MCP Client Integration

The Express backend includes an MCP client (`server/src/services/mcpClient.js`) that:
- Connects to the MCP server only when `ENABLE_MCP=true`
- Discovers available tools at startup
- Passes tools to LLM calls in the chat service
- Falls back gracefully (chat works without tools) if MCP server is unreachable
- Verifies HMAC-signed user identities for user-scoped tools

---

## Chat Encryption

Secure Bridge provides end-to-end encryption for chat messages with multiple encryption backends:

### Encryption Services

| Service | File | Purpose |
|---------|------|---------|
| `FHEStub.js` | `server/src/services/FHEStub.js` | Mock FHE implementation (AES-256-GCM) for development |
| `OpenFheService.js` | `server/src/services/OpenFheService.js` | Real OpenFHE WASM-based BFV homomorphic encryption |
| `fheChat.js` | `server/src/services/fheChat.js` | Homomorphic scoring for chat context selection |
| `fheServiceFactory.js` | `server/src/services/fheServiceFactory.js` | Factory to create appropriate FHE service based on mode |

### Encryption Modes

- **`ENCRYPTION_MODE=mock`** (default): Uses `FHEStub.js` with AES-256-GCM encryption. Always starts, suitable for development and testing.
- **`ENCRYPTION_MODE=fhe`**: Uses real OpenFHE WASM with BFV scheme. Falls back to stub if WASM cannot load.

### Chat Message Flow

1. User sends message via frontend
2. Backend encrypts message with AES-256-GCM (key derived from `ENCRYPTION_KEY`)
3. If FHE mode is enabled, additional homomorphic encryption is applied
4. Message is stored in MongoDB in encrypted form
5. For context selection, homomorphic scoring is used (FHE mode only)
6. Response is decrypted and returned to user

> **Security Note**: All API keys are encrypted at rest with AES-256-GCM. Plaintext keys are never exposed in API responses, logs, or client-side code.

---

## Testing & Code Quality

Run tests and style linters to verify your modifications before pushing commits.

- **Backend Jest Tests**:
  Runs database validation, API mock endpoints, and security tests:
  ```bash
  cd server
  npm test
  ```
  Or get coverage stats:
  ```bash
  npm run test:coverage
  ```

  New test files added:
  - `apiKey.test.js` - API key encryption and management tests
  - `chatProviders.test.js` - Chat provider integration tests
  - `fheChat.test.js` - FHE chat encryption and scoring tests
  - `fheSelftestRunner.mjs` - FHE self-test runner
  - `localLlm.test.js` - Local LLM integration tests
  - `mcpClient.test.js` - MCP client integration tests
  - `security.test.js` - Security validation tests

- **Frontend Linting**:
  ```bash
  cd client
  npm run lint
  ```

- **Frontend Tests**:
  ```bash
  cd client
  npm test
  ```
  or in watch mode:
  ```bash
  npm run test:watch
  ```

---

## Troubleshooting

- **Redis Offline Warning**:
  If Redis fails to load or connect, the backend logs `Failed to connect to Redis` and logs a warning. **OTP flows will fallback automatically to local memory storage** (temporary codes will clear if the server restarts).
- **CORS Failures**:
  Ensure the `CORS_ORIGIN` variable inside `server/.env` exactly matches the local client URL (e.g. `http://localhost:5173`).
- **Database Connection Failures**:
  Verify the MongoDB URI in `server/.env`. For local docker setups, keep `MONGODB_URI=mongodb://admin:admin123@localhost:27017/Secure-Bridge?authSource=admin`.
- **MCP Server Connection Issues**:
  If `ENABLE_MCP=true` but the MCP server is unreachable, the backend will log a warning and continue without MCP tools. Chat functionality still works. Verify the MCP server is running and `MCP_SERVER_URL` is correct.
- **FHE WASM Loading Errors**:
  If `ENCRYPTION_MODE=fhe` but WASM files are missing, the backend automatically falls back to `FHEStub.js`. Ensure `FHE_WASM_PATH` and `FHE_JS_PATH` point to valid locations or place WASM files in `server/fhe/`.
- **OUTBOUND_ALLOWLIST Denials**:
  If MCP tools are rejecting all URLs, check that `OUTBOUND_ALLOWLIST` contains valid hostnames (comma-separated). Empty allowlist denies all requests by design (fail-closed security).
- **HMAC Signature Failures**:
  If user-scoped MCP tools are failing authentication, verify that `MCP_SERVICE_TOKEN` is set and matches between the MCP server and Express backend.
