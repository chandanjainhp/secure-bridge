import { jest } from "@jest/globals";
import crypto from "crypto";

const connect = jest.fn();
const listTools = jest.fn();
const callTool = jest.fn();
const close = jest.fn(() => Promise.resolve());
const Client = jest.fn(() => ({ connect, listTools, callTool, close }));
const StreamableHTTPClientTransport = jest.fn();

jest.unstable_mockModule("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client,
}));
jest.unstable_mockModule(
  "@modelcontextprotocol/sdk/client/streamableHttp.js",
  () => ({ StreamableHTTPClientTransport }),
);

const {
  createMcpClient,
  getMcpToolsForAiSdk,
  callMcpTool,
  resetMcpClient,
} = await import("../services/mcpClient.js");

describe("mcpClient", () => {
  beforeEach(async () => {
    delete process.env.ENABLE_MCP;
    delete process.env.MCP_SERVER_URL;
    delete process.env.MCP_SERVICE_TOKEN;
    jest.clearAllMocks();
    await resetMcpClient();
  });

  it("does not connect when MCP is disabled", async () => {
    expect(await createMcpClient()).toBeNull();
    expect(Client).not.toHaveBeenCalled();
    expect(StreamableHTTPClientTransport).not.toHaveBeenCalled();
  });

  it("caches tool descriptors across user-scoped builds", async () => {
    process.env.ENABLE_MCP = "true";
    process.env.MCP_SERVER_URL = "http://127.0.0.1:8787/mcp";
    connect.mockResolvedValue(undefined);
    listTools.mockResolvedValue({
      tools: [
        {
          name: "fetch_url",
          description: "Fetch an allowlisted URL",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    });

    const first = await getMcpToolsForAiSdk("user-a");
    const second = await getMcpToolsForAiSdk("user-b");

    expect(second.tools.fetch_url).toBeDefined();
    expect(listTools).toHaveBeenCalledTimes(1); // descriptors cached
    expect(first.tools).not.toBe(second.tools); // per-user tool objects
  });

  it("injects a signed user identity into user-scoped tool calls", async () => {
    process.env.ENABLE_MCP = "true";
    process.env.MCP_SERVICE_TOKEN = "test-service-token";
    connect.mockResolvedValue(undefined);
    listTools.mockResolvedValue({ tools: [] });
    await getMcpToolsForAiSdk(); // warm cache

    await callMcpTool("search_project_context", { project_id: "p1", query: "q" }, { userId: "user-123" });

    expect(callTool).toHaveBeenCalledWith({
      name: "search_project_context",
      arguments: {
        project_id: "p1",
        query: "q",
        __user_id: "user-123",
        __user_sig: crypto
          .createHmac("sha256", "test-service-token")
          .update("user-123")
          .digest("hex"),
      },
    });
  });

  it("strips identity fields when no user id is bound", async () => {
    process.env.ENABLE_MCP = "true";
    connect.mockResolvedValue(undefined);
    listTools.mockResolvedValue({ tools: [] });
    await getMcpToolsForAiSdk();

    await callMcpTool("fetch_url", { url: "https://example.com" });

    const called = callTool.mock.calls[0][0];
    expect(called.arguments.__user_id).toBeUndefined();
    expect(called.arguments.__user_sig).toBeUndefined();
  });

  it("returns no tools when the MCP server cannot connect", async () => {
    process.env.ENABLE_MCP = "true";
    connect.mockRejectedValueOnce(new Error("server unavailable"));

    await expect(getMcpToolsForAiSdk()).resolves.toMatchObject({ tools: {} });
  });

  it("unwraps MCP text content for the LLM and keeps isError results as text", async () => {
    process.env.ENABLE_MCP = "true";
    connect.mockResolvedValue(undefined);
    listTools.mockResolvedValue({
      tools: [
        {
          name: "fetch_url",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    });
    const { tools } = await getMcpToolsForAiSdk();

    callTool.mockResolvedValueOnce({
      content: [{ type: "text", text: "allowlist rejected" }],
      isError: true,
    });
    const out = await tools.fetch_url.execute({ url: "https://x.test" });
    expect(out).toBe("allowlist rejected");
  });
});
