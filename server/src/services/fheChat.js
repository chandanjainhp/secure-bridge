/**
 * FHE Chat Integration — makes OpenFHE a real part of the chat pipeline.
 *
 * Two layers, both active when ENCRYPTION_MODE=fhe:
 *
 * 1. ENCRYPTION AT REST (AES-256-GCM)
 *    Message content is encrypted before it is written to MongoDB and
 *    decrypted transparently on read. The key is derived from ENCRYPTION_KEY
 *    (HKDF), so ciphertexts survive restarts — unlike the ephemeral BFV
 *    keypair, which is why BFV is not used for storage.
 *
 * 2. HOMOMORPHIC CONTEXT RETRIEVAL (OpenFHE BFV, real ciphertext math)
 *    When assembling the LLM prompt, the backend encrypts each historical
 *    message's word-bucket characteristic vector as a BFV ciphertext and
 *    ranks it against the current user message with
 *    EvalMultCipherPlaintext + a rotation-sum tree — all on ciphertexts.
 *    Only the scalar relevance scores are decrypted. The highest-scoring
 *    turns are then decrypted (AES layer) and included in the prompt.
 *
 *    Why: relevance selection over conversation history happens without the
 *    ranking pass ever reading message plaintexts into the scoring logic.
 *    The LLM call itself still receives plaintext — no FHE scheme can run
 *    an LLM on ciphertext.
 *
 * Failure policy: every helper here degrades gracefully. If the FHE backend
 * is unavailable, retrieval falls back to recency-based context and content
 * is stored in plaintext, with `fhe.enabled: false` reported so the UI can
 * surface the true state.
 */

import crypto from "crypto";
import { getFheService, getFheModeInfo } from "./fheServiceFactory.js";

// ------------------------------------------------------------
// At-rest encryption (AES-256-GCM, restart-safe key)
// ------------------------------------------------------------

const HKDF_INFO = "secure-bridge:fhe-chat-at-rest";
let _restKeyCache = null;

function atRestKey() {
  if (_restKeyCache) return _restKeyCache;
  const source =
    process.env.ENCRYPTION_KEY || process.env.FHE_STUB_KEY || "";
  if (!source) {
    throw new Error(
      "ENCRYPTION_KEY is not set — cannot derive the FHE chat at-rest key",
    );
  }
  _restKeyCache = crypto.hkdfSync(
    "sha256",
    Buffer.from(source, "utf8"),
    Buffer.alloc(0),
    Buffer.from(HKDF_INFO, "utf8"),
    32,
  );
  return _restKeyCache;
}

export function fheChatActive() {
  return (process.env.ENCRYPTION_MODE || "mock").toLowerCase() === "fhe";
}

/** Encrypt message content for storage. Returns an envelope object. */
export function encryptForRest(plaintext) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(atRestKey()),
    nonce,
  );
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  return {
    alg: "AES-256-GCM+HKDF",
    ct: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/** Decrypt an at-rest envelope. Throws if the envelope or key is invalid. */
export function decryptFromRest(envelope) {
  if (typeof envelope === "string") return envelope; // legacy plaintext
  if (!envelope || !envelope.ct) {
    throw new Error("Invalid at-rest envelope");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(atRestKey()),
    Buffer.from(envelope.nonce, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(envelope.ct, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

// ------------------------------------------------------------
// Homomorphic context retrieval (real BFV scoring)
// ------------------------------------------------------------

/** Default context size for prompt assembly. */
const DEFAULT_CONTEXT_TURNS = 8;

/**
 * Rank history messages against the current user message using real
 * homomorphic scoring, then return the selected turns.
 *
 * @param {Array<{role:string, content:string}>} history — oldest→newest
 * @param {string} currentMessage — the user's new message
 * @param {object} [opts]
 * @returns {Promise<{messages: Array<{role,content}>, fhe: object}>}
 */
export async function selectContextWithFhe(history, currentMessage, opts = {}) {
  const maxTurns = opts.maxTurns || DEFAULT_CONTEXT_TURNS;
  const enabled = fheChatActive();

  if (!enabled || !history.length) {
    return {
      messages: history.slice(-maxTurns),
      fhe: { enabled: false, reason: enabled ? "empty-history" : "mode-mock" },
    };
  }

  let fhe;
  try {
    fhe = await getFheService();
    if (!fhe.homomorphicKeywordScore) throw new Error("backend lacks scoring");
  } catch (error) {
    return {
      messages: history.slice(-maxTurns),
      fhe: { enabled: false, reason: `backend-unavailable: ${error.message}` },
    };
  }

  try {
    const started = Date.now();
    const scored = [];
    for (let i = 0; i < history.length; i += 1) {
      const m = history[i];
      if (m.role === "system" || !m.content) continue;
      const { score } = await fhe.homomorphicKeywordScore(
        m.content,
        currentMessage,
      );
      scored.push({ message: m, score, originalIndex: i });
    }

    // Prefer higher score; break ties toward more recent turns.
    scored.sort(
      (a, b) => b.score - a.score || b.originalIndex - a.originalIndex,
    );

    const picked = scored.slice(0, maxTurns).map((s) => s.message);
    // Restore chronological order for the prompt.
    picked.sort((a, b) => history.indexOf(a) - history.indexOf(b));

    return {
      messages: picked,
      fhe: {
        enabled: true,
        scheme: "BFV",
        computedOnCiphertext: true,
        scoredTurns: scored.length,
        selectedTurns: picked.length,
        topScore: scored[0]?.score ?? 0,
        durationMs: Date.now() - started,
      },
    };
  } catch (error) {
    return {
      messages: history.slice(-maxTurns),
      fhe: { enabled: false, reason: `scoring-failed: ${error.message}` },
    };
  }
}

// ------------------------------------------------------------
// Message storage helpers (encrypt-on-write / decrypt-on-read)
// ------------------------------------------------------------

/**
 * Prepare a message for storage. In fhe mode, content becomes an at-rest
 * envelope and the message carries { encrypted: true, fhe } metadata.
 */
export function sealMessageForStorage(message) {
  if (!fheChatActive()) {
    return { ...message, fhe: { enabled: false } };
  }
  try {
    return {
      ...message,
      content: JSON.stringify(encryptForRest(message.content)),
      fhe: {
        enabled: true,
        scheme: "AES-256-GCM+HKDF",
        encryptedAt: new Date().toISOString(),
      },
    };
  } catch {
    // Never lose the message because of an encryption failure.
    return { ...message, fhe: { enabled: false, error: "encrypt-failed" } };
  }
}

/**
 * Restore a stored message to plaintext for reads. Handles legacy plaintext
 * content and malformed envelopes without throwing.
 */
export function unsealMessageFromStorage(message) {
  if (!message) return message;
  const meta = message.fhe;
  if (!meta?.enabled) return { ...message, content: message.content };
  try {
    return { ...message, content: decryptFromRest(JSON.parse(message.content)) };
  } catch {
    return {
      ...message,
      content: message.content, // leave as-is (corrupt/legacy content)
      fhe: { ...(meta || {}), decryptError: true },
    };
  }
}

/** Summary info for status surfaces. */
export function fheChatInfo() {
  const modeInfo = getFheModeInfo();
  return {
    chatIntegration: fheChatActive(),
    backend: modeInfo.activeBackend,
    realFHE: modeInfo.realFHE,
    atRest: "AES-256-GCM+HKDF (ENCRYPTION_KEY-derived)",
    homomorphicRetrieval: modeInfo.realFHE ? "BFV word-bucket scoring" : "unavailable in mock mode",
  };
}
