import { assertLocalLlmHost, normalizeLocalLlmUrl } from "../utils/localLlm.js";
import { createApiKeySchema } from "../validation/apikey.validation.js";

describe("local LLM connection contract", () => {
  it("normalizes compatible API base URLs", () => {
    expect(normalizeLocalLlmUrl("http://127.0.0.1:1234/v1/")).toBe(
      "http://127.0.0.1:1234/v1",
    );
  });

  it("rejects credentials and fragments in the endpoint", () => {
    expect(() =>
      normalizeLocalLlmUrl("http://user:pass@127.0.0.1:1234/v1"),
    ).toThrow("credentials");
    expect(() =>
      normalizeLocalLlmUrl("http://127.0.0.1:1234/v1#fragment"),
    ).toThrow("fragments");
  });

  it("allows loopback hosts and rejects public IPs", async () => {
    await expect(assertLocalLlmHost("http://127.0.0.1:1234/v1")).resolves.toBe(
      "http://127.0.0.1:1234/v1",
    );
    await expect(assertLocalLlmHost("http://8.8.8.8:1234/v1")).rejects.toThrow(
      "private or loopback",
    );
  });

  it("accepts a tokenless local connection payload", () => {
    const result = createApiKeySchema.safeParse({
      body: {
        name: "Local model",
        provider: "local",
        permissions: ["chat.access", "chat.completions"],
        settings: {
          localLlm: {
            baseUrl: "http://127.0.0.1:1234/v1",
            model: "qwen2.5-7b-instruct",
          },
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
