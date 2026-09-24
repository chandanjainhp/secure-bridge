/**
 * Standalone FHE integration runner (real OpenFHE WASM).
 *
 * Jest's ESM VM sandbox cannot load the Emscripten OpenFHE module, so
 * fheChat.test.js executes this file with plain Node and asserts on the
 * JSON it prints. Exit code 0 = all checks passed.
 */

import {
  sealMessageForStorage,
  unsealMessageFromStorage,
  selectContextWithFhe,
} from "../services/fheChat.js";
import OpenFheService from "../services/OpenFheService.js";

const results = {};
const fail = (msg) => {
  console.log(JSON.stringify({ ok: false, stage: Object.keys(results), error: msg }));
  process.exit(1);
};

try {
  // 1. Real service lifecycle
  const svc = new OpenFheService();
  await svc.initialize();
  if (!svc.isInitialized()) fail("service did not initialize");
  results.initialized = true;

  // 2. BFV roundtrip
  const text = "runner roundtrip message";
  const envelope = await svc.encryptMessage(text);
  if (envelope.algorithm !== "OpenFHE WebAssembly (BFV)") fail("bad algorithm");
  const out = await svc.decryptMessage(envelope);
  if (out !== text) fail(`roundtrip mismatch: ${JSON.stringify(out)}`);
  results.roundtrip = true;

  // 3. Homomorphic scoring discriminates
  const corpus =
    "the database migration failed during the connection window, migration retries exhausted";
  const hit = await svc.homomorphicKeywordScore(corpus, "database migration");
  const partial = await svc.homomorphicKeywordScore(corpus, "database connection");
  const miss = await svc.homomorphicKeywordScore(corpus, "quantum banana");
  if (!(hit.score > 0)) fail(`hit score ${hit.score}`);
  if (!(hit.score > miss.score)) fail("hit <= miss");
  if (!(partial.score > miss.score)) fail("partial <= miss");
  if (miss.score !== 0) fail(`miss score ${miss.score}`);
  if (!hit.computedOnCiphertext) fail("not computed on ciphertext");
  results.scoring = { hit: hit.score, partial: partial.score, miss: miss.score };

  // 4. keyword_search on ciphertexts
  const env2 = await svc.encryptMessage(
    "quarterly revenue exceeded projections due to strong sales",
  );
  const kw = await svc.performHomomorphicOperation("keyword_search", env2, "revenue, sales, missing");
  if (!kw.metadata.computedOnCiphertext) fail("keyword_search not on ciphertext");
  if (!kw.result.found.includes("revenue") || !kw.result.found.includes("sales")) {
    fail(`keyword_search found: ${JSON.stringify(kw.result.found)}`);
  }
  if (kw.result.found.includes("missing")) fail("false positive in keyword_search");
  results.keywordSearch = kw.result.found;

  // 5. Honest decrypt-then-compute labeling
  const wc = await svc.performHomomorphicOperation("word_count", envelope);
  if (wc.metadata.computedOnCiphertext !== false || wc.metadata.computedOnPlaintext !== true) {
    fail("word_count labeling dishonest");
  }
  results.wordCount = wc.result.wordCount;

  // 6. Unknown handle rejection
  try {
    await svc.decryptMessage({ ciphertext: "bfv:999999" });
    fail("unknown handle did not throw");
  } catch (e) {
    if (!/Unknown BFV ciphertext handle/.test(e.message)) fail(`wrong error: ${e.message}`);
  }
  results.handleRejection = true;

  // 7. FHE-mode at-rest roundtrip (via fheChat, ENCRYPTION_MODE=fhe)
  process.env.ENCRYPTION_MODE = "fhe";
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "runner-key";
  const sealed = sealMessageForStorage({ id: "r1", role: "user", content: text, createdAt: new Date() });
  if (sealed.content.includes(text)) fail("content not sealed");
  const unsealed = unsealMessageFromStorage(sealed);
  if (unsealed.content !== text) fail("at-rest roundtrip mismatch");
  results.atRest = true;

  // 8. Homomorphic retrieval ranks on-topic history
  const history = [
    { role: "user", content: "tell me about photosynthesis in plants" },
    { role: "assistant", content: "photosynthesis converts light into energy" },
    { role: "user", content: "what is my favorite color again" },
    { role: "assistant", content: "you mentioned blue is your favorite color" },
    { role: "user", content: "how tall is mount everest exactly" },
    { role: "assistant", content: "mount everest is 8849 meters tall" },
  ];
  const sel = await selectContextWithFhe(history, "photosynthesis", { maxTurns: 2 });
  if (!sel.fhe.enabled) fail(`retrieval degraded: ${sel.fhe.reason}`);
  if (!sel.fhe.computedOnCiphertext) fail("retrieval not on ciphertext");
  const joined = sel.messages.map((m) => m.content).join(" ");
  if (!joined.includes("photosynthesis")) fail("missed on-topic turn");
  if (joined.includes("everest")) fail("picked unrelated turn");
  const order = sel.messages.map((m) => history.indexOf(m));
  if (JSON.stringify([...order].sort((a, b) => a - b)) !== JSON.stringify(order)) {
    fail("chronological order broken");
  }
  results.retrieval = { selected: sel.fhe.selectedTurns, top: sel.fhe.topScore };

  console.log(JSON.stringify({ ok: true, results }));
  process.exit(0);
} catch (error) {
  fail(String(error && error.stack ? error.stack : error).slice(0, 600));
}
