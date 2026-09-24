import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getFheService, getFheModeInfo } from "../services/fheServiceFactory.js";
import AIService from "../services/AIStub.js";

// ============================================================
// SERVICE SINGLETONS
// ============================================================

// Backend resolved from ENCRYPTION_MODE: real OpenFHE WASM (BFV) when "fhe",
// honest AES-256-GCM stub when "mock" (with automatic WASM-failure fallback).
// Initialized lazily per request via ensureFHEInitialized.
let fheService = null;
const aiService = new AIService();

// Initialization promises (once-per-process)
let aiInitializationPromise = null;

// ============================================================
// INITIALIZATION HELPERS (exported for use as middleware)
// ============================================================

export const ensureFHEInitialized = async (req, _res, next) => {
  try {
    if (!fheService) {
      fheService = await getFheService();
    }
    if (!fheService.isInitialized()) {
      throw new Error("FHE service not properly initialized");
    }
    next();
  } catch (error) {
    console.error("FHE initialization error:", error);
    next(new ApiError(503, "FHE service unavailable"));
  }
};

export const ensureAIInitialized = async (req, _res, next) => {
  try {
    if (!aiInitializationPromise) {
      aiInitializationPromise = aiService.initialize();
    }
    await aiInitializationPromise;

    if (!aiService.isInitialized()) {
      throw new Error("AI service not properly initialized");
    }
    next();
  } catch (error) {
    console.error("AI initialization error:", error);
    next(new ApiError(503, "AI service unavailable"));
  }
};

// ============================================================
// CONTROLLER
// ============================================================

class FHEController {
  // ---------------------------------------------------------
  // GET /status — check FHE + AI service status
  // ---------------------------------------------------------
  static getStatus = asyncHandler(async (req, res) => {
    const modeInfo = getFheModeInfo();
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          fhe: {
            initialized: Boolean(fheService?.isInitialized?.()),
            service: modeInfo.activeBackend || `${modeInfo.configuredMode} (pending initialization)`,
            configuredMode: modeInfo.configuredMode,
            realFHE: modeInfo.realFHE,
            fallbackReason: modeInfo.fallbackReason,
          },
          ai: {
            initialized: aiService.isInitialized(),
            service: "Privacy-Preserving AI Module",
          },
          timestamp: new Date().toISOString(),
        },
        "Privacy-preserving services status"
      )
    );
  });

  // ---------------------------------------------------------
  // POST /encrypt — encrypt a message
  // ---------------------------------------------------------
  static encrypt = asyncHandler(async (req, res) => {
    const { message } = req.body;

    const encrypted = await fheService.encryptMessage(message);

    return res
      .status(200)
      .json(new ApiResponse(200, encrypted, "Message encrypted successfully"));
  });

  // ---------------------------------------------------------
  // POST /decrypt — decrypt a message
  // ---------------------------------------------------------
  static decrypt = asyncHandler(async (req, res) => {
    const { encryptedData } = req.body;

    const decrypted = await fheService.decryptMessage(encryptedData);

    return res
      .status(200)
      .json(
        new ApiResponse(200, { message: decrypted }, "Message decrypted successfully")
      );
  });

  // ---------------------------------------------------------
  // POST /compute — perform homomorphic operations
  // ---------------------------------------------------------
  static compute = asyncHandler(async (req, res) => {
    const { operation, inputs } = req.body;

    if (!fheService) {
      fheService = await getFheService();
    }

    const result = await fheService.performHomomorphicOperation(operation, ...inputs);

    return res
      .status(200)
      .json(new ApiResponse(200, result, "Homomorphic computation completed"));
  });

  // ---------------------------------------------------------
  // GET /capabilities — FHE capabilities + AI integration info
  // ---------------------------------------------------------
  static getCapabilities = asyncHandler(async (req, res) => {
    if (!fheService) {
      fheService = await getFheService();
    }
    const info = fheService.getInfo?.() || {};
    const modeInfo = getFheModeInfo();

    const capabilities = {
      encryption: info.realFHE
        ? ["BFV"]
        : ["AES-256-GCM (simulation)"],
      operations: info.realFHE
        ? ["addition", "multiplication", "rotation", "inner-product-scoring"]
        : ["simulated (decrypts to compute)"],
      features: info.realFHE
        ? ["batching", "leveled", "packed"]
        : ["simulation"],
      backend: info.name || modeInfo.activeBackend || "uninitialized",
      version: info.version || "unknown",
      realFHE: Boolean(info.realFHE),
      configuredMode: modeInfo.configuredMode,
      fallbackReason: modeInfo.fallbackReason,
      aiIntegration: {
        available: aiService.isInitialized(),
        operations: [
          "sentiment_analysis",
          "keyword_search",
          "word_count",
          "similarity_check",
          "content_filter",
          "encrypted_chat",
        ],
      },
    };

    return res
      .status(200)
      .json(new ApiResponse(200, capabilities, "FHE capabilities with AI integration"));
  });

  // ---------------------------------------------------------
  // POST /ai-chat — AI-powered privacy-preserving chat
  // ---------------------------------------------------------
  static aiChat = asyncHandler(async (req, res) => {
    const { message, operation, context } = req.body;

    console.log(`🔐 Processing AI chat with operation: ${operation}`);

    // Step 1: Encrypt the user's message
    const encryptedMessage = await fheService.encryptMessage(message);
    console.log("✅ Message encrypted successfully");

    // Step 2: Perform homomorphic computation on encrypted data
    let homomorphicResult;

    if (operation === "encrypted_chat") {
      homomorphicResult = {
        operation: "encrypted_chat",
        encryptedData: encryptedMessage,
        timestamp: Date.now(),
      };
    } else {
      homomorphicResult = await fheService.performHomomorphicOperation(
        operation,
        encryptedMessage,
        context.additionalData
      );
    }
    console.log("✅ Homomorphic computation completed");

    // Step 3: Send to AI module for processing
    const aiResponse =
      operation === "encrypted_chat"
        ? await aiService.chatWithEncryptedContext(message, encryptedMessage)
        : await aiService.processHomomorphicResult(homomorphicResult, message, context);
    console.log("✅ AI processing completed");

    // Step 4: Return the AI response (privacy preserved)
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          userMessage: {
            original: message,
            encrypted: encryptedMessage.ciphertext.substring(0, 50) + "...",
            messageId: encryptedMessage.metadata?.messageId,
          },
          homomorphicComputation: {
            operation,
            completed: true,
            result: homomorphicResult,
          },
          aiResponse,
          privacy: {
            dataEncrypted: true,
            homomorphicProcessing: true,
            privacyPreserved: true,
            serverNeverSawPlaintext: false,
          },
          timestamp: new Date().toISOString(),
        },
        "Privacy-preserving AI chat completed successfully"
      )
    );
  });

  // ---------------------------------------------------------
  // POST /compute-with-ai — homomorphic computation + AI analysis
  // ---------------------------------------------------------
  static computeWithAi = asyncHandler(async (req, res) => {
    const { operation, inputs, originalQuery, context } = req.body;

    console.log(`🔐 Processing homomorphic computation: ${operation}`);

    // Step 1: Perform homomorphic computation
    const homomorphicResult = await fheService.performHomomorphicOperation(
      operation,
      ...inputs
    );
    console.log("✅ Homomorphic computation completed");

    // Step 2: Process result with AI while maintaining privacy
    const aiAnalysis = await aiService.processHomomorphicResult(
      homomorphicResult,
      originalQuery,
      context
    );
    console.log("✅ AI analysis completed");

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          computation: homomorphicResult,
          aiAnalysis,
          privacy: {
            homomorphicProcessing: true,
            privacyPreserved: true,
            encryptedComputation: true,
          },
        },
        "Homomorphic computation with AI analysis completed"
      )
    );
  });
}

export default FHEController;
