// frontend/src/api/socket.js
import { io } from "socket.io-client";
import { getApiBaseUrl } from "./apiFetch";

function readToken() {
  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("checkin:token") ||
      ""
    );
  } catch {
    return "";
  }
}

function getSocketUrl() {
  const base = getApiBaseUrl();
  // In local dev, apiFetch may use relative proxy (""). Socket needs an absolute URL.
  if (!base) return "http://localhost:5000";
  return base;
}

let _socket = null;
let _lastToken = null;

export function getSocket() {
  const token = readToken();
  const url = getSocketUrl();

  if (_socket) {
    // If token changed, refresh auth
    if (token !== _lastToken) {
      _lastToken = token;
      _socket.auth = { token };
      // reconnect with new auth
      try {
        if (_socket.connected) _socket.disconnect();
        _socket.connect();
      } catch {}
    }
    return _socket;
  }

  _lastToken = token;

  _socket = io(url, {
    path: "/socket.io",
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: { token },
  });

  return _socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (!_socket) return;
  try {
    _socket.disconnect();
  } catch {}
}
