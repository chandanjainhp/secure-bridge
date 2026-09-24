import { describe, expect, jest, test } from "@jest/globals";

jest.unstable_mockModule("../features/api-key/models/apikey.model.js", () => ({
  ApiKey: {},
}));

const { detectProvider, DEFAULT_MODELS } =
  await import("../utils/chat.providers.js");

describe("chat provider selection", () => {
  test("routes the LM Studio model to the local provider", () => {
    expect(detectProvider(DEFAULT_MODELS.local)).toEqual({
      provider: "local",
      model: "google/gemma-4-e4b",
    });
  });

  test("routes OpenAI models to OpenAI", () => {
    expect(detectProvider("openai/gpt-4-turbo")).toEqual({
      provider: "openai",
      model: "gpt-4-turbo",
    });
  });

  test("honors an explicit local provider", () => {
    expect(detectProvider("google/gemma-4-e4b", "local")).toEqual({
      provider: "local",
      model: "google/gemma-4-e4b",
    });
  });
});
