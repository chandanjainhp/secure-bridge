/**
 * FHE service factory — resolves the active backend from ENCRYPTION_MODE.
 *
 *  - "fhe"  → real OpenFheService (OpenFHE WASM, BFV). If the WASM module
 *             cannot load, falls back to FHEStub so the application still
 *             starts (mock-mode contract from the SPEC).
 *  - "mock" (default) → FHEStub (honest AES-256-GCM simulation).
 *
 * Both backends share the same surface: initialize / isInitialized /
 * encryptMessage / decryptMessage / performHomomorphicOperation / getInfo.
 *
 * The mode is re-read whenever the memoized service was resolved under a
 * different ENCRYPTION_MODE (supports tests and runtime env changes).
 */

import FHEStub from "./FHEStub.js";
import OpenFheService from "./OpenFheService.js";

const readMode = () => (process.env.ENCRYPTION_MODE || "mock").toLowerCase();

let _service = null;
let _serviceMode = null;
let _initPromise = null;
let _initMode = null;

async function _resolve(mode) {
  if (mode === "fhe") {
    try {
      const real = new OpenFheService();
      await real.initialize();
      console.log("🔐 FHE backend: REAL OpenFHE WASM (BFV)");
      return real;
    } catch (error) {
      console.error(
        "⚠️  OpenFHE WASM failed to initialize — falling back to FHEStub:",
        error.message,
      );
      const stub = new FHEStub();
      await stub.initialize();
      stub.fallbackReason = error.message;
      return stub;
    }
  }

  const stub = new FHEStub();
  await stub.initialize();
  console.log("🔐 FHE backend: FHEStub (ENCRYPTION_MODE=mock)");
  return stub;
}

/** Resolve (and memoize) the active FHE backend for the current mode. */
export async function getFheService() {
  const mode = readMode();
  if (_service && _serviceMode === mode) return _service;
  if (!_initPromise || _initMode !== mode) {
    _initMode = mode;
    _initPromise = _resolve(mode).then((svc) => {
      _service = svc;
      _serviceMode = mode;
      return svc;
    });
  }
  return _initPromise;
}

/** Synchronous best-effort info for status endpoints (null before resolve). */
export function getFheModeInfo() {
  const mode = readMode();
  if (!_service || _serviceMode !== mode) {
    return { configuredMode: mode, activeBackend: null, realFHE: false, fallbackReason: null };
  }
  const info = _service.getInfo?.() || {};
  return {
    configuredMode: mode,
    activeBackend: info.name || _service.constructor.name,
    realFHE: Boolean(info.realFHE),
    fallbackReason: _service.fallbackReason || null,
  };
}

/**
 * Test hook: discard the memoized backend so a later getFheService() call
 * re-resolves against the current ENCRYPTION_MODE. Not for production use.
 */
export function __resetFheFactoryForTests() {
  _service = null;
  _serviceMode = null;
  _initPromise = null;
  _initMode = null;
}
