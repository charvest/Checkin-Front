// frontend/src/api/messagesRealtime.js
import { io } from "socket.io-client";
import { getApiBaseUrl } from "./apiFetch";
import { getToken } from "../utils/auth";

let socket = null;
let lastToken = null;

function getSocketUrl() {
  const base = getApiBaseUrl();
  if (base && String(base).trim()) return String(base).replace(/\/+$/, "");
  // local dev fallback
  return "http://localhost:5000";
}

export function connectMessagesSocket() {
  const token = getToken() || "";

  // If token changed, recreate the socket (prevents stale-user pickup)
  if (socket && lastToken !== token) {
    try {
      socket.disconnect();
    } catch {}
    socket = null;
  }

  if (socket) {
    try {
      // update auth for reconnect attempts
      socket.auth = { token };
      if (!socket.connected) socket.connect();
    } catch {}
    lastToken = token;
    return socket;
  }

  const url = getSocketUrl();
  lastToken = token;

  socket = io(url, {
    transports: ["websocket", "polling"],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 500,
    timeout: 20000,
  });

  socket.on("connect_error", (err) => {
    console.warn("Socket connect_error:", err?.message || err);
  });

  return socket;
}

export function disconnectMessagesSocket() {
  if (!socket) return;
  try {
    socket.disconnect();
  } catch {}
  socket = null;
  lastToken = null;
}

export function onMessageNew(handler) {
  const s = connectMessagesSocket();
  s.on("message:new", handler);
  return () => s.off("message:new", handler);
}

export function onThreadUpdate(handler) {
  const s = connectMessagesSocket();
  s.on("thread:update", handler);
  return () => s.off("thread:update", handler);
}

export function onThreadCreated(handler) {
  const s = connectMessagesSocket();
  s.on("thread:created", handler);
  return () => s.off("thread:created", handler);
}

export function onThreadClaimed(handler) {
  const s = connectMessagesSocket();
  s.on("thread:claimed", handler);
  return () => s.off("thread:claimed", handler);
}

export function joinThread(threadId) {
  if (!threadId) return;
  const s = connectMessagesSocket();
  try {
    s.emit("thread:join", { threadId: String(threadId) });
  } catch {}
}
