import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyJWT } from "./auth.middle.js";

/**
 * Accepts either a normal user JWT (attaches req.user) or a signed service
 * call — `X-Service-User` + `X-Service-Signature` (HMAC-SHA256 of the user id
 * with MCP_SERVICE_TOKEN).
 *
 * The service path exists for the MCP server's `search_project_context`
 * callback: the Express backend signs the chatting user's id when it opens
 * the MCP session, so the tool can read ONLY that user's data. The signature
 * is verified with a timing-safe compare; the resolved identity is a minimal
 * `{ _id }` — enough for the ownership-scoped queries downstream.
 */
export const verifyJWTOrService = asyncHandler(async (req, res, next) => {
  const userId = req.header("X-Service-User");
  const signature = req.header("X-Service-Signature");
  const token = process.env.MCP_SERVICE_TOKEN?.trim();

  if (userId && signature && token) {
    const expected = crypto
      .createHmac("sha256", token)
      .update(String(userId))
      .digest("hex");

    const a = Buffer.from(String(signature));
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      req.user = { _id: String(userId) };
      return next();
    }
    throw new ApiError(401, "Invalid service signature");
  }

  return verifyJWT(req, res, next);
});
