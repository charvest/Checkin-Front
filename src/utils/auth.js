// src/utils/auth.js
import { useSyncExternalStore } from "react";

export const TOKEN_KEY = "token";
export const ROLE_KEY = "role";
export const USER_KEY = "user";

// ✅ PATCH: legacy/alternate token keys used across older builds
export const LEGACY_TOKEN_KEYS = ["checkin:token", "authToken"];

const AUTH_EVENT = "auth:changed";

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function emitAuthChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function readItem(key) {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
}

export function getToken() {
  // ✅ PATCH: match apiFetch token resolution to avoid socket/API mismatch.
  // Priority: token -> checkin:token -> authToken, across local + session storage.
  if (!isBrowser()) return null;
  try {
    return (
      window.localStorage.getItem(TOKEN_KEY) ||
      window.sessionStorage.getItem(TOKEN_KEY) ||
      window.localStorage.getItem(LEGACY_TOKEN_KEYS[0]) ||
      window.sessionStorage.getItem(LEGACY_TOKEN_KEYS[0]) ||
      window.localStorage.getItem(LEGACY_TOKEN_KEYS[1]) ||
      window.sessionStorage.getItem(LEGACY_TOKEN_KEYS[1]) ||
      null
    );
  } catch {
    return readItem(TOKEN_KEY);
  }
}

export function getRole() {
  return readItem(ROLE_KEY);
}

export function getUser() {
  if (!isBrowser()) return null;
  try {
    const raw = readItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!getToken();
}

/* ===========================
   ✅ STABLE SNAPSHOT CACHE
   =========================== */

let _lastKey = null;
let _lastSnapshot = { token: null, isAuthed: false, user: null, role: null };

function buildAuthKey() {
  // ✅ PATCH: token key should reflect *resolved* token (supports legacy storage)
  const token = getToken() || "";
  const role = readItem(ROLE_KEY) || "";
  const userRaw = readItem(USER_KEY) || "";
  // key is a primitive string (stable compare)
  return `${token}::${role}::${userRaw}`;
}

export function getAuthSnapshot() {
  if (!isBrowser()) return _lastSnapshot;

  const key = buildAuthKey();
  if (key === _lastKey) return _lastSnapshot;

  _lastKey = key;

  const token = getToken();
  const role = getRole();
  const user = getUser();

  _lastSnapshot = {
    token,
    isAuthed: !!token,
    user,
    role,
  };

  return _lastSnapshot;
}

/**
 * Subscribe (same tab via AUTH_EVENT, other tabs via storage)
 */
export function subscribeAuth(callback) {
  if (!isBrowser()) return () => {};

  const onAuth = () => callback();

  const onStorage = (e) => {
    if (!e) return;
    // ✅ PATCH: react to legacy token key updates too (prevents stale UI across tabs)
    if ([TOKEN_KEY, USER_KEY, ROLE_KEY, ...LEGACY_TOKEN_KEYS].includes(e.key)) callback();
  };

  window.addEventListener(AUTH_EVENT, onAuth);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(AUTH_EVENT, onAuth);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * ✅ React hook: rerenders only when auth key changes
 */
export function useAuth() {
  return useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot);
}

/**
 * ✅ The ONLY way to sign in
 */
export function setAuth({ token, user, rememberMe = true }) {
  if (!isBrowser()) return;

  clearAuth({ notify: false });

  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  storage.setItem(TOKEN_KEY, token);

  // ✅ PATCH: write legacy keys too for backward compatibility
  storage.setItem(LEGACY_TOKEN_KEYS[0], token);
  storage.setItem(LEGACY_TOKEN_KEYS[1], token);

  storage.setItem(USER_KEY, JSON.stringify(user ?? null));
  storage.setItem(ROLE_KEY, user?.role ?? "");

  emitAuthChanged();
}


/**
 * ✅ Update current auth user (without changing token)
 * Used for profile edits like avatar updates.
 */
export function updateAuthUser(patch = {}) {
  if (!isBrowser()) return;

  // Decide where the current auth lives (local vs session)
  const hasLocal =
    !!window.localStorage.getItem(TOKEN_KEY) ||
    LEGACY_TOKEN_KEYS.some((k) => !!window.localStorage.getItem(k)) ||
    !!window.localStorage.getItem(USER_KEY);

  const hasSession =
    !!window.sessionStorage.getItem(TOKEN_KEY) ||
    LEGACY_TOKEN_KEYS.some((k) => !!window.sessionStorage.getItem(k)) ||
    !!window.sessionStorage.getItem(USER_KEY);

  const storage = hasLocal ? window.localStorage : hasSession ? window.sessionStorage : window.localStorage;

  let current = null;
  try {
    const raw = storage.getItem(USER_KEY) ?? readItem(USER_KEY);
    current = raw ? JSON.parse(raw) : null;
  } catch {
    current = null;
  }

  const next = { ...(current || {}), ...(patch || {}) };

  storage.setItem(USER_KEY, JSON.stringify(next));
  storage.setItem(ROLE_KEY, next?.role ?? readItem(ROLE_KEY) ?? "");

  emitAuthChanged();
}

/**
 * ✅ The ONLY way to sign out
 */
export function clearAuth({ notify = true } = {}) {
  if (!isBrowser()) return;

  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(ROLE_KEY);

  // ✅ PATCH: remove legacy token keys
  for (const k of LEGACY_TOKEN_KEYS) window.localStorage.removeItem(k);

  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(USER_KEY);
  window.sessionStorage.removeItem(ROLE_KEY);

  // ✅ PATCH: remove legacy token keys
  for (const k of LEGACY_TOKEN_KEYS) window.sessionStorage.removeItem(k);

  // ✅ PATCH: also clear any saved chat session keys (prevents "session pickup")
  try {
    const keys = Object.keys(window.localStorage);
    for (const k of keys) {
      if (k === "counselor_chat_session_v1" || k.startsWith("counselor_chat_session_v1:")) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {}

  // ✅ PATCH: best-effort disconnect of messaging socket (avoid stale realtime)
  try {
    // dynamic import avoids circular deps
    import("../api/messagesRealtime")
      .then((m) => m?.disconnectMessagesSocket?.())
      .catch(() => {});
  } catch {}

  if (notify) emitAuthChanged();
}

export function logout() {
  clearAuth({ notify: true });
}
