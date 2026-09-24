/**
 * FHE chat integration tests.
 *
 * Covers:
 *  - AES-256-GCM at-rest seal/unseal roundtrip (fheChatActive gate)
 *  - fheServiceFactory mode resolution and fallback hook
 *  - Real OpenFHE BFV homomorphic scoring (loads the actual WASM module)
 *  - fheChat.selectContextWithFhe ranking + graceful degradation
 *
 * Note: the suite runs under Node ESM (`--experimental-vm-modules`) where the
 * `jest` global is unavailable, so mode switching uses env vars read at call
 * time plus the factory's __resetFheFactoryForTests hook instead of
 * jest.resetModules().
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import {
  fheChatActive,
  sealMessageForStorage,
  unsealMessageFromStorage,
  selectContextWithFhe,
} from "../services/fheChat.js";
import {
  getFheService,
  getFheModeInfo,
  __resetFheFactoryForTests,
} from "../services/fheServiceFactory.js";

const PREV_MODE = process.env.ENCRYPTION_MODE;
const PREV_KEY = process.env.ENCRYPTION_KEY;

afterAll(() => {
  process.env.ENCRYPTION_MODE = PREV_MODE;
  if (PREV_KEY === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = PREV_KEY;
  __resetFheFactoryForTests();
});

// ------------------------------------------------------------
// At-rest layer (mock mode → seal/unseal are pass-through)
// ------------------------------------------------------------

describe("fheChat at-rest layer (mock mode)", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_MODE = "mock";
  });

  it("is inactive in mock mode", () => {
    expect(fheChatActive()).toBe(false);
  });

  it("passes messages through unsealed in mock mode", () => {
    const msg = {
      id: "m1",
      role: "user",
      content: "hello secret world",
      createdAt: new Date(),
    };
    const sealed = sealMessageForStorage(msg);
    expect(sealed.content).toBe("hello secret world");
    expect(sealed.fhe.enabled).toBe(false);

    const unsealed = unsealMessageFromStorage(sealed);
    expect(unsealed.content).toBe("hello secret world");
  });

  it("selectContextWithFhe degrades to recency in mock mode", async () => {
    const history = [
      { role: "user", content: "old unrelated message" },
      { role: "assistant", content: "old reply" },
    ];
    const result = await selectContextWithFhe(history, "new question");
    expect(result.fhe.enabled).toBe(false);
    expect(result.fhe.reason).toBe("mode-mock");
    expect(result.messages).toHaveLength(2);
  });
});

// ------------------------------------------------------------
// At-rest layer (fhe mode → real envelope encryption)
// ------------------------------------------------------------

describe("fheChat at-rest layer (fhe mode)", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_MODE = "fhe";
    process.env.ENCRYPTION_KEY =
      process.env.ENCRYPTION_KEY || "test-key-for-fhe-chat-at-rest";
  });

  it("is active in fhe mode", () => {
    expect(fheChatActive()).toBe(true);
  });

  it("seals content into an AES-256-GCM envelope and unseals it", () => {
    const original = "confidential chat content 123";
    const sealed = sealMessageForStorage({
      id: "m2",
      role: "assistant",
      content: original,
      createdAt: new Date(),
    });

    expect(sealed.content).not.toContain(original);
    expect(sealed.fhe.enabled).toBe(true);
    expect(sealed.fhe.scheme).toBe("AES-256-GCM+HKDF");

    const envelope = JSON.parse(sealed.content);
    expect(envelope.alg).toBe("AES-256-GCM+HKDF");
    expect(envelope.ct).toBeTruthy();
    expect(envelope.nonce).toBeTruthy();
    expect(envelope.tag).toBeTruthy();

    const unsealed = unsealMessageFromStorage(sealed);
    expect(unsealed.content).toBe(original);
  });

  it("handles corrupt envelopes without throwing", () => {
    const broken = {
      id: "m4",
      role: "user",
      content: "not-json{",
      fhe: { enabled: true, scheme: "AES-256-GCM+HKDF" },
    };
    const result = unsealMessageFromStorage(broken);
    expect(result.fhe.decryptError).toBe(true);
    expect(result.content).toBe("not-json{");
  });

  it("unseals legacy plaintext messages untouched", () => {
    const legacy = { id: "m5", role: "user", content: "plain old message" };
    const result = unsealMessageFromStorage(legacy);
    expect(result.content).toBe("plain old message");
  });
});

// ------------------------------------------------------------
// Factory resolution
// ------------------------------------------------------------

describe("fheServiceFactory", () => {
  it("resolves FHEStub in mock mode", async () => {
    process.env.ENCRYPTION_MODE = "mock";
    __resetFheFactoryForTests();
    const svc = await getFheService();
    expect(svc.getInfo().realFHE).toBe(false);
    expect(getFheModeInfo().activeBackend).toContain("Stub");
  });

  it("always resolves a usable backend in fhe mode (real WASM or stub fallback)", async () => {
    process.env.ENCRYPTION_MODE = "fhe";
    __resetFheFactoryForTests();
    const svc = await getFheService();
    // Contract: never throws — returns a working service whether the
    // Emscripten module loaded (realFHE: true) or the factory fell back
    // to the stub (realFHE: false).
    expect(svc.isInitialized()).toBe(true);
    expect(typeof svc.encryptMessage).toBe("function");
    expect(typeof svc.performHomomorphicOperation).toBe("function");
    const info = getFheModeInfo();
    expect(info.configuredMode).toBe("fhe");
    expect(info.activeBackend).toBeTruthy();
  }, 60000);
});

// ------------------------------------------------------------
// Real OpenFHE service (loads actual WASM)
// ------------------------------------------------------------

/**
 * The Emscripten OpenFHE module cannot load inside Jest's ESM VM sandbox
 * (dynamic import + fetch-based WASM instantiation). These checks therefore
 * run as a child-process integration test via fheSelftestRunner.mjs, which
 * exercises the real service and prints a JSON verdict.
 */
describe("OpenFheService (real WASM, via child-process runner)", () => {
  let output = "";
  let code = 0;

  beforeAll(async () => {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["src/tests/fheSelftestRunner.mjs"],
      { timeout: 120000, encoding: "utf8" },
    );
    output = stdout;
    try {
      code = JSON.parse(output.split("\n").filter(Boolean).pop()).ok ? 0 : 1;
    } catch {
      code = 1;
    }
  }, 150000);

  it("passes the full real-WASM self-test", () => {
    expect(code).toBe(0);
  });

  it("confirms real BFV roundtrip, scoring, and retrieval in the runner output", () => {
    const verdict = JSON.parse(output.split("\n").filter(Boolean).pop());
    expect(verdict.ok).toBe(true);
    expect(verdict.results.roundtrip).toBe(true);
    expect(verdict.results.scoring.hit).toBeGreaterThan(0);
    expect(verdict.results.scoring.miss).toBe(0);
    expect(verdict.results.keywordSearch).toEqual(
      expect.arrayContaining(["revenue", "sales"]),
    );
    expect(verdict.results.retrieval.selected).toBeGreaterThan(0);
    expect(verdict.results.atRest).toBe(true);
  });
});

// ------------------------------------------------------------
// Homomorphic retrieval over chat history
// ------------------------------------------------------------

describe("fheChat.selectContextWithFhe (fhe mode, real scoring)", () => {
  it("selects on-topic turns when a scoring backend is available, else degrades cleanly", async () => {
    const history = [
      { role: "user", content: "tell me about photosynthesis in plants" },
      { role: "assistant", content: "photosynthesis converts light into energy" },
      { role: "user", content: "what is my favorite color again" },
      { role: "assistant", content: "you mentioned blue is your favorite color" },
      { role: "user", content: "how tall is mount everest exactly" },
      { role: "assistant", content: "mount everest is 8849 meters tall" },
    ];
    const result = await selectContextWithFhe(history, "photosynthesis", {
      maxTurns: 2,
    });

    expect(result.messages).toHaveLength(2);
    expect(typeof result.fhe.enabled).toBe("boolean");
    // The real-WASM path is asserted in the child-process runner tests below
    // (Jest's sandbox cannot load the module — here we verify the fallback
    // behavior is clean degradation, never a thrown error).
    if (result.fhe.enabled) {
      expect(result.fhe.computedOnCiphertext).toBe(true);
      const contents = result.messages.map((m) => m.content).join(" ");
      expect(contents).toContain("photosynthesis");
    } else {
      expect(result.fhe.reason).toBeTruthy();
    }
  });

  it("returns chronological order for the selected context", async () => {
    const history = [
      { role: "user", content: "kubernetes pods scheduling" },
      { role: "assistant", content: "pods are scheduled onto nodes by the scheduler" },
      { role: "user", content: "what about kubernetes services" },
      { role: "assistant", content: "services expose pods over the network" },
    ];
    const result = await selectContextWithFhe(history, "kubernetes pods", {
      maxTurns: 3,
    });
    const order = result.messages.map((m) => history.indexOf(m));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("never throws when a message has odd content", async () => {
    const history = [{ role: "user", content: 42 }];
    const result = await selectContextWithFhe(history, "query", {
      maxTurns: 4,
    });
    expect(result.messages.length).toBeGreaterThanOrEqual(0);
    expect(typeof result.fhe.enabled).toBe("boolean");
  });
});
