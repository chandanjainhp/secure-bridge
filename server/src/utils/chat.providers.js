/**
 * Provider factory using the Vercel AI SDK.
 *
 * Each provider is initialised from `@ai-sdk/*` packages, which abstract away
 * the differences in HTTP endpoints, message formats, and response shapes.
 * The controller just calls `generateText({ model, messages })` / `streamText()`
 * and the SDK handles the rest.
 *
 * Install:
 *   npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
 */

import { ApiKey } from "../features/api-key/models/apikey.model.js";
import { assertLocalLlmHost, normalizeLocalLlmUrl } from "./localLlm.js";

const loadOpenAI = () =>
  import("@ai-sdk/openai").then(({ createOpenAI }) => createOpenAI);
const loadAnthropic = () =>
  import("@ai-sdk/anthropic").then(({ createAnthropic }) => createAnthropic);
const loadGoogle = () =>
  import("@ai-sdk/google").then(
    ({ createGoogleGenerativeAI }) => createGoogleGenerativeAI,
  );

// ============================================================
// LLM SERVER CONFIG
// ============================================================

const LLM_SERVER_URL = process.env.LLM_SERVER_URL || "http://localhost:1234/v1";

// ============================================================
// PROVIDER REGISTRY
// ============================================================

/**
 * Each factory returns a provider client given an API key.
 * The client is then called as `client(modelName)` to get a model instance
 * that can be passed to `generateText({ model, messages })`.
 */
const providerFactories = {
  openai: async (apiKey) => (await loadOpenAI())({ apiKey }),

  anthropic: async (apiKey) => (await loadAnthropic())({ apiKey }),

  google: async (apiKey) => (await loadGoogle())({ apiKey }),

  /**
   * Local LLM (LM Studio, Ollama, etc.) — these servers expose an
   * OpenAI-compatible API, so we reuse `createOpenAI` with a custom baseURL.
   */
  local: async (apiKey, baseURL = LLM_SERVER_URL) =>
    (await loadOpenAI())({
      baseURL,
      apiKey: apiKey || "not-needed",
    }),
};

// ============================================================
// STATIC MODEL CATALOGS (for /models endpoint)
// ============================================================

const MODEL_CATALOGS = {
  local: [
    {
      id: "google/gemma-4-e4b",
      name: "Gemma 4 E4B (LM Studio)",
      description: `Local Gemma model running on ${LLM_SERVER_URL}`,
      type: "local",
      requiresApiKey: false,
    },
  ],
  google: [
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      description:
        "Stable version of Gemini 2.5 Flash, mid-size multimodal model (June 2025)",
      type: "api",
      provider: "google",
      requiresApiKey: true,
    },
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      description: "Stable release of Gemini 2.5 Pro (June 2025)",
      type: "api",
      provider: "google",
      requiresApiKey: true,
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      description:
        "Fast and versatile multimodal model for scaling across diverse tasks",
      type: "api",
      provider: "google",
      requiresApiKey: true,
    },
  ],
  openai: [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      description: "OpenAI GPT-4o multimodal model",
      type: "api",
      provider: "openai",
      requiresApiKey: true,
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o mini",
      description: "Fast and cost-effective OpenAI model",
      type: "api",
      provider: "openai",
      requiresApiKey: true,
    },
    {
      id: "gpt-3.5-turbo",
      name: "GPT-3.5 Turbo",
      description: "Legacy fast and affordable OpenAI model",
      type: "api",
      provider: "openai",
      requiresApiKey: true,
    },
  ],
  anthropic: [
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      description: "Anthropic Claude 3.5 Sonnet model",
      type: "api",
      provider: "anthropic",
      requiresApiKey: true,
    },
    {
      id: "claude-3-haiku-20240307",
      name: "Claude 3 Haiku",
      description: "Anthropic Claude 3 Haiku model",
      type: "api",
      provider: "anthropic",
      requiresApiKey: true,
    },
  ],
};

// ============================================================
// DEFAULT MODELS
// ============================================================

const DEFAULT_MODELS = {
  local: "google/gemma-4-e4b",
  google: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-20241022",
};

const LOCAL_MODEL = DEFAULT_MODELS.local;

// ============================================================
// PROVIDER DETECTION
// ============================================================

const PROVIDER_KEYWORDS = [
  { provider: "google", keywords: ["gemini", "google"] },
  { provider: "openai", keywords: ["gpt", "openai"] },
  { provider: "anthropic", keywords: ["claude", "anthropic"] },
];

/**
 * Detect the provider from the model name if the caller didn't specify one.
 * Returns `{ provider, model }`.
 */
function detectProvider(model, requestedProvider = "auto") {
  if (requestedProvider && requestedProvider !== "auto") {
    return {
      provider: requestedProvider,
      model:
        normalizeModelName(model, requestedProvider) ||
        DEFAULT_MODELS[requestedProvider] ||
        model,
    };
  }

  if (model === LOCAL_MODEL || model === "local") {
    return { provider: "local", model: LOCAL_MODEL };
  }

  const match = PROVIDER_KEYWORDS.find((p) =>
    p.keywords.some((kw) => model?.toLowerCase().includes(kw)),
  );

  if (match) {
    return {
      provider: match.provider,
      model:
        normalizeModelName(model, match.provider) ||
        DEFAULT_MODELS[match.provider],
    };
  }

  return {
    provider: "local",
    model: normalizeModelName(model, "local") || DEFAULT_MODELS.local,
  };
}

function normalizeModelName(model, provider) {
  const prefix = `${provider}/`;
  return typeof model === "string" && model.startsWith(prefix)
    ? model.slice(prefix.length)
    : model;
}

// ============================================================
// FALLBACK CHAIN (used when the primary provider fails)
// ============================================================

const FALLBACK_CHAIN = [
  { provider: "google", matchKeyword: "google", model: DEFAULT_MODELS.google },
  { provider: "openai", matchKeyword: "openai", model: DEFAULT_MODELS.openai },
];

// ============================================================
// API KEY LOOKUP & DECRYPTION
// ============================================================

async function findApiKeyForProvider(userId, provider) {
  if (!userId) return null;

  return ApiKey.findOne({
    userId,
    status: "active",
    permissions: { $in: ["chat.access", "chat.completions"] },
    $or: [
      { externalProvider: provider },
      { provider: provider },
      ...(provider === "google"
        ? [
            { externalProvider: "google_ai_studio" },
            { provider: "google_ai_studio" },
          ]
        : []),
    ],
  });
}

async function findExternalKeys(userId) {
  if (!userId) return [];

  return ApiKey.find({
    userId,
    status: "active",
    permissions: { $in: ["chat.access", "chat.completions"] },
    $or: [
      {
        externalProvider: {
          $in: ["google", "google_ai_studio", "openai", "anthropic", "azure"],
        },
      },
      {
        provider: {
          $in: ["google", "google_ai_studio", "openai", "anthropic", "azure"],
        },
      },
    ],
  });
}

async function decryptApiKey(apiKeyDoc) {
  // All API keys (internal and external) should now be encrypted
  // If encryption fields are missing, the key cannot be decrypted
  if (
    !apiKeyDoc.externalKeyEncrypted ||
    !apiKeyDoc.encryptionIV ||
    !apiKeyDoc.encryptionTag
  ) {
    console.error("❌ API key is not encrypted - missing encryption fields");
    return null;
  }

  try {
    return ApiKey.decryptExternalKey({
      encrypted: apiKeyDoc.externalKeyEncrypted,
      iv: apiKeyDoc.encryptionIV,
      tag: apiKeyDoc.encryptionTag,
    });
  } catch (error) {
    console.error("❌ Failed to decrypt API key:", error.message);
    // Do NOT fall back to plain key field - all keys must be encrypted
    return null;
  }
}

// ============================================================
// CORE: Get an AI SDK model instance
// ============================================================

/**
 * Returns a Vercel AI SDK model instance for the given provider + model.
 *
 * For external providers, looks up the user's stored API key from the DB.
 * For local, no key needed (LM Studio is OpenAI-compatible).
 *
 * @param {string}  provider          — "local" | "openai" | "anthropic" | "google"
 * @param {string}  modelName        — e.g. "gpt-4o-mini"
 * @param {string}  userId           — MongoDB ObjectId string
 * @param {object}  forcedApiKeyDoc  — pre-fetched ApiKey doc (optional)
 * @returns { model, providerUsed } or null
 */
async function getModelInstance(
  provider,
  modelName,
  userId,
  forcedApiKeyDoc = null,
  allowDefaultLocal = true,
) {
  // Local — use the user's configured compatible server when available.
  if (provider === "local") {
    let localConfig = null;
    if (userId) {
      localConfig = await ApiKey.findOne({
        userId,
        status: "active",
        externalProvider: "local",
        "settings.localLlm.enabled": { $ne: false },
        permissions: { $in: ["chat.access", "chat.completions"] },
      });
    }

    if (!localConfig && !allowDefaultLocal) {
      return null;
    }

    let baseURL = LLM_SERVER_URL;
    let localApiKey = null;
    let resolvedModel =
      !modelName || modelName === "local" ? DEFAULT_MODELS.local : modelName;
    if (localConfig?.settings?.localLlm?.baseUrl) {
      const validatedBaseUrl = await assertLocalLlmHost(
        localConfig.settings.localLlm.baseUrl,
      );
      baseURL = validatedBaseUrl.endsWith("/v1")
        ? validatedBaseUrl
        : `${validatedBaseUrl}/v1`;
      resolvedModel =
        !modelName || modelName === "local"
          ? localConfig.settings.localLlm.model
          : modelName;
    }

    const client = await providerFactories.local(localApiKey, baseURL);
    return {
      model: client(resolvedModel),
      providerUsed: "local",
    };
  }

  // External — need an API key
  let apiKeyDoc = forcedApiKeyDoc;
  if (!apiKeyDoc) {
    apiKeyDoc = await findApiKeyForProvider(userId, provider);
  }

  if (!apiKeyDoc) {
    return null;
  }

  const decryptedKey = await decryptApiKey(apiKeyDoc);
  if (!decryptedKey) {
    return null;
  }

  const factory = providerFactories[provider];
  if (!factory) {
    return null;
  }

  const client = await factory(decryptedKey);
  return {
    model: client(modelName),
    providerUsed: provider,
  };
}

// ============================================================
// LOCAL LLM HEALTH CHECK
// ============================================================

async function checkLocalLLMHealth(userId = null) {
  try {
    const baseURL = await getLocalLlmBaseUrl(userId);
    const response = await fetch(`${baseURL}/models`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function getLocalLlmBaseUrl(userId = null) {
  if (userId) {
    const localConfig = await ApiKey.findOne({
      userId,
      status: "active",
      externalProvider: "local",
      "settings.localLlm.enabled": { $ne: false },
      permissions: { $in: ["chat.access", "chat.completions"] },
    });
    if (localConfig?.settings?.localLlm?.baseUrl) {
      return assertLocalLlmHost(localConfig.settings.localLlm.baseUrl);
    }
  }
  return normalizeLocalLlmUrl(LLM_SERVER_URL);
}

async function getLocalModels(userId = null) {
  const baseURL = await getLocalLlmBaseUrl(userId);
  const response = await fetch(`${baseURL}/models`, {
    method: "GET",
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) {
    throw new Error("Local server not responding");
  }

  const data = await response.json();
  return (
    data.data?.map((m) => ({
      id: m.id,
      name: m.id,
      description: "Local LLM model",
      type: "local",
      requiresApiKey: false,
    })) || MODEL_CATALOGS.local
  );
}

export {
  // Core
  getModelInstance,
  detectProvider,
  // Constants
  LLM_SERVER_URL,
  DEFAULT_MODELS,
  LOCAL_MODEL,
  MODEL_CATALOGS,
  FALLBACK_CHAIN,
  // API key helpers
  findApiKeyForProvider,
  findExternalKeys,
  decryptApiKey,
  // Health
  checkLocalLLMHealth,
  getLocalModels,
  getLocalLlmBaseUrl,
};
