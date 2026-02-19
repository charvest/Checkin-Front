// src/api/messages.api.js
// Adapter layer: UI calls these functions only.
// Today: static in-memory.
// Later: replace internals with real fetch/axios calls.

const USE_REAL_API = false; // ✅ set to true once backend is ready

// If you already have an auth token helper, plug it here later.
function getToken() {
  return localStorage.getItem("token"); // or your auth storage key
}

const BASE_URL =
  process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api`
    : "http://localhost:5000/api";

/* ---------------------------
   STATIC STORE (temporary)
---------------------------- */
let STATIC_THREADS = [
  {
    id: "t1",
    name: "Counselor A",
    subtitle: "Guidance Counselor",
    avatarUrl:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=60",
    lastMessage: "Kamusta kana?",
    lastTime: "17h",
    unread: 1,
    messages: [
      { id: "m1", from: "them", text: "Kamusta kana?", time: "2:16 AM" },
      { id: "m2", from: "me", text: "Hi counselor, I’m slightly depressed. Ikaw ba?", time: "3:22 AM" },
    ],
  },
  {
    id: "t2",
    name: "Counselor B",
    subtitle: "Guidance Counselor",
    avatarUrl:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=60",
    lastMessage: "I saw your request. Are you safe right now?",
    lastTime: "6d",
    unread: 0,
    messages: [
      { id: "m1", from: "them", text: "I saw your request. Are you safe right now?", time: "10:11 AM" },
      { id: "m2", from: "me", text: "Yes po, I’m safe. Just overwhelmed.", time: "10:14 AM" },
    ],
  },
];

/* ---------------------------
   HELPERS
---------------------------- */
function nowTimeLabel() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sortThreads(threads) {
  // Simple: keep as is. Later you can sort by updatedAt/lastMessageAt.
  return threads;
}

async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

/* =========================================================
   PUBLIC FUNCTIONS (UI should only call these)
========================================================= */

/**
 * List all conversation threads (for drawer list)
 * Returns: { items: Thread[] }
 */
export async function listThreads() {
  if (!USE_REAL_API) {
    return { items: sortThreads([...STATIC_THREADS]) };
  }

  // ✅ Replace with your backend endpoint later
  // Example:
  // const data = await apiFetch("/counseling/threads");
  // return { items: normalizeThreads(data.items) };

  const data = await apiFetch("/messages/threads"); // placeholder
  return data;
}

/**
 * Get a single thread with its messages
 * Returns: { item: Thread }
 */
export async function getThread(threadId) {
  if (!USE_REAL_API) {
    const t = STATIC_THREADS.find((x) => x.id === threadId);
    if (!t) throw new Error("Thread not found");
    return { item: { ...t, messages: [...(t.messages || [])] } };
  }

  // placeholder real endpoint
  const data = await apiFetch(`/messages/threads/${threadId}`);
  return data;
}

/**
 * Send a message in a thread
 * Returns: { item: Message }
 */
export async function sendMessage({ threadId, text }) {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("Message is empty");

  if (!USE_REAL_API) {
    const idx = STATIC_THREADS.findIndex((x) => x.id === threadId);
    if (idx < 0) throw new Error("Thread not found");

    const msg = {
      id: `m_${Date.now()}`,
      from: "me",
      text: clean,
      time: nowTimeLabel(),
    };

    const nextThread = { ...STATIC_THREADS[idx] };
    nextThread.messages = [...(nextThread.messages || []), msg];
    nextThread.lastMessage = clean;
    nextThread.lastTime = "now";
    nextThread.unread = 0;

    STATIC_THREADS = STATIC_THREADS.map((t, i) => (i === idx ? nextThread : t));
    return { item: msg };
  }

  // placeholder real endpoint
  const data = await apiFetch(`/messages/threads/${threadId}/messages`, {
    method: "POST",
    body: { text: clean },
  });

  return data;
}

/**
 * Optional: mark thread as read
 */
export async function markThreadRead(threadId) {
  if (!USE_REAL_API) {
    STATIC_THREADS = STATIC_THREADS.map((t) =>
      t.id === threadId ? { ...t, unread: 0 } : t
    );
    return { ok: true };
  }

  // placeholder real endpoint
  return apiFetch(`/messages/threads/${threadId}/read`, { method: "POST" });
}
