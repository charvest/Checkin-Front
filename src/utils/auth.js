// src/utils/auth.js
import { useSyncExternalStore } from "react";

export const TOKEN_KEY = "token";
export const ROLE_KEY = "role";
export const USER_KEY = "user";

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
  return readItem(TOKEN_KEY);
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
  const token = readItem(TOKEN_KEY) || "";
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
    if ([TOKEN_KEY, USER_KEY, ROLE_KEY].includes(e.key)) callback();
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
  storage.setItem(USER_KEY, JSON.stringify(user ?? null));
  storage.setItem(ROLE_KEY, user?.role ?? "");

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

  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(USER_KEY);
  window.sessionStorage.removeItem(ROLE_KEY);

  if (notify) emitAuthChanged();
}

export function logout() {
  clearAuth({ notify: true });
}
