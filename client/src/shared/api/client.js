import { requestAudit } from "../utils/requestAudit";
import { toast } from "@/shared/hooks/useToast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const authErrorHandlers = new Set();
const isBodyString = (body) => typeof body === "string";
const serializeBody = (body) =>
  isBodyString(body) ? body : JSON.stringify(body);

// Friendly titles per HTTP status for centrally-toasted API errors.
const ERROR_TITLES = {
  400: "Invalid request",
  402: "Payment required",
  403: "Not allowed",
  404: "Not found",
  409: "Conflict",
  413: "Too large",
  422: "Validation failed",
  429: "Rate limit exceeded",
  500: "Server error",
  502: "Bad gateway",
  503: "Service unavailable",
};

class ApiClient {
  constructor() {
    this.token = null;
    this.refreshPromise = null;
  }
  setToken(token) {
    this.token = token || null;
  }
  setRefreshToken() {
    /* Refresh token is httpOnly and is never exposed to JavaScript. */
  }
  getToken() {
    return this.token;
  }
  clearToken() {
    this.token = null;
  }
  async getHeaders(extra = {}, hasBody = false) {
    const headers = { ...extra };
    if (hasBody && !headers["Content-Type"] && !headers["content-type"])
      headers["Content-Type"] = "application/json";
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }
  async getFetchOptions(method, body) {
    return {
      method,
      headers: await this.getHeaders({}, !!body),
      body: body ? serializeBody(body) : undefined,
      credentials: "include",
    };
  }
  async handleResponse(response, { silent = false } = {}) {
    const start = Date.now();
    const endpoint = response.url.startsWith(API_URL)
      ? response.url.slice(API_URL.length)
      : response.url;
    let data = null;
    const type = response.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid JSON response from server");
      }
    }
    requestAudit.logRequestComplete(
      endpoint,
      response.headers.get("x-method") || "UNKNOWN",
      response.status,
      Date.now() - start,
    );
    if (!response.ok) {
      const error = new Error(
        data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`,
      );
      error.status = response.status;
      error.endpoint = endpoint;
      // Surface every API failure as a toast unless the caller opts out
      // (pass { silent: true } fetch option, or it's 401/403 which auth
      // flows handle themselves with logout + redirect). Page-level catch
      // blocks should not re-toast the same error.
      const quiet =
        silent ||
        error.status === 401 ||
        error.status === 403 ||
        error.silent;
      if (!quiet) {
        toast({
          title: ERROR_TITLES[error.status] || "Request failed",
          description: error.message,
          variant: "destructive",
        });
        error.toastShown = true;
      }
      throw error;
    }
    return data;
  }
  async refreshSession() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await this.handleResponse(response);
      const token = data?.data?.accessToken;
      if (!token)
        throw Object.assign(new Error("Session refresh failed"), {
          status: 401,
        });
      this.setToken(token);
      return token;
    })().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }
  async fetch(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const method = options.method || "GET";
    const isFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    const requestOptions = {
      ...options,
      credentials: "include",
      body:
        isFormData || isBodyString(options.body)
          ? options.body
          : options.body
            ? serializeBody(options.body)
            : undefined,
      headers: isFormData
        ? {
            ...(options.headers || {}),
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          }
        : await this.getHeaders(options.headers || {}, !!options.body),
    };
    requestAudit.logRequestStart(endpoint, method);
    let response = await fetch(url, requestOptions);
    if (response.status === 401 && !endpoint.startsWith("/auth/")) {
      try {
        await this.refreshSession();
        response = await fetch(url, {
          ...requestOptions,
          headers: isFormData
            ? {
                ...(options.headers || {}),
                ...(this.token
                  ? { Authorization: `Bearer ${this.token}` }
                  : {}),
              }
            : await this.getHeaders(options.headers || {}, !!options.body),
        });
      } catch {
        this.clearToken();
        authErrorHandlers.forEach((handler) => {
          try {
            handler(401, endpoint);
          } catch (handlerError) {
            void handlerError;
          }
        });
      }
    }
    if (response.status === 401) this.clearToken();
    if (response.status === 401 || response.status === 403)
      authErrorHandlers.forEach((handler) => {
        try {
          handler(response.status, endpoint);
        } catch (handlerError) {
          void handlerError;
        }
      });
    return this.handleResponse(response, { silent: options.silent === true });
  }
  async fetchMultipart(endpoint, formData, options = {}) {
    return this.fetch(endpoint, {
      ...options,
      method: options.method || "POST",
      body: formData,
    });
  }
  async fetchStream(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    let response = await fetch(url, {
      ...options,
      credentials: "include",
      body: isBodyString(options.body)
        ? options.body
        : options.body
          ? serializeBody(options.body)
          : undefined,
      headers: await this.getHeaders(options.headers || {}, !!options.body),
    });
    if (response.status === 401 && !endpoint.startsWith("/auth/")) {
      try {
        await this.refreshSession();
        response = await fetch(url, {
          ...options,
          credentials: "include",
          headers: await this.getHeaders(options.headers || {}, !!options.body),
        });
      } catch {
        this.clearToken();
      }
    }
    if (!response.ok) {
      // Try to surface the server's message (e.g. provider down, rate limit).
      let message = `Stream failed: ${response.status} ${response.statusText}`;
      const type = response.headers.get("content-type") || "";
      if (type.includes("application/json")) {
        try {
          const body = await response.json();
          if (body?.message) message = body.message;
        } catch {
          /* keep the generic message */
        }
      }
      const error = Object.assign(new Error(message), {
        status: response.status,
      });
      if (error.status !== 401) {
        toast({
          title: ERROR_TITLES[error.status] || "Stream failed",
          description: error.message,
          variant: "destructive",
        });
        error.toastShown = true;
      }
      throw error;
    }
    return response;
  }
  registerAuthErrorHandler(handler) {
    authErrorHandlers.add(handler);
    return () => authErrorHandlers.delete(handler);
  }
  unregisterAuthErrorHandler(handler) {
    authErrorHandlers.delete(handler);
  }
}

export const apiClient = new ApiClient();
export { API_URL };
