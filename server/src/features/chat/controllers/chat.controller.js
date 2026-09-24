import { generateText, streamText, stepCountIs } from "ai";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { ApiKey } from "../../../features/api-key/models/apikey.model.js";
import usageService from "../../usage/services/usageService.js";
import { getMcpToolsForAiSdk } from "../../../services/mcpClient.js";
import {
  getModelInstance,
  detectProvider,
  findExternalKeys,
  checkLocalLLMHealth,
  getLocalModels,
  LLM_SERVER_URL,
  DEFAULT_MODELS,
  MODEL_CATALOGS,
  FALLBACK_CHAIN,
} from "../../../utils/chat.providers.js";
import {
  fheChatActive,
  selectContextWithFhe,
} from "../../../services/fheChat.js";

// ============================================================
// HELPER: Build OpenAI-compatible response from AI SDK result
// ============================================================

function buildCompletionResponse(
  result,
  model,
  providerUsed,
  message = "Chat completion successful",
) {
  return new ApiResponse(
    200,
    {
      id: `${providerUsed}-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      provider_used: providerUsed,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: result.text },
          finish_reason: result.finishReason || "stop",
        },
      ],
      usage: {
        prompt_tokens: result.usage?.promptTokens || 0,
        completion_tokens: result.usage?.completionTokens || 0,
        total_tokens: result.usage?.totalTokens || 0,
      },
    },
    message,
  );
}

// ============================================================
// HELPER: Collect MCP tool calls from an AI SDK result
// ============================================================

function collectToolCalls(result) {
  const calls = [];
  for (const step of result.steps || []) {
    for (const toolCall of step.toolCalls || []) {
      calls.push({
        tool: toolCall.toolName,
        input: toolCall.input,
      });
    }
  }
  return calls;
}

// ============================================================
// PROMPT-PROTOCOL TOOL CALLING (local models)
//
// LM Studio's OpenAI-compatible endpoint does not parse tool-call syntax
// for most local models — native `tools` leak back as plain text and the
// AI SDK never sees a tool call. For the local provider we instead declare
// the tools in the system prompt with an explicit `TOOL_CALL: {...}` output
// convention, parse the model's line, execute via MCP, and feed the result
// back — a bounded agent loop that works with ANY local model.
// ============================================================

const TOOL_CALL_RE = /TOOL_CALL:\s*(\{[\s\S]*?\})\s*$/;

function buildToolProtocolPrompt(mcpTools) {
  const toolDocs = Object.entries(mcpTools)
    .map(([name, tool]) => {
      const schema = tool.inputSchema || {};
      const props = Object.keys(schema.properties || {});
      return `- ${name}: ${tool.description || ""} (args: ${props.join(", ") || "none"})`;
    })
    .join("\n");

  return [
    "You can use these tools:",
    toolDocs,
    "",
    "To call a tool, END your reply with exactly one line in this format:",
    'TOOL_CALL: {"tool": "<tool name>", "args": { ... }}',
    "",
    "After a TOOL_CALL line the system executes the tool and replies with a TOOL_RESULT message. ",
    "Then produce your final answer. The final answer must NOT contain a TOOL_CALL line.",
    "If you do not need a tool, just answer directly.",
  ].join("\n");
}

async function runLocalToolLoop({ model, promptOptions, mcpTools, maxRounds = 3 }) {
  const baseMessages = [...(promptOptions.messages || [])];
  const systemText = buildToolProtocolPrompt(mcpTools);
  // AI SDK v7: system prompts belong in the `system` option, never inside
  // `messages` (a system-role message there throws InvalidPrompt).
  const mergedSystem = promptOptions.system
    ? `${promptOptions.system}\n\n${systemText}`
    : systemText;
  let convo = baseMessages;

  const toolCalls = [];
  let result;

  for (let round = 0; round < maxRounds; round += 1) {
    result = await generateText({
      ...promptOptions,
      messages: convo,
      system: mergedSystem,
      abortSignal: AbortSignal.timeout(120_000),
    });

    const text = result.text || "";
    const match = text.trimEnd().match(TOOL_CALL_RE);
    if (!match) return { result, toolCalls }; // final answer reached

    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      return { result, toolCalls }; // malformed call — return as-is
    }

    const toolName = parsed.tool || parsed.name;
    const tool = toolName ? mcpTools[toolName] : null;
    if (!tool) return { result, toolCalls };

    let toolOutput;
    try {
      toolOutput = await tool.execute(parsed.args || {});
    } catch (error) {
      toolOutput = `Tool error: ${error?.message || error}`;
    }

    toolCalls.push({ tool: toolName, input: parsed.args || {} });
    convo = [
      ...convo,
      { role: "assistant", content: text },
      {
        role: "user",
        content:
          `TOOL_RESULT for ${toolName}:\n${String(toolOutput).slice(0, 4000)}\n\n` +
          "Use this result. If you need another tool, end your reply with one TOOL_CALL line; otherwise write the final answer with NO TOOL_CALL line.",
      },
    ];
  }

  // Round budget exhausted — one final forced answer.
  result = await generateText({
    ...promptOptions,
    messages: [
      ...convo,
      { role: "user", content: "No more tool calls. Write your final answer now." },
    ],
    system: mergedSystem,
    abortSignal: AbortSignal.timeout(120_000),
  });
  return { result, toolCalls };
}

// ============================================================
// HELPER: Execute a completion (handles stream vs non-stream)
// ============================================================

async function executeCompletion(res, model, messages, params) {
  const {
    temperature,
    max_tokens,
    stream,
    top_p,
    stop,
    model: modelName,
    providerUsed,
    userId,
    trackUsage = true,
    mcpTools,
    localToolLoop = false,
  } = params;

  const systemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .filter(Boolean);
  const modelMessages = messages.filter((message) => message.role !== "system");
  const promptOptions = {
    model,
    messages: modelMessages,
    ...(systemMessages.length > 0
      ? { system: systemMessages.join("\n\n") }
      : {}),
    temperature,
    maxTokens: max_tokens,
    topP: top_p,
    stopSequences: stop,
  };

  const completionOptions = {
    ...promptOptions,
    abortSignal: AbortSignal.timeout(120_000), // fail fast instead of hanging when the LLM server is unreachable/stuck
  };

  // Local models: prompt-protocol loop instead of native tools (LM Studio
  // does not parse tool-call syntax for most local models).
  if (localToolLoop && mcpTools && Object.keys(mcpTools).length > 0 && !stream) {
    const loop = await runLocalToolLoop({ model, promptOptions, mcpTools });
    const toolCalls = loop.toolCalls;
    if (toolCalls.length > 0) {
      console.log(`🔧 MCP tool calls (local loop): ${toolCalls.map((c) => c.tool).join(", ")}`);
    }
    if (trackUsage && userId) {
      usageService
        .recordTokens(userId, {
          promptTokens: loop.result.usage?.inputTokens || loop.result.usage?.promptTokens || 0,
          completionTokens: loop.result.usage?.outputTokens || loop.result.usage?.completionTokens || 0,
          totalTokens: loop.result.usage?.totalTokens || 0,
        })
        .catch(() => {});
    }
    const payload = buildCompletionResponse(loop.result, modelName, providerUsed);
    if (toolCalls.length > 0) {
      payload.data.mcp = { toolCalls };
    }
    return res.status(200).json(payload);
  }

  // Attach MCP tools (ENABLE_MCP=true) so the model can call them mid-answer.
  // stopWhen caps the agent loop; tool failures are returned to the model as
  // readable errors (see mcpClient.execute) so one bad call can't kill the
  // whole completion.
  if (mcpTools && Object.keys(mcpTools).length > 0 && !localToolLoop) {
    completionOptions.tools = mcpTools;
    completionOptions.stopWhen = stepCountIs(5);
  }

  if (stream) {
    if (completionOptions.tools) {
      res.setHeader("x-mcp-tools", `attached=${Object.keys(completionOptions.tools).join(",")}`);
    }
    const result = streamText(completionOptions);
    return result.toDataStreamResponse(res);
  }

  let result;
  try {
    result = await generateText(completionOptions);
  } catch (error) {
    // Retry without tools: a broken MCP server / bad tool loop must not take
    // down the chat itself.
    if (!completionOptions.tools) throw error;
    console.warn(
      "⚠️  Completion with MCP tools failed; retrying without tools:",
      error?.message || error,
    );
    result = await generateText({
      ...promptOptions,
      abortSignal: completionOptions.abortSignal,
    });
  }

  const toolCalls = collectToolCalls(result);
  if (toolCalls.length > 0) {
    console.log(
      `🔧 MCP tool calls: ${toolCalls.map((c) => c.tool).join(", ")}`,
    );
  }
  if (trackUsage && userId) {
    usageService
      .recordTokens(userId, {
        promptTokens:
          result.usage?.inputTokens || result.usage?.promptTokens || 0,
        completionTokens:
          result.usage?.outputTokens || result.usage?.completionTokens || 0,
        totalTokens: result.usage?.totalTokens || 0,
      })
      .catch((error) => {
        console.error("Chat usage recording failed", {
          name: error?.name,
          message: error?.message,
        });
      });
  }

  const payload = buildCompletionResponse(result, modelName, providerUsed);
  if (toolCalls.length > 0) {
    payload.data.mcp = { toolCalls };
  }

  return res.status(200).json(payload);
}

// ============================================================
// CONTROLLER
// ============================================================

class ChatController {
  // ---------------------------------------------------------
  // GET /test
  // ---------------------------------------------------------
  static test = asyncHandler(async (req, res) => {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { timestamp: new Date() },
          "Chat router is working!",
        ),
      );
  });

  // ---------------------------------------------------------
  // POST /completions — the core endpoint
  // ---------------------------------------------------------
  static completions = asyncHandler(async (req, res) => {
    const { messages, temperature, max_tokens, stream, top_p, stop } = req.body;
    const requestedProvider = req.headers["x-provider"] || "auto";
    const userId = req.user?._id || req.apiKey?.userId;

    // Free-tier consumption is enforced only when the shared free-tier model is actually selected.
    // BYOK and local models are not charged against the free-message quota.

    // Determine provider and model
    const { provider: selectedProvider, model: selectedModel } = detectProvider(
      req.body.model,
      requestedProvider,
    );

    console.log(
      `🤖 Chat request: provider=${selectedProvider}, model=${selectedModel}, messages=${messages.length}, stream=${stream}`,
    );

    // MCP tools are attached per request (ENABLE_MCP=true + reachable MCP
    // server). Discovery failures degrade to toolless chat, never an error.
    const { tools: mcpTools, error: mcpError } = await getMcpToolsForAiSdk(
      userId,
    );
    if (mcpError) {
      console.warn("⚠️  MCP tool discovery failed:", mcpError);
    }

    const params = { temperature, max_tokens, stream, top_p, stop, mcpTools };

    // --- FHE homomorphic context retrieval (ENCRYPTION_MODE=fhe) ---
    // History turns are ranked against the current message with real BFV
    // ciphertext math (word-bucket vectors); only scalar scores are decrypted.
    // In mock mode this is a no-op passthrough.
    let effectiveMessages = messages;
    if (
      fheChatActive() &&
      Array.isArray(messages) &&
      messages.length > 2
    ) {
      const systemParts = messages.filter((m) => m.role === "system");
      const history = messages.slice(0, -1).filter((m) => m.role !== "system");
      const currentMessage = messages[messages.length - 1]?.content || "";
      // Cap the scoring window so latency stays bounded on long histories.
      const result = await selectContextWithFhe(
        history.slice(-30),
        currentMessage,
        { maxTurns: 8 },
      );
      effectiveMessages = [
        ...systemParts,
        ...result.messages,
        messages[messages.length - 1],
      ].filter(Boolean);
      if (result.fhe.enabled && !res.headersSent) {
        res.setHeader(
          "x-fhe-retrieval",
          `scored=${result.fhe.scoredTurns}; selected=${result.fhe.selectedTurns}; top=${result.fhe.topScore}; scheme=BFV; on-ciphertext=true`,
        );
      }
      console.log(
        `🔐 FHE retrieval: enabled=${result.fhe.enabled}${result.fhe.enabled ? ` scored=${result.fhe.scoredTurns} selected=${result.fhe.selectedTurns} top=${result.fhe.topScore} in ${result.fhe.durationMs}ms` : ` reason=${result.fhe.reason}`}`,
      );
    }

    // --- Local path (with external fallback) ---
    if (selectedProvider === "local") {
      try {
        const { model, providerUsed } = await getModelInstance(
          "local",
          selectedModel,
          userId,
        );

        return await executeCompletion(res, model, effectiveMessages, {
          ...params,
          modelName: selectedModel,
          providerUsed,
          userId,
          localToolLoop: true,
        });
      } catch (localError) {
        console.log("⚠️  Local LLM not available:", localError.message);
        console.log("🔄 Falling back to external API...");

        // Try external fallback — pass res so streaming can write directly
        const fallbackSent = await ChatController._tryExternalFallback(
          res,
          userId,
          effectiveMessages,
          params,
        );

        if (fallbackSent) {
          return; // Response already sent
        }

        throw new ApiError(
          503,
          "Local LLM server is unreachable (is LM Studio / Ollama running?) and no external API keys are configured as fallback",
          { localError: localError.message, fallbackAttempted: true },
        );
      }
    }

    // --- External provider path ---
    let instance = await getModelInstance(
      selectedProvider,
      selectedModel,
      userId,
    );

    if (!instance) {
      // Existing projects may still contain a cloud model selected before a
      // local connection was configured. Use the user's local profile only
      // when the requested cloud provider has no usable key.
      instance = await getModelInstance(
        "local",
        "local",
        userId,
        null,
        false,
      ).catch(() => null);
      if (instance) {
        return await executeCompletion(res, instance.model, effectiveMessages, {
          ...params,
          modelName: "local",
          providerUsed: instance.providerUsed,
          userId,
          localToolLoop: true,
        });
      }

      throw new ApiError(
        502,
        `No API key found for provider "${selectedProvider}", and no local LLM connection is available. Configure a provider key or select a configured local model.`,
      );
    }

    const { model, providerUsed } = instance;

    return await executeCompletion(res, model, effectiveMessages, {
      ...params,
      modelName: selectedModel,
      providerUsed,
      userId,
    });
  });

  // ---------------------------------------------------------
  // GET /providers — list available providers
  // ---------------------------------------------------------
  static getProviders = asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.apiKey?.userId;

    const providers = {
      local: { available: false, reason: "Local LLM server offline" },
      google: { available: false, reason: "No Google API key configured" },
      openai: { available: false, reason: "No OpenAI API key configured" },
      anthropic: {
        available: false,
        reason: "No Anthropic API key configured",
      },
      azure: {
        available: false,
        reason:
          "Azure provider is not available through the active AI SDK provider registry",
      },
    };

    // Check local LLM
    const localHealthy = await checkLocalLLMHealth(userId);
    if (localHealthy) {
      providers.local = { available: true, status: "connected" };
    }

    // Check user's external API keys
    if (userId) {
      const userApiKeys = await ApiKey.find({
        userId,
        status: "active",
        permissions: { $in: ["chat.access", "chat.completions"] },
      });

      const matchKey = (keyword) =>
        userApiKeys.find((key) =>
          (key.provider || key.externalProvider || "")
            .toLowerCase()
            .includes(keyword),
        );

      const googleKey = matchKey("google");
      if (googleKey) {
        providers.google = {
          available: true,
          keyId: googleKey._id,
          keyName: googleKey.name,
          status: "configured",
        };
      }

      const openaiKey = matchKey("openai");
      if (openaiKey) {
        providers.openai = {
          available: true,
          keyId: openaiKey._id,
          keyName: openaiKey.name,
          status: "configured",
        };
      }

      const anthropicKey = matchKey("anthropic");
      if (anthropicKey) {
        providers.anthropic = {
          available: true,
          keyId: anthropicKey._id,
          keyName: anthropicKey.name,
          status: "configured",
        };
      }
    }

    const availableCount = Object.values(providers).filter(
      (p) => p.available,
    ).length;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          providers,
          totalProviders: Object.keys(providers).length,
          availableProviders: availableCount,
        },
        availableCount > 0
          ? "Chat providers available"
          : "No chat providers available",
      ),
    );
  });

  // ---------------------------------------------------------
  // GET /models — list available models
  // ---------------------------------------------------------
  static getModels = asyncHandler(async (req, res) => {
    const provider = req.query.provider || "all";
    const userId = req.user?._id || req.apiKey?.userId;

    const models = {};

    // Local models
    if (provider === "all" || provider === "local") {
      try {
        const localModels = await getLocalModels(userId);
        models.local = { available: true, models: localModels };
      } catch (error) {
        models.local = { available: false, error: error.message, models: [] };
      }
    }

    // External models (only show if user has active keys)
    if (
      userId &&
      (provider === "all" ||
        ["google", "openai", "anthropic"].includes(provider))
    ) {
      const userApiKeys = await ApiKey.find({
        userId,
        status: "active",
        permissions: { $in: ["chat.access", "chat.completions"] },
      });

      const hasProvider = (keyword) =>
        userApiKeys.some((key) =>
          (key.provider || key.externalProvider || "")
            .toLowerCase()
            .includes(keyword),
        );

      if (
        hasProvider("google") &&
        (provider === "all" || provider === "google")
      ) {
        const googleKeys = userApiKeys.filter((key) =>
          (key.provider || key.externalProvider || "")
            .toLowerCase()
            .includes("google"),
        );
        models.google = {
          available: true,
          apiKeyCount: googleKeys.length,
          models: MODEL_CATALOGS.google,
        };
      }

      if (
        hasProvider("openai") &&
        (provider === "all" || provider === "openai")
      ) {
        const openaiKeys = userApiKeys.filter((key) =>
          (key.provider || key.externalProvider || "")
            .toLowerCase()
            .includes("openai"),
        );
        models.openai = {
          available: true,
          apiKeyCount: openaiKeys.length,
          models: MODEL_CATALOGS.openai,
        };
      }

      if (
        hasProvider("anthropic") &&
        (provider === "all" || provider === "anthropic")
      ) {
        const anthropicKeys = userApiKeys.filter((key) =>
          (key.provider || key.externalProvider || "")
            .toLowerCase()
            .includes("anthropic"),
        );
        models.anthropic = {
          available: true,
          apiKeyCount: anthropicKeys.length,
          models: MODEL_CATALOGS.anthropic,
        };
      }
    }

    // Flatten for legacy compatibility
    const allModels = [];
    Object.values(models).forEach((providerData) => {
      if (providerData.models) {
        allModels.push(...providerData.models);
      }
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          data: allModels,
          providers: models,
          providerRequested: provider,
        },
        "Models retrieved successfully",
      ),
    );
  });

  // ---------------------------------------------------------
  // GET /tools — MCP tool visibility (JWT or API key required)
  // ---------------------------------------------------------
  static getTools = asyncHandler(async (req, res) => {
    const userId = req.user?._id || req.apiKey?.userId;
    const { tools, error } = await getMcpToolsForAiSdk(userId);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          enabled: process.env.ENABLE_MCP === "true",
          serverUrl:
            process.env.MCP_SERVER_URL ||
            `http://${process.env.MCP_SERVER_HOST || "127.0.0.1"}:${process.env.MCP_SERVER_PORT || "8787"}/mcp`,
          discoveryError: error,
          tools: Object.entries(tools).map(([name, tool]) => ({
            name,
            description: tool.description,
          })),
        },
        "MCP tools retrieved successfully",
      ),
    );
  });

  // ---------------------------------------------------------
  // GET /health — local LLM health check (no auth)
  // ---------------------------------------------------------
  static health = asyncHandler(async (req, res) => {
    const isHealthy = await checkLocalLLMHealth();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          llm_server: {
            healthy: isHealthy,
            url: LLM_SERVER_URL,
          },
        },
        "LLM server health check completed",
      ),
    );
  });

  // ---------------------------------------------------------
  // GET /test-unauth — unauthenticated backend test
  // ---------------------------------------------------------
  static testUnauth = asyncHandler(async (req, res) => {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          server: "Secure Bridge Backend",
          timestamp: new Date().toISOString(),
          endpoints: {
            health: "/api/v1/chat/health",
            models: "/api/v1/chat/models (requires API key)",
            completions: "/api/v1/chat/completions (requires API key)",
            providers: "/api/v1/chat/providers (requires API key)",
          },
        },
        "Backend server is working! This endpoint does not require authentication.",
      ),
    );
  });

  // ---------------------------------------------------------
  // POST /test-local — test local LLM connectivity (no auth)
  // ---------------------------------------------------------
  static testLocal = asyncHandler(async (req, res) => {
    const testMessages = [
      {
        role: "user",
        content:
          'Hello! Please respond with just "Local LLM working" if you can see this.',
      },
    ];

    try {
      const { model } = await getModelInstance(
        "local",
        DEFAULT_MODELS.local,
        null,
      );

      const result = await generateText({
        model,
        messages: testMessages,
        temperature: 0.7,
        maxTokens: 100,
      });

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            response: result.text || "No response content",
            provider: "local",
          },
          "Local LLM is working!",
        ),
      );
    } catch (error) {
      throw new ApiError(503, "Local LLM test failed", {
        error: error.message,
        suggestion: `Make sure LM Studio or similar is running on ${LLM_SERVER_URL}`,
      });
    }
  });

  // ---------------------------------------------------------
  // Development-only: Create demo API key
  // ---------------------------------------------------------
  static createDemoKey = asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV !== "development") {
      throw new ApiError(404, "Endpoint not available");
    }

    const { key, keyPrefix, hashedKey } = ApiKey.generateKey();
    const mongoose = await import("mongoose");
    const demoUserId = new mongoose.default.Types.ObjectId();

    const apiKey = await ApiKey.create({
      name: "Demo API Key for Chat Testing",
      description: "Temporary API key for testing chat functionality",
      userId: demoUserId,
      key,
      keyPrefix,
      hashedKey,
      isExternal: false,
      permissions: [
        "chat.access",
        "chat.completions",
        "fhe.encrypt",
        "mcp.connect",
      ],
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
      },
      ipWhitelist: [],
      status: "active",
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          id: apiKey._id,
          key, // Only shown once
          name: apiKey.name,
          permissions: apiKey.permissions,
          status: apiKey.status,
          usage:
            "Include this key in X-API-Key header for authenticated requests",
        },
        "Demo API key created successfully!",
      ),
    );
  });

  // ---------------------------------------------------------
  // Development-only: Get demo API key
  // ---------------------------------------------------------
  static getDemoKey = asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV !== "development") {
      throw new ApiError(404, "Endpoint not available");
    }

    const demoKey = await ApiKey.findOne({
      name: "Demo API Key for Chat Testing",
      status: "active",
    }).select("-hashedKey");

    if (!demoKey) {
      throw new ApiError(404, "No demo API key found. Create one first.", {
        createEndpoint: "/api/v1/chat/create-demo-key",
      });
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          _id: demoKey._id.toString(),
          name: demoKey.name,
          provider: "internal",
          status: demoKey.status,
          permissions: demoKey.permissions,
          key: demoKey.key,
          encryptionEnabled: true,
          usage: {
            totalRequests: demoKey.usage?.totalRequests || 0,
            requestsToday: 0,
            lastUsed: demoKey.usage?.lastUsed || null,
          },
        },
        "Demo API key retrieved successfully!",
      ),
    );
  });

  // ============================================================
  // PRIVATE: External fallback when local LLM fails
  // ============================================================

  /**
   * Tries external providers when the local LLM is unavailable.
   * Writes directly to `res` (streaming or JSON).
   *
   * @param {object} res       — Express response object
   * @param {string} userId    — User ID for API key lookup
   * @param {array}  messages  — Chat messages
   * @param {object} params    — { temperature, max_tokens, stream, top_p, stop }
   * @returns {boolean} true if a response was sent, false if no fallback available
   */
  static async _tryExternalFallback(res, userId, messages, params) {
    const { temperature, max_tokens, stream, top_p, stop, mcpTools } = params;

    try {
      const externalKeys = await findExternalKeys(userId);

      if (externalKeys.length === 0) {
        return false;
      }

      for (const entry of FALLBACK_CHAIN) {
        const keyDoc = externalKeys.find((k) => {
          const provider = (
            k.provider ||
            k.externalProvider ||
            ""
          ).toLowerCase();
          return provider.includes(entry.matchKeyword);
        });

        if (!keyDoc) continue;

        const actualProvider = keyDoc.provider || keyDoc.externalProvider;

        // Normalise google_ai_studio → google for the SDK factory
        const sdkProvider =
          actualProvider === "google_ai_studio" ? "google" : actualProvider;

        const instance = await getModelInstance(
          sdkProvider,
          entry.model,
          userId,
          keyDoc,
        );

        if (!instance) continue;

        const { model, providerUsed } = instance;

        // Use the shared completion executor — writes directly to res
        await executeCompletion(res, model, messages, {
          temperature,
          max_tokens,
          stream,
          top_p,
          stop,
          mcpTools,
          modelName: entry.model,
          providerUsed,
          userId,
        });

        return true; // Response sent successfully
      }

      return false;
    } catch (error) {
      console.error("❌ Error in external API fallback:", error.message);
      return false;
    }
  }
}

export default ChatController;
