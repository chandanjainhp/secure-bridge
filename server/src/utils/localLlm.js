import dns from "node:dns/promises";
import net from "node:net";

export function normalizeLocalLlmUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Local LLM base URL is required");
  }

  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Local LLM base URL must use HTTP or HTTPS");
  }
  if (url.username || url.password || url.hash) {
    throw new Error(
      "Local LLM base URL cannot contain credentials or fragments",
    );
  }
  if (url.pathname.endsWith("/v1")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

export async function assertLocalLlmHost(value) {
  const url = new URL(normalizeLocalLlmUrl(value));
  const addresses = net.isIP(url.hostname)
    ? [url.hostname]
    : (await dns.lookup(url.hostname, { all: true })).map(
        ({ address }) => address,
      );

  if (
    !addresses.length ||
    addresses.some((address) => !isPrivateAddress(address))
  ) {
    throw new Error(
      "Local LLM base URL must resolve to a private or loopback address",
    );
  }

  return url.toString().replace(/\/$/, "");
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [first, second] = address.split(".").map(Number);
    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}
