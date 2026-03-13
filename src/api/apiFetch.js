import { getToken } from "../utils/auth";

// src/api/apiFetch.js
// Shared fetch helper: consistent base URL + auth header + JSON/error parsing

const DEFAULT_API_BASE_URL = "https://checkin-backend-4xic.onrender.com";

export function getApiBaseUrl() {
  const env = process.env.REACT_APP_API_URL;
  if (env && String(env).trim()) return String(env).replace(/\/+$/, "");

  // If you're running the frontend dev server with a proxy, allow relative calls.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "";
  }

  return DEFAULT_API_BASE_URL;
}

function joinUrl(base, path) {
  const p = String(path || "");
  if (p.startsWith("http://") || p.startsWith("https://")) return p;

  if (!base) return p.startsWith("/") ? p : `/${p}`;

  const b = String(base).replace(/\/+$/, "");
  const pp = p.startsWith("/") ? p : `/${p}`;
  return `${b}${pp}`;
}


export async function apiFetch(path, options = {}) {
  const base = getApiBaseUrl();
  const url = joinUrl(base, path);

  const token = getToken() || "";

  const headers = { ...(options.headers || {}) };

  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isForm && options.body != null && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const data = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");

  if (res.ok) return data;

  if (res.status === 401) {
    throw new Error("Session expired. Please login again.");
  }

  const message =
    (data && typeof data === "object" && data.message) ||
    (typeof data === "string" && data) ||
    `Request failed (${res.status}).`;

  throw new Error(message);
}
