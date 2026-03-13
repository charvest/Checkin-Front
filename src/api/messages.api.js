// frontend/src/api/messages.api.js
import { apiFetch, getApiBaseUrl } from "./apiFetch";
import { getToken as getTokenFromAuth } from "../utils/auth";

/* =========================================================
   JWT helper (no extra deps)
========================================================= */
export function getToken() {
  // Canonical token source (shared with apiFetch + sockets)
  return getTokenFromAuth() || "";
}


export function getMyUserId() {
  const token = getToken();
  if (!token) return "";
  try {
    const [, payload] = token.split(".");
    if (!payload) return "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized);
    const obj = JSON.parse(json);
    return String(obj?.id || obj?._id || "");
  } catch {
    return "";
  }
}

/* =========================================================
   Time helpers (UI format)
========================================================= */
function pad2(n) {
  const s = String(n);
  return s.length === 1 ? `0${s}` : s;
}

function formatClock(isoOrDate) {
  try {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return "";
  }
}

function formatRelative(isoOrDate) {
  try {
    const d = new Date(isoOrDate);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (!Number.isFinite(diff)) return "";

    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;

    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;

    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;

    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}


/* =========================================================
   Media URL helper (avatars)
========================================================= */
function resolveMediaUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u) || u.startsWith("data:")) return u;

  const base = String(getApiBaseUrl() || "").replace(/\/+$/, "");
  if (base && u.startsWith("/")) return `${base}${u}`;
  return u; // best-effort
}

/* =========================================================
   Raw API
========================================================= */
export async function listThreadsRaw({ includeMessages = true, limit = 40 } = {}) {
  const qs = new URLSearchParams();
  qs.set("includeMessages", includeMessages ? "1" : "0");
  qs.set("limit", String(limit));
  return apiFetch(`/api/messages/threads?${qs.toString()}`);
}

export async function ensureThread({ anonymous = false } = {}) {
  return apiFetch("/api/messages/threads/ensure", {
    method: "POST",
    body: JSON.stringify({ anonymous }),
  });
}

export async function getThreadRaw(threadId, { limit = 60 } = {}) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  return apiFetch(`/api/messages/threads/${threadId}?${qs.toString()}`);
}

export async function sendMessageRaw({ threadId, text, clientId = null, senderMode = null }) {
  return apiFetch(`/api/messages/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text, clientId, senderMode }),
  });
}

export async function markThreadRead(threadId) {
  return apiFetch(`/api/messages/threads/${threadId}/read`, { method: "POST" });
}

export async function closeThreadRaw(threadId) {
  return apiFetch(`/api/messages/threads/${threadId}/close`, { method: "POST" });
}

/* =========================================================
   MAPPERS
========================================================= */

// Counselor side mapper (not used by your big Inbox.js, but kept for other UI)
export function toInboxItems(rawThreads = []) {
  const myId = getMyUserId();

  return (rawThreads || []).map((t) => {
    const threadId = String(t._id);
    const student = t.studentId;

    const isUnclaimed = !t.counselorId;
    const suffix = `T-${threadId.slice(-5)}`;

    const title = isUnclaimed
      ? `New Student • Unclaimed (${suffix})`
      : t.anonymous
      ? `Anonymous Student (${suffix})`
      : student?.fullName || `Student (${suffix})`;

    const meta =
      isUnclaimed || t.anonymous
        ? null
        : student?.studentNumber
        ? `#${student.studentNumber}`
        : null;

    const lastAt = t.lastMessageAt || t.updatedAt || null;
    const lastActivity = lastAt ? new Date(lastAt).getTime() : 0;

    const unreadCounts = t?.unreadCounts || {};
    const unread = isUnclaimed ? Number(t?.unassignedUnread || 0) : Number(unreadCounts?.[myId] || 0);

    const messages = (t.messages || []).map((m) => ({
      id: String(m._id),
      senderId: String(m.senderId),
      text: m.text,
      createdAt: m.createdAt,
    }));

    return {
      id: threadId,
      title,
      meta,
      unread,
      lastActivity,
      lastMessage: t.lastMessage || (messages[messages.length - 1]?.text || "—"),
      messages,
      _raw: t,
    };
  });
}

// ✅ Student side mapper (MessagesDrawer expects { messages: [...] })
export function toDrawerThreads(rawThreads = []) {
  const myId = getMyUserId();

  return (rawThreads || []).map((t) => {
    const threadId = String(t._id);
    const counselor = t.counselorId || null;

    const messages = (t.messages || []).map((m) => {
      const from = String(m.senderId) === String(myId) ? "me" : "them";
      const createdAt = m.createdAt ? new Date(m.createdAt).getTime() : Date.now();
      return {
        id: String(m._id),
        from,
        text: m.text,
        time: formatClock(m.createdAt),
        createdAt,
        _raw: m,
      };
    });

    const lastAt = t.lastMessageAt || t.updatedAt || null;

    return {
      id: threadId,
      counselorName: counselor?.fullName || "Counselor",
      counselorUsername: counselor?.fullName || "Counselor",
      counselorAvatarUrl: resolveMediaUrl(counselor?.avatarUrl || counselor?.photoURL || counselor?.photoUrl || counselor?.profilePictureUrl || counselor?.profilePicture || ""),
      counselorOnline: false,
      status: t.status || "open",
      anonymous: !!t.anonymous,
      identityMode: String(t.identityMode || (t.anonymous ? "anonymous" : "student")),
      identityLocked: !!t.identityLocked,
      identityLockedAt: t.identityLockedAt || null,
      unread: Number(t?.unreadForMe ?? t?.unreadCounts?.[myId] ?? 0),
      lastMessage: t.lastMessage || (messages[messages.length - 1]?.text || "—"),
      lastTime: formatRelative(lastAt || Date.now()),
      messages,
      _raw: t,
    };
  });
}

/* =========================================================
   Convenience
========================================================= */
export async function listThreadsForDrawer() {
  const data = await listThreadsRaw({ includeMessages: true, limit: 80 });
  return { items: toDrawerThreads(data.items || []) };
}

export async function listThreadsForInbox() {
  const data = await listThreadsRaw({ includeMessages: true, limit: 120 });
  return { items: toInboxItems(data.items || []) };
}

export async function sendDrawerMessage({ threadId, text, clientId = null, senderMode = null }) {
  return sendMessageRaw({ threadId, text, clientId, senderMode });
}

export function getSocketBaseUrl() {
  const base = getApiBaseUrl();
  if (base) return base;
  // local fallback
  return "http://localhost:5000";
}

export async function closeThread(threadId) {
  return closeThreadRaw(threadId);
}
