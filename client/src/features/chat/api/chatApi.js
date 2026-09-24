import { apiClient } from "@/shared/api/client";

const LOCAL_MODEL = "google/gemma-4-e4b";
const isLocalModel = (model) => model === "local" || model === LOCAL_MODEL;
const requestModel = (model) => (model === "local" ? LOCAL_MODEL : model);

export const chatApi = {
  complete: ({ model, messages, temperature, max_tokens }) =>
    apiClient.fetch("/chat/completions", {
      method: "POST",
      headers: isLocalModel(model) ? { "x-provider": "local" } : {},
      body: JSON.stringify({
        model: requestModel(model),
        messages,
        temperature,
        max_tokens,
        stream: false,
      }),
    }),
  getProviders: () => apiClient.fetch("/chat/providers"),
  getModels: (provider = "all") =>
    apiClient.fetch(`/chat/models?provider=${encodeURIComponent(provider)}`),
  async stream({ model, messages, temperature, max_tokens, onChunk }) {
    const response = await apiClient.fetchStream("/chat/stream", {
      method: "POST",
      headers: isLocalModel(model) ? { "x-provider": "local" } : {},
      body: JSON.stringify({
        model: requestModel(model),
        messages,
        temperature,
        max_tokens,
        stream: true,
      }),
    });
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is not readable");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.chunk && !data.done) onChunk?.(data.chunk);
        } catch {}
      }
    }
  },
};
