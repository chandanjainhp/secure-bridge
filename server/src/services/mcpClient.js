import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { jsonSchema } from "ai";
import crypto from "crypto";

let cachedClient = null;
let cachedDescriptors = null; // [{ name, description, inputSchema }]
let cachedServerUrl = null;

function normalizeMcpServerUrl() {
  const configuredUrl = process.env.MCP_SERVER_URL?.trim();
  const base =
    configuredUrl ||
    `http://${process.env.MCP_SERVER_HOST || "127.0.0.1"}:${process.env.MCP_SERVER_PORT || "8787"}`;
  const normalizedBase = base.replace(/\/$/, "");

  if (/^https?:\/\//i.test(normalizedBase)) {
    return normalizedBase.endsWith("/mcp")
      ? normalizedBase
      : `${normalizedBase}/mcp`;
  }

  if (normalizedBase.includes("://")) {
    return normalizedBase;
  }

  return `${normalizedBase}/mcp`;
}

/**
 * HMAC signature for a user-scoped MCP tool call.
 *
 * The backend signs the user id with MCP_SERVICE_TOKEN; the MCP tool relays
 * the pair to Express, which verifies the HMAC before honoring the requested
 * user. Without the token configured, user-scoped tools degrade to calls
 * without an identity (the Express callback then requires a real user JWT).
 */
function serviceIdentity() {
  const token = process.env.MCP_SERVICE_TOKEN?.trim();
  if (!token) return null;

  return {
    sign(userId) {
      return crypto
        .createHmac("sha256", token)
        .update(String(userId))
        .digest("hex");
    },
  };
}

/**
 * Open a fresh MCP connection over the streamable-HTTP transport.
 */
async function connectClient() {
  const url = normalizeMcpServerUrl();

  try {
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      fetch: globalThis.fetch.bind(globalThis),
    });

    const client = new Client(
      { name: "secure-bridge-server", version: "1.0.0" },
      {
        capabilities: {},
      },
    );

    await client.connect(transport);
    return client;
  } catch (error) {
    console.warn(
      "[mcpClient] MCP server unavailable; continuing without MCP tools.",
      error?.message || error,
    );
    return null;
  }
}

export async function createMcpClient() {
  if (process.env.ENABLE_MCP !== "true") {
    return null;
  }

  const url = normalizeMcpServerUrl();

  if (cachedClient && cachedServerUrl === url) {
    return cachedClient;
  }

  if (cachedClient && typeof cachedClient.close === "function") {
    await cachedClient.close().catch(() => {});
  }
  cachedClient = null;
  cachedDescriptors = null;
  cachedServerUrl = null;

  const client = await connectClient();
  if (!client) return null;

  cachedClient = client;
  cachedServerUrl = url;
  return client;
}

/**
 * Discovers tools from the MCP server and returns AI SDK tool objects bound
 * to the given user.
 *
 * AI SDK v7 tool shape: { description, inputSchema, execute }.
 *
 * The `execute` closure injects a signed user identity (derived from
 * MCP_SERVICE_TOKEN) so user-scoped tools (e.g. search_project_context) can
 * read ONLY that user's data: the MCP tool relays the signed pair to
 * Express, which verifies the HMAC before honoring the requested user.
 *
 * Tool descriptors are cached per server URL; the tool objects themselves
 * are rebuilt per request because they close over the caller's user id.
 *
 * Returns { tools, error } — error is set when discovery failed.
 */
export async function getMcpToolsForAiSdk(userId) {
  if (process.env.ENABLE_MCP !== "true") {
    return { tools: {}, error: null };
  }

  try {
    const url = normalizeMcpServerUrl();
    if (!cachedDescriptors || cachedServerUrl !== url) {
      const client = await createMcpClient();
      if (!client) return { tools: {}, error: null };

      const result = await client.listTools();
      cachedDescriptors = (result.tools || []).map((tool) => ({
        name: tool.name,
        description: tool.description || "MCP tool",
        inputSchema: tool.inputSchema || {
          type: "object",
          properties: {},
          additionalProperties: true,
        },
      }));
    }

    return { tools: buildTools(cachedDescriptors, userId), error: null };
  } catch (error) {
    console.warn(
      "[mcpClient] Failed to list MCP tools.",
      error?.message || error,
    );
    return { tools: {}, error: error?.message || "listTools failed" };
  }
}

function buildTools(descriptors, userId) {
  const tools = {};

  for (const tool of descriptors) {
    tools[tool.name] = {
      description: tool.description,
      // AI SDK v5+ expects a Schema wrapper around a raw JSON Schema
      // (passing the raw object throws "schema is not a function").
      inputSchema: jsonSchema(tool.inputSchema),
      execute: async (args = {}) => {
        const response = await callMcpTool(tool.name, args, { userId });

        // Unwrap MCP content into plain text for the LLM. Tool-level errors
        // (isError: true — e.g. allowlist rejections) are intentionally
        // returned as results rather than thrown: the model can read the
        // reason and adapt instead of crashing the step loop.
        if (response && Array.isArray(response.content)) {
          const text = response.content
            .filter((part) => part?.type === "text" && part.text)
            .map((part) => part.text)
            .join("\n")
            .trim();
          if (text) return text;
        }
        return response;
      },
    };
  }

  return tools;
}

/**
 * Call an MCP tool over the streamable-HTTP transport.
 *
 * User-scoped calls (userId present + service token configured) inject a
 * signed identity (`__user_id` + `__user_sig`) into the tool arguments; the
 * MCP tool relays the pair to Express, which verifies the HMAC and scopes
 * the data read to that user. The signature cannot be forged without the
 * token, so a hostile MCP client gains nothing by calling the tool directly.
 */
export async function callMcpTool(toolName, args = {}, { userId } = {}) {
  const identity = serviceIdentity();

  let toolArgs = { ...args };
  delete toolArgs.__user_id;
  delete toolArgs.__user_sig;

  if (userId && identity) {
    toolArgs.__user_id = String(userId);
    toolArgs.__user_sig = identity.sign(userId);
  }

  const client = await createMcpClient();
  if (!client) {
    throw new Error("MCP server unavailable");
  }

  return client.callTool({ name: toolName, arguments: toolArgs });
}

export async function resetMcpClient() {
  if (cachedClient && typeof cachedClient.close === "function") {
    await cachedClient.close().catch(() => {});
  }

  cachedClient = null;
  cachedDescriptors = null;
  cachedServerUrl = null;
}
