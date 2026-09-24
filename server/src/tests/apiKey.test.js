import request from "supertest";
import { app } from "../app.js";
import { User } from "../models/user.model.js";
import { ApiKey } from "../features/api-key/models/apikey.model.js";
import jwt from "jsonwebtoken";
import { jest } from "@jest/globals";

jest.mock("axios", () => ({
  get: jest.fn(() => Promise.resolve({ status: 200, data: { data: [] } })),
}));

describe("API Key API", () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    await User.deleteMany({});
    await ApiKey.deleteMany({});

    const user = await User.create({
      fullName: "API Key Test",
      email: "apikey-test@example.com",
      username: "apikeytest",
      password: "password123",
    });
    userId = user._id;

    authToken = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await ApiKey.deleteMany({});
  });

  it("should save an API key", async () => {
    const externalKey = "sk-proj-123456789012345678901234";
    const res = await request(app)
      .post("/api/v1/api-key")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "OpenAI Test Key",
        provider: "openai",
        externalKey,
        permissions: ["chat.access", "chat.completions"],
      });

    if (res.status !== 200) {
      console.log("Save API key response:", JSON.stringify(res.body, null, 2));
    }

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("API key created successfully");
    expect(res.body.data.maskedKey).toBeDefined();

    const storedKey = await ApiKey.findOne({ name: "OpenAI Test Key" }).select(
      "+externalKeyEncrypted +encryptionIV +encryptionTag",
    );
    expect(storedKey.externalKeyEncrypted).toBeDefined();
    expect(storedKey.externalKeyEncrypted).not.toBe(externalKey);
    expect(storedKey.encryptionIV).toBeDefined();
    expect(storedKey.encryptionTag).toBeDefined();
    expect(
      ApiKey.decryptExternalKey({
        encrypted: storedKey.externalKeyEncrypted,
        iv: storedKey.encryptionIV,
        tag: storedKey.encryptionTag,
      }),
    ).toBe(externalKey);
  });

  it("should get masked API key", async () => {
    const res = await request(app)
      .get("/api/v1/api-key")
      .set("Authorization", `Bearer ${authToken}`);

    if (res.status !== 200) {
      console.log("Get API key response:", JSON.stringify(res.body, null, 2));
    }

    expect(res.status).toBe(200);
    expect(res.body.data.apiKeys).toHaveLength(1);
    expect(res.body.data.apiKeys[0].externalKeyEncrypted).toBeUndefined();
    expect(res.body.data.apiKeys[0].encryptionIV).toBeUndefined();
    expect(res.body.data.apiKeys[0].encryptionTag).toBeUndefined();

    const keyId = res.body.data.apiKeys[0]._id;
    const deleteResponse = await request(app)
      .delete(`/api/v1/api-key/${keyId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.message).toBe("API key deleted successfully");
  });
});
