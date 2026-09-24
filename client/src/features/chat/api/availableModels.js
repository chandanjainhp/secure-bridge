import { chatApi } from "./chatApi";

// Mirrors chatApi's LOCAL_MODEL — requests with value "local" are remapped to it.
const LOCAL_SENTINEL = "local";

const GROUP_LABELS = {
  local: "LOCAL",
  openai: "OpenAI",
  google: "Google",
  anthropic: "Anthropic",
};
const GROUP_ORDER = ["local", "openai", "google", "anthropic"];

const normalize = (payload) => {
  const providers = payload?.providers || {};
  const options = [];

  // One entry for the whole local server — chatApi remaps "local" at request time.
  const local = providers.local;
  if (local?.available && Array.isArray(local.models) && local.models.length) {
    const m = local.models[0];
    options.push({
      value: LOCAL_SENTINEL,
      label: m.name || "Local model",
      description: m.description || "Local OpenAI-compatible server (LM Studio / Ollama)",
      group: "LOCAL",
    });
  }

  for (const key of GROUP_ORDER) {
    if (key === "local") continue;
    const p = providers[key];
    if (!p?.available || !Array.isArray(p.models)) continue;
    for (const m of p.models) {
      options.push({
        value: m.id,
        label: m.name || m.id,
        description: m.description || `${GROUP_LABELS[key]} model`,
        group: GROUP_LABELS[key],
      });
    }
  }

  return options;
};

const CACHE_TTL_MS = 15_000;
let cache = { options: null, at: 0 };

/**
 * Models the signed-in user can actually use right now, based on their
 * configured API keys / local connection. Cached briefly so repeatedly
 * opening the modal doesn't refetch.
 */
export async function fetchAvailableModels({ force = false } = {}) {
  const fresh = Date.now() - cache.at < CACHE_TTL_MS;
  if (!force && fresh && cache.options) return cache.options;

  try {
    const payload = await chatApi.getModels("all");
    cache = { options: normalize(payload?.data ?? payload), at: Date.now() };
  } catch {
    cache = { options: [], at: Date.now() };
  }
  return cache.options;
}

export function clearAvailableModelsCache() {
  cache = { options: null, at: 0 };
}
