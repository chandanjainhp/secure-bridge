import { apiClient } from "@/shared/api/client";
const unwrap = (r) => r?.data ?? r;
export const apiKeyApi = {
  async getApiKeys() {
    return unwrap(await apiClient.fetch("/api-key"));
  },
  async getApiKey() {
    const result = await this.getApiKeys();
    const first = result?.apiKeys?.[0];
    const local = result?.apiKeys?.find(
      (item) => item.provider === "local" || item.externalProvider === "local",
    );
    return {
      ...result,
      hasKey: !!first,
      maskedKey: first?.maskedKey || first?.keyPrefix || null,
      provider: first?.provider || first?.externalProvider || "openai",
      localConnection: local
        ? {
            id: local._id || local.id,
            name: local.name,
            maskedToken: local.maskedKey || local.keyPrefix || null,
            ...local.settings?.localLlm,
          }
        : null,
    };
  },
  async saveApiKey(provider, key, localConnection) {
    const body = {
      name:
        provider === "local"
          ? localConnection?.name || "Local LLM"
          : `${provider} key`,
      provider,
      externalKey: key || undefined,
      permissions: ["chat.access", "chat.completions"],
    };
    if (provider === "local") {
      body.settings = {
        localLlm: {
          baseUrl: localConnection.baseUrl,
          model: localConnection.model,
          enabled: localConnection.enabled !== false,
        },
      };
    }
    const endpoint =
      provider === "local" && localConnection?.id
        ? `/api-key/${localConnection.id}`
        : "/api-key";
    const method = endpoint === "/api-key" ? "POST" : "PATCH";
    return unwrap(
      await apiClient.fetch(endpoint, {
        method,
        body: JSON.stringify(
          method === "PATCH"
            ? {
                name: body.name,
                settings: body.settings,
                ...(body.externalKey ? { externalKey: body.externalKey } : {}),
              }
            : body,
        ),
      }),
    );
  },
  async deleteApiKey(keyId) {
    if (!keyId) {
      const result = await this.getApiKeys();
      keyId = result?.apiKeys?.[0]?._id || result?.apiKeys?.[0]?.id;
    }
    return keyId
      ? unwrap(await apiClient.fetch(`/api-key/${keyId}`, { method: "DELETE" }))
      : null;
  },
};
