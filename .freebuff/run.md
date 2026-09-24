# Run doc — Secure Bridge (thread preview)

Dev servers for the Secure Bridge app (React/Vite client + Express backend + Docker Mongo/Redis).

## 1. Reproduce artifacts (fresh checkout)

1. **Databases** — start Mongo (host port 27017) and Redis (host port 6380) from the repo root:
   ```bash
   docker compose up -d mongodb redis
   ```
2. **Dependencies** — install in both packages (repo has both `server/package-lock`-era npm usage and `client/bun.lock`; npm works for both):
   ```bash
   (cd server && npm install)
   (cd client && npm install)
   ```
3. **Backend env** — ensure `server/.env` exists (template: `server/.env.example`). Key values it must contain: `PORT=8000`, `MONGODB_URI` pointing at `localhost:27017`, `REDIS_URL=redis://localhost:6380`, `JWT_SECRET`, `ENCRYPTION_KEY`. Copy from the main checkout if present; never commit real secrets.
4. **Frontend env** — ensure `client/.env` exists with `VITE_API_URL=http://localhost:8000/api/v1`.

## 2. Run the servers

**Gotcha:** the user's shell exports `PORT=0`, which overrides `server/.env` and makes the backend bind a random port. Always unset it.

1. **Backend** (port 8000) — from `server/`:
   ```bash
   { nohup env -u PORT npm run dev > <log> 2>&1 < /dev/null & echo "pid=$!"; disown; }
   ```
   If the process is reaped, relaunch under `setsid`. Ready when the log shows `MongoDB connected` + `Server is running at port: 8000`.
2. **Frontend** (port 5173) — from `client/`:
   ```bash
   { nohup npm run dev > <log> 2>&1 < /dev/null & echo "pid=$!"; disown; }
   ```
   Ready when Vite prints `Local: http://localhost:5173/`.
3. **Verify** — `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` → 200; backend `http://localhost:8000/` → 200 (API 404s on unknown routes are fine; `POST /api/v1/auth/login` with `{}` returns a structured 400 validation error).

## 3. MCP server (port 8787) — optional, for chat tool calling

Python FastMCP server (`server/mcp-server/`) that the backend connects to over streamable-HTTP. Enable with `ENABLE_MCP=true` in `server/.env`.

1. **Python deps** (uv, once):
   ```bash
   (cd server/mcp-server && uv sync)
   ```
2. **Run** — from repo root (setsid so it survives the command runner):
   ```bash
   cd server/mcp-server && eval "$(python3 -c "import re,shlex; env=dict(re.findall(r'(?m)^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', open('../.env').read())); print(' '.join(f'{k}={shlex.quote(v)}' for k,v in env.items()))")" setsid nohup uv run python -m src.server > /tmp/secure-bridge-mcp.log 2>&1 < /dev/null & sleep 3; echo launched
   ```
   (`.env` values must be passed via `env`, not `source` — some values contain spaces.)
3. **Verify** — port listening: `ss -tln | grep 8787`; tool discovery: `curl -s http://localhost:8000/api/v1/chat/tools -H "Authorization: Bearer <jwt>"` → `enabled:true` with `fetch_url` + `search_project_context`.

**E2E tool-call test** (LM Studio on :1234 with a model loaded): create project → conversation → message storing a fact, then `POST /api/v1/chat/completions` asking the model to use `search_project_context` — response contains `mcp.toolCalls` and the fact. NOTE: all API calls from curl need an `Origin: http://localhost:5173` header or CORS rejects them.

**Gotchas:**
- curl/MCP-server-to-Express calls must include an allowlisted `Origin` (e.g. `http://localhost:5173`) or the CORS middleware 404s/HTML-errors.
- `OUTBOUND_ALLOWLIST` in `.env` is a JSON array; the Python parser accepts JSON array or comma-separated. `localhost` ≠ `127.0.0.1` — both must be listed.
- The MCP server does NOT hot-reload — restart it after changing `server/.env` or Python code.
- The Express backend also runs without a watcher (bare `node src/index.js`) — restart it after code/env changes.

## 4. LM Studio (port 1234) — external, user-managed

Chat's local provider needs LM Studio running with at least one model loaded (`curl http://localhost:1234/v1/models`). Down LLM = 503 from completions; unrelated to MCP/FHE.

## 5. Stop

```bash
pkill -f "node src/index.js"   # backend (careful: run in its own command, the pattern can match the wrapper shell)
pkill -f "vite"                # frontend
pkill -f "src.server"          # MCP server
```
