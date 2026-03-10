// src/components/Message/MessagesDrawer.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";


import { getApiBaseUrl } from "../../api/apiFetch";
const TEXT_MAIN = "#141414";
const EXPIRE_MS = 24 * 60 * 60 * 1000;


// Avatar URLs may be stored as relative paths (e.g. /uploads/avatars/..). Resolve against API base.
function resolveAvatarSrc(src) {
  const s = String(src || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return s;

  const base = String(getApiBaseUrl() || "").replace(/\/+$/, "");
  if (base && s.startsWith("/")) return `${base}${s}`;
  return s;
}
// ✅ PATCH: per-user session storage prefix (prevents shared-device session pickup)
const LS_KEY = "counselor_chat_session_v1";

function useMedia(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();

    if (m.addEventListener) m.addEventListener("change", onChange);
    else m.addListener(onChange);

    return () => {
      if (m.removeEventListener) m.removeEventListener("change", onChange);
      else m.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

function safeParse(value, fallback = null) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isValidEmail(email) {
  const e = String(email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(e);
}

function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findProfanity(text, words) {
  const t = normalizeText(text);
  if (!t) return null;

  for (const w of words) {
    const re = new RegExp(`(^|\\s)${w}(\\s|$)`, "i");
    if (re.test(t)) return w;
  }
  return null;
}

function nowTimeLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

function initials(name) {
  const n = String(name || "").trim();
  if (!n) return "";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : "")).join("");
}

function getMessageTimeLabel(m) {
  if (m?.time) return String(m.time);
  if (m?.createdAt)
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(m.createdAt));
  return nowTimeLabel();
}

/**
 * Delivery/seen logic (backend later):
 * - m.deliveryStatus: "sending" | "sent" | "delivered" | "seen"
 * - or timestamps: deliveredAt / seenAt
 */
function getDeliveryLabel(m) {
  const status = String(m?.deliveryStatus || m?.status || "").toLowerCase();

  if (m?.seenAt || status === "seen" || status === "read") return "Seen";
  if (m?.deliveredAt || status === "delivered") return "Delivered";
  if (status === "sending") return "Sending…";
  if (status === "sent") return "Sent";

  if (m?.id) return "Delivered";
  return "Sent";
}

function Avatar({
  size = 40,
  src = "",
  fallback = "🙂",
  label = "Avatar",
  title = "",
}) {
  const s = Number(size) || 40;
  const resolved = resolveAvatarSrc(src);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [resolved]);

  const showImg = Boolean(resolved) && !broken;

  return (
    <div
      aria-label={label}
      title={title || label}
      style={{
        width: s,
        height: s,
        borderRadius: "50%",
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.10)",
        background: "rgba(255,255,255,0.90)",
        boxShadow: "0 10px 18px rgba(0,0,0,0.06)",
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
      }}
    >
      {showImg ? (
        <img
          src={resolved}
          alt={label}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setBroken(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            fontFamily: "Nunito, sans-serif",
            fontWeight: 900,
            fontSize: Math.max(12, Math.floor(s * 0.42)),
            color: TEXT_MAIN,
          }}
        >
          {fallback}
        </span>
      )}
    </div>
  );
}

export default function MessagesDrawer({open,
  onClose,
  threads = [],
  initialThreadId = "",
  onSendMessage,
  title = "Messages",
  userIdentity = null,
  onRefreshThreads = null, // ({reason, onEndChat}) => void
  onEndChat = null, // async ({threadId}) => void
  theme = null, // { accent?: string, headerTint?: string }
}) {
  const PAGE_SIZE = 10;

  const accent = theme?.accent || "#B9FF66";
  const headerTint = theme?.headerTint || accent;

  const isMobile = useMedia("(max-width: 520px)");
  const isSmallHeight = useMedia("(max-height: 640px)");

  const loggedInEmail = useMemo(() => {
    const email = String(userIdentity?.email || "").trim();
    return isValidEmail(email) ? email : "";
  }, [userIdentity]);

  // ✅ PATCH: Session key is per-user (email-based). If email is unavailable, fall back to legacy key.
  const sessionKey = useMemo(() => {
    const e = String(loggedInEmail || "").trim().toLowerCase();
    return e ? `${LS_KEY}:${e}` : LS_KEY;
  }, [loggedInEmail]);

  // views: mode | email | chat
  const [view, setView] = useState("mode");
  const [mode, setMode] = useState(null); // student | anonymous
  const [studentEmail, setStudentEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  const [startingMode, setStartingMode] = useState(false);

  const [activeId, setActiveId] = useState(
    initialThreadId || threads?.[0]?.id || "",
  );
  const [draft, setDraft] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [createdAtMs, setCreatedAtMs] = useState(null);
  const [expiresAtMs, setExpiresAtMs] = useState(null);
  const [countdown, setCountdown] = useState("");

  // emoji
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiBtnRef = useRef(null);
  const emojiPopRef = useRef(null);
  const textareaRef = useRef(null);

  // overflow menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const menuRef = useRef(null);

  // profanity
  const [profanityError, setProfanityError] = useState("");
  const [identityError, setIdentityError] = useState("");
  const profanityWords = useMemo(
    () => [
      "fuck",
      "shit",
      "bitch",
      "asshole",
      "bastard",
      "dick",
      "pussy",
      "cunt",
    ],
    [],
  );

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) || null,
    [threads, activeId],
  );

  const counselorDisplayName = useMemo(() => {
    const t = activeThread || threads?.[0] || {};
    return t.counselorUsername || t.counselorName || "Counselor";
  }, [activeThread, threads]);

  const counselorAvatarUrl = useMemo(() => {
    const t = activeThread || threads?.[0] || {};
    return resolveAvatarSrc(t.counselorAvatarUrl || t.counselorAvatar || "");
  }, [activeThread, threads]);

  const userAvatarUrl = useMemo(() => {
    return resolveAvatarSrc(userIdentity?.avatarUrl || userIdentity?.avatar || "");
  }, [userIdentity]);

  const counselorOnline = useMemo(() => {
    const t = activeThread;
    if (!t) return false;
    return Boolean(t.counselorOnline ?? t.online ?? false);
  }, [activeThread]);

  const counselorClosed = useMemo(() => {
    const t = activeThread;
    if (!t) return false;
    return (
      t.status === "closed" ||
      t.closed === true ||
      t.endedBy === "counselor" ||
      t.closedByCounselor === true
    );
  }, [activeThread]);

  const normalizedMessages = useMemo(() => {
    const all = activeThread?.messages || [];
    return all
      .filter((m) => {
        const tx = String(m?.text || "");
        const legacyFyi =
          tx.includes("I'm already logged in.") &&
          tx.includes("Please don't ask me for my email again.");
        return !legacyFyi;
      })
      .map((m, idx) => ({
        ...m,
        _idx: idx,
        createdAt: m.createdAt || Date.now(),
      }));
  }, [activeThread]);


  const targetThread = useMemo(() => {
    return (
      activeThread ||
      (initialThreadId ? threads?.find((x) => x.id === initialThreadId) : null) ||
      threads?.[0] ||
      null
    );
  }, [activeThread, initialThreadId, threads]);

  const hasUserSentMessage = useMemo(() => {
    const all = targetThread?.messages || [];
    return all.some((m) => String(m?.from || "") === "me");
  }, [targetThread]);

  // ✅ Hide identity switch after first message (clean UI) OR if backend locks identity
  const identityLocked = Boolean(targetThread?.identityLocked) || hasUserSentMessage;
  const identitySwitchAllowed = view === "chat" && mode && !identityLocked;

  // Which identity is locked for this OPEN thread (used to enable "return to chat")
  const lockedMode = useMemo(() => {
    const t = targetThread;
    if (!t) return null;
    const raw = String(t.identityMode || "").toLowerCase();
    if (raw === "student" || raw === "anonymous") return raw;
    return t.anonymous ? "anonymous" : "student";
  }, [targetThread]);

  // ✅ Locks the identity chooser after the first message for the current OPEN thread.
  // Allows returning to the SAME identity; switching is blocked until End conversation.
  const identityChoiceLocked = useMemo(() => {
    const t = targetThread;
    if (!t) return false;

    const status = String(t.status || "open").toLowerCase();
    const isClosed = status === "closed" || t.closed === true;
    if (isClosed) return false;

    // Prefer backend lock flag; fallback to local "sent message" detection.
    if (t.identityLocked) return true;

    const msgs = Array.isArray(t.messages) ? t.messages : [];
    return msgs.some((m) => String(m?.from || "") === "me");
  }, [targetThread]);


  const visibleMessages = useMemo(() => {
    const all = normalizedMessages;
    return all.slice(Math.max(0, all.length - visibleCount));
  }, [normalizedMessages, visibleCount]);

  const chatRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < visibleMessages.length; i += 1) {
      const m = visibleMessages[i];
      const prev = visibleMessages[i - 1];
      const next = visibleMessages[i + 1];
      rows.push({
        key: m.id || `m-${m._idx}`,
        msg: m,
        showLabel: !prev || prev.from !== m.from,
        isEnd: !next || next.from !== m.from,
      });
    }
    return rows;
  }, [visibleMessages]);

  const loadSession = useCallback(() => {
    if (typeof window === "undefined") return null;
    // ✅ PATCH: read per-user session key
    return safeParse(window.localStorage.getItem(sessionKey), null);
  }, [sessionKey]);

  const saveSession = useCallback(
    (next) => {
      if (typeof window === "undefined") return;
      // ✅ PATCH: write per-user session key
      window.localStorage.setItem(sessionKey, JSON.stringify(next));
    },
    [sessionKey],
  );

  const clearSession = useCallback(() => {
    if (typeof window === "undefined") return;
    // ✅ PATCH: clear per-user session key
    window.localStorage.removeItem(sessionKey);
  }, [sessionKey]);

  const resetToStart = useCallback(() => {
    setView("mode");
    setMode(null);
    setStudentEmail("");
    setEmailTouched(false);
    setDraft("");
    setProfanityError("");
    setIdentityError("");
    setEmojiOpen(false);
    setMenuOpen(false);

    setVisibleCount(PAGE_SIZE);
    setCreatedAtMs(null);
    setExpiresAtMs(null);
    setCountdown("");
    setActiveId(initialThreadId || threads?.[0]?.id || "");

    clearSession();
  }, [clearSession, initialThreadId, threads]);

  const applySession = useCallback(
    (s) => {
      setView(s.view || "mode");
      setMode(s.mode || null);
      setStudentEmail(s.studentEmail || "");
      setEmailTouched(false);
      setDraft("");
      setProfanityError("");
      setIdentityError("");
    setIdentityError("");
      setEmojiOpen(false);
      setMenuOpen(false);

      setVisibleCount(s.visibleCount || PAGE_SIZE);
      setCreatedAtMs(s.createdAtMs || null);
      setExpiresAtMs(s.expiresAtMs || null);
      setActiveId(s.activeId || initialThreadId || threads?.[0]?.id || "");
    },
    [initialThreadId, threads],
  );

  const startNewChatSession = useCallback(
    ({ nextMode, nextStudentEmail, threadId }) => {
      const now = Date.now();
      const session = {
        view: "chat",
        mode: nextMode,
        studentEmail: nextStudentEmail || "",
        createdAtMs: now,
        expiresAtMs: now + EXPIRE_MS,
        activeId: threadId,
        visibleCount: PAGE_SIZE,
      };
      saveSession(session);
      applySession(session);
    },
    [applySession, saveSession],
  );

  useEffect(() => {
    if (!open) return;

    const defaultThreadId = initialThreadId || threads?.[0]?.id || "";
    setActiveId((prev) => prev || defaultThreadId);

    const defaultThread =
      (defaultThreadId && threads?.find((t) => t.id === defaultThreadId)) ||
      threads?.[0] ||
      null;

    const threadHasLockedIdentity = Boolean(defaultThread?.identityLocked);
    const lockedModeRaw = String(
      defaultThread?.identityMode || (defaultThread?.anonymous ? "anonymous" : "student") || ""
    ).toLowerCase();
    const lockedMode = lockedModeRaw === "anonymous" ? "anonymous" : "student";

    const saved = loadSession();
    const now = Date.now();

    // ✅ Requirement #2: do NOT auto-start as Student.
    // Show identity chooser first, unless the conversation already has a locked identity.
    if (!saved) {
      if (threadHasLockedIdentity && defaultThreadId) {
        startNewChatSession({
          nextMode: lockedMode,
          nextStudentEmail: lockedMode === "student" ? loggedInEmail : "",
          threadId: defaultThreadId,
        });
      } else {
        resetToStart();
      }
      return;
    }

    if (saved.expiresAtMs && now >= saved.expiresAtMs) {
      resetToStart();
      onRefreshThreads?.({ reason: "expired" });
      return;
    }

    let nextView = saved.view || "mode";
    let nextMode = saved.mode || null;

    // If backend already locked identity, force the mode to match thread identity.
    if (threadHasLockedIdentity) nextMode = lockedMode;

    // Never auto-pick a mode. If chat view has no mode, send them to chooser.
    if (nextView === "chat" && !nextMode) nextView = "mode";

    const nextStudentEmail = nextMode === "student" ? loggedInEmail || saved.studentEmail || "" : "";

    applySession({
      ...saved,
      view: nextView,
      mode: nextMode,
      studentEmail: nextStudentEmail,
      activeId: saved.activeId || defaultThreadId,
      visibleCount: saved.visibleCount || PAGE_SIZE,
      createdAtMs: saved.createdAtMs || now,
      expiresAtMs: saved.expiresAtMs || now + EXPIRE_MS,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loggedInEmail]);

  useEffect(() => {
    if (!open) return;
    if (!view) return;

    saveSession({
      view,
      mode,
      studentEmail,
      createdAtMs,
      expiresAtMs,
      activeId,
      visibleCount,
    });
  }, [
    open,
    view,
    mode,
    studentEmail,
    createdAtMs,
    expiresAtMs,
    activeId,
    visibleCount,
    saveSession,
  ]);

  useEffect(() => {
    if (!open) return;
    if (!expiresAtMs) {
      setCountdown("");
      return;
    }

    const tick = () => {
      const left = expiresAtMs - Date.now();
      if (left <= 0) {
        setCountdown("00:00:00");
        resetToStart();
        onRefreshThreads?.({ reason: "expired" });
        return;
      }
      setCountdown(formatCountdown(left));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open, expiresAtMs, resetToStart, onRefreshThreads]);

  useEffect(() => {
    if (!emojiOpen) return undefined;

    const onDown = (e) => {
      const pop = emojiPopRef.current;
      const btn = emojiBtnRef.current;
      if (pop?.contains(e.target)) return;
      if (btn?.contains(e.target)) return;
      setEmojiOpen(false);
    };

    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [emojiOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onDown = (e) => {
      const pop = menuRef.current;
      const btn = menuBtnRef.current;
      if (pop?.contains(e.target)) return;
      if (btn?.contains(e.target)) return;
      setMenuOpen(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const chatBodyRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (view !== "chat") return;
    requestAnimationFrame(() => {
      const el = chatBodyRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [open, view, activeId, normalizedMessages.length]);

  function onChatScroll(e) {
    const el = e.currentTarget;
    if (!el) return;
    if (el.scrollTop <= 10 && normalizedMessages.length > visibleCount) {
      setVisibleCount((c) =>
        Math.min(normalizedMessages.length, c + PAGE_SIZE),
      );
    }
  }

  async function chooseMode(nextMode) {
    if (startingMode) return;

    // If identity is locked for this OPEN thread, only allow returning to the SAME identity.
    if (identityChoiceLocked) {
      const locked = lockedMode;

      if (locked && nextMode === locked) {
        setIdentityError("");
        setProfanityError("");
        setDraft("");
        setEmojiOpen(false);
        setMenuOpen(false);
        setVisibleCount(PAGE_SIZE);

        const threadId =
          targetThread?.id || activeThread?.id || initialThreadId || threads?.[0]?.id || "";

        if (threadId) setActiveId(threadId);

        setMode(locked);
        if (locked === "student") setStudentEmail(loggedInEmail || studentEmail || "");
        else setStudentEmail("");

        // Keep the existing session timer if present; otherwise start it now.
        const now = Date.now();
        setCreatedAtMs((prev) => prev || now);
        setExpiresAtMs((prev) => prev || now + EXPIRE_MS);

        setView("chat");
        return;
      }

      setIdentityError(
        "Identity is locked for this conversation. End the conversation to start again with a different identity.",
      );
      return;
    }

    setStartingMode(true);
    try {
      const wantsAnonymous = nextMode === "anonymous";

      setProfanityError("");
      setIdentityError("");
      setDraft("");
      setEmojiOpen(false);
      setMenuOpen(false);
      setVisibleCount(PAGE_SIZE);

      // ✅ PATCH: DO NOT create/ensure a thread when selecting identity.
      // Session should start ONLY when the student sends the first message.
      const threadId = activeThread?.id || initialThreadId || threads?.[0]?.id || "";

      if (wantsAnonymous) {
        startNewChatSession({
          nextMode: "anonymous",
          nextStudentEmail: "",
          threadId,
        });
        return;
      }

      if (loggedInEmail) {
        startNewChatSession({
          nextMode: "student",
          nextStudentEmail: loggedInEmail,
          threadId,
        });
        return;
      }

      // fallback if not logged-in (kept for compatibility)
      setMode("student");
      setView("email");
    } finally {
      setStartingMode(false);
    }
  }

  async function continueStudent() {
    setEmailTouched(true);
    if (!isValidEmail(studentEmail)) return;

    setStartingMode(true);
    try {
      // ✅ PATCH: No thread creation here; first message will create/ensure.
      const threadId = activeThread?.id || initialThreadId || threads?.[0]?.id || "";

      startNewChatSession({
        nextMode: "student",
        nextStudentEmail: studentEmail,
        threadId,
      });
    } finally {
      setStartingMode(false);
    }
  }

  function toggleIdentity() {
    if (identityLocked) return;
    const next = mode === "student" ? "anonymous" : "student";
    chooseMode(next);
  }

  function handleBack() {
    setMenuOpen(false);
    setEmojiOpen(false);

    // ✅ Requested behavior: Back from chat closes the drawer (no trap).
    if (view === "chat") {
      onClose?.();
      return;
    }

    if (view === "mode") {
      onClose?.();
      return;
    }

    if (view === "email") {
      setView("mode");
      setMode(null);
      setStudentEmail("");
      setEmailTouched(false);
      return;
    }

    setView("mode");
  }

  const EMOJIS = useMemo(
    () => [
      "🙂",
      "😊",
      "😄",
      "😁",
      "😂",
      "🥲",
      "😅",
      "😌",
      "😔",
      "😢",
      "😭",
      "😡",
      "😴",
      "😮",
      "😳",
      "🤔",
      "🙏",
      "💛",
      "💚",
      "💙",
      "✨",
      "👍",
      "👎",
      "✅",
    ],
    [],
  );

  function insertEmoji(emoji) {
    const ta = textareaRef.current;
    if (!ta) {
      setDraft((d) => `${d}${emoji}`);
      return;
    }

    const start = ta.selectionStart ?? draft.length;
    const end = ta.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);

    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  async function handleSend(textOverride) {
    const raw = typeof textOverride === "string" ? textOverride : draft;
    const text = raw.trim();

    if (counselorClosed) return;
    if (!text) return;

    const bad = findProfanity(text, profanityWords);
    if (bad) {
      setProfanityError("Please rephrase without profanity.");
      return;
    }

    setProfanityError("");
    setIdentityError("");
    setDraft("");
    setEmojiOpen(false);

    if (!mode) {
      setIdentityError("Choose Student or Anonymous first.");
      return;
    }

    const payload = {
      // ✅ PATCH: threadId may be empty for brand-new sessions.
      // Parent will ensure/create thread on first send.
      threadId: activeThread?.id || "",
      text,
      senderMode: mode,
    };

    try {
      const result = await onSendMessage?.(payload);

      // ✅ PATCH: If parent created a thread, attach UI to it.
      const ensuredId =
        (result && (result.threadId || result?.item?._id || result?.item?.id)) || "";
      if (!activeThread && ensuredId) {
        setActiveId(String(ensuredId));
      }
    } catch (err) {
      console.error(err);
      setDraft(raw);
    }
  }

  async function endConversationByUser() {
    setMenuOpen(false);
    const ok = window.confirm?.(
      "End this conversation? It will reset to the beginning.",
    );
    if (ok === false) return;

    const threadId =
      activeThread?.id || initialThreadId || threads?.[0]?.id || "";

    try {
      await onEndChat?.({ threadId });
    } catch (e) {
      console.error(e);
    }

    resetToStart();
    onRefreshThreads?.({ reason: "ended" });
  }

  const drawerStyle = useMemo(() => {
    if (isMobile) {
      return {
        ...styles.drawer,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        borderRadius: 0,
        border: "none",
      };
    }

    return {
      ...styles.drawer,
      width: 420,
      height: isSmallHeight ? 560 : 640,
      right: 18,
      bottom: 18,
      borderRadius: 22,
      border: "1px solid rgba(20,20,20,0.10)",
    };
  }, [isMobile, isSmallHeight]);

  const overlayStyle = useMemo(() => {
    return {
      ...styles.overlay,
      background: isMobile ? "rgba(0,0,0,0.45)" : styles.overlay.background,
    };
  }, [isMobile]);

  // ✅ PATCH: allow composing/sending BEFORE a thread exists.
  // Thread will be ensured/created on first send.
  const canSend =
    view === "chat" &&
    draft.trim().length > 0 &&
    !counselorClosed &&
    !!mode &&
    !startingMode;

  const myAvatarFallback = useMemo(() => {
    if (mode === "anonymous") return "A";

    const name = String(userIdentity?.name || userIdentity?.fullName || "").trim();
    const n = initials(name);
    if (n) return n;

    const em = String(loggedInEmail || userIdentity?.email || "").trim();
    return em ? em[0].toUpperCase() : "S";
  }, [mode, userIdentity, loggedInEmail]);

    const counselorAvatarFallback = useMemo(() => {
    const n = initials(counselorDisplayName);
    return n || "C";
  }, [counselorDisplayName]);

  // Identity chooser UI state:
  // - After first message, identity is locked until End conversation.
  // - The locked identity remains enabled as "Return as ..."; the other choice is greyed out.
  const disableStudentChoice =
    startingMode || (identityChoiceLocked && lockedMode !== "student");
  const disableAnonymousChoice =
    startingMode || (identityChoiceLocked && lockedMode !== "anonymous");

  const studentChoiceTitle =
    identityChoiceLocked && lockedMode === "student"
      ? "Return as Student"
      : "Continue as Student";
  const anonymousChoiceTitle =
    identityChoiceLocked && lockedMode === "anonymous"
      ? "Return as Anonymous"
      : "Continue as Anonymous";

  if (!open) return null;

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />

      <div style={drawerStyle} role="dialog" aria-label="Messages">
        <div
          style={{
            ...styles.header,
            background: `linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.86)),
              linear-gradient(90deg, ${headerTint}22, rgba(255,255,255,0))`,
          }}
        >
          <button
            style={styles.headerBtn}
            onClick={handleBack}
            aria-label="Back"
            title="Back"
          >
            ←
          </button>

          <div style={styles.headerTitleWrap}>
            <div style={styles.headerTitleRow}>
              {/* removed header avatar ("C") */}
              <span style={styles.headerTitle}>
                {view === "chat" ? "Counselor Chat" : title}
              </span>

              {view === "chat" && mode ? (
                identitySwitchAllowed ? (
                  <button
                    type="button"
                    onClick={toggleIdentity}
                    style={{ ...styles.modeBadge, cursor: "pointer" }}
                    aria-label="Switch identity"
                    title="Switch identity"
                  >
                    {mode === "student" ? "Student" : "Anonymous"}
                  </button>
                ) : (
                  <span
                    style={{
                      ...styles.modeBadge,
                      opacity: 0.75,
                      cursor: "default",
                    }}
                    aria-label="Identity"
                    title="Identity (locked)"
                  >
                    {mode === "student" ? "Student" : "Anonymous"}
                  </span>
                )
              ) : null}
            </div>

            {view === "chat" ? (
              <div style={styles.sessionLine}>
                {counselorDisplayName} •{" "}
                {countdown
                  ? `Session ends in ${countdown}`
                  : counselorOnline
                    ? "Online now"
                    : "Replies soon"}
              </div>
            ) : null}
          </div>

          <div style={styles.headerRight}>
            <button
              ref={menuBtnRef}
              style={styles.headerBtn}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              title="More options"
            >
              ⋯
            </button>

            <button
              style={styles.headerBtn}
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>

            {menuOpen ? (
              <div
                ref={menuRef}
                style={styles.menu}
                role="menu"
                aria-label="Chat menu"
              >
                {view === "chat" ? (
                  <>
{identitySwitchAllowed ? (
                    <button
                      type="button"
                      style={styles.menuItem}
                      onClick={() => {
                        setMenuOpen(false);
                        toggleIdentity();
                      }}
                      role="menuitem"
                    >
                      {mode === "student"
                        ? "Message anonymously"
                        : "Use Student identity"}
                    </button>
                    ) : null}

                    <div style={styles.menuDivider} />

                    <button
                      type="button"
                      style={{ ...styles.menuItem, ...styles.menuItemDanger }}
                      onClick={endConversationByUser}
                      role="menuitem"
                    >
                      End conversation
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    style={styles.menuItem}
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    Close menu
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {view === "mode" ? (
          <div style={styles.centerWrap}>
            <div style={styles.panel}>
              <div style={styles.panelTitle}>Continue to counselor chat</div>
              <div style={styles.panelText}>
                Choose how you want to start. Session stays open for{" "}
                <b>24 hours</b>.
              </div>

                            {identityError ? (
                <div style={styles.profanityBanner}>{identityError}</div>
              ) : null}

              {identityChoiceLocked ? (
                <div style={styles.lockedHint}>
                  Identity is locked for this conversation.
                  <br />
                  Return as <b>{lockedMode === "anonymous" ? "Anonymous" : "Student"}</b> to continue, or end the
                  conversation to start again with a different identity.
                </div>
              ) : null}

              <div style={{ height: 12 }} />

              <button
                type="button"
                style={{
                  ...styles.bigChoiceBtn,
                  ...(disableStudentChoice ? styles.choiceDisabled : null),
                  background: disableStudentChoice
                    ? "rgba(20,20,20,0.04)"
                    : `${accent}88`,
                }}
                onClick={() => chooseMode("student")}
                disabled={disableStudentChoice}
              >
                <div style={styles.choiceTitle}>{studentChoiceTitle}</div>
                <div style={styles.choiceSub}>
                  {identityChoiceLocked && lockedMode === "student"
                    ? "Return to your current conversation."
                    : loggedInEmail
                      ? "Uses your account email on file."
                      : "Email required for follow-up if needed."}
                </div>
              </button>

              <button
                type="button"
                style={{
                  ...styles.bigChoiceBtnAlt,
                  ...(disableAnonymousChoice ? styles.choiceDisabled : null),
                }}
                onClick={() => chooseMode("anonymous")}
                disabled={disableAnonymousChoice}
              >
                <div style={styles.choiceTitle}>{anonymousChoiceTitle}</div>
                <div style={styles.choiceSub}>
                  {identityChoiceLocked && lockedMode === "anonymous"
                    ? "Return to your current conversation."
                    : "No email required (messages will refresh)."}
                </div>
              </button>
            </div>
          </div>
        ) : view === "email" ? (
          <div style={styles.centerWrap}>
            <div style={styles.panel}>
              <div style={styles.panelTitle}>Student email</div>
              <div style={styles.panelText}>
                Your email is required so we can follow up if the counselor
                doesn’t respond in chat.
              </div>

              <div style={{ height: 14 }} />

              <label style={styles.label}>Email address</label>
              <input
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    continueStudent();
                  }
                }}
                placeholder="name@school.edu"
                style={{
                  ...styles.input,
                  ...(emailTouched && !isValidEmail(studentEmail)
                    ? styles.inputError
                    : null),
                }}
              />

              {emailTouched && !isValidEmail(studentEmail) ? (
                <div style={styles.errorText}>Please enter a valid email.</div>
              ) : (
                <div style={styles.hintText}>Example: name@school.edu</div>
              )}

              <div style={{ height: 14 }} />

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={handleBack}
                >
                  Back
                </button>

                <button
                  type="button"
                  style={{
                    ...styles.primaryBtn,
                    background: `${accent}E6`,
                    ...(isValidEmail(studentEmail)
                      ? null
                      : styles.primaryBtnDisabled),
                  }}
                  onClick={continueStudent}
                  disabled={!isValidEmail(studentEmail) || startingMode}
                >
                  Continue to Chat
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.chatWrap}>
            <div style={styles.systemWrap}>
              <div style={styles.systemBubble}>
                <div style={styles.systemTitle}>Your privacy is valued.</div>
                <div style={styles.systemText}>
                  Counselors will reply as soon as possible. If this is an
                  emergency, contact your local hotline.
                </div>
              </div>

              {profanityError ? (
                <div style={styles.profanityBanner}>{profanityError}</div>
              ) : null}

              {identityError ? (
                <div style={styles.profanityBanner}>{identityError}</div>
              ) : null}
            </div>

            <div
              ref={chatBodyRef}
              style={styles.chatBody}
              onScroll={onChatScroll}
            >
              {normalizedMessages.length > visibleCount ? (
                <div style={styles.loadMoreHint}>Loading earlier messages…</div>
              ) : (
                <div style={styles.loadMoreHintDim}>Start of conversation</div>
              )}

              {chatRows.map((row) => {
                const m = row.msg;
                const isMe = m.from === "me";
                const showAvatar = row.isEnd;
                const showMeta = row.isEnd;

                return (
                  <div
                    key={row.key}
                    style={{ marginBottom: row.isEnd ? 12 : 6 }}
                  >
                    {/* Row 1: avatar + bubble (aligned) */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: isMe ? "flex-end" : "flex-start",
                        gap: 8,
                        alignItems: "flex-end",
                      }}
                    >
                      {!isMe ? (
                        <div style={styles.avatarGutter}>
                          {showAvatar ? (
                            <Avatar
                              size={40}
                              src={counselorAvatarUrl}
                              fallback={counselorAvatarFallback}
                              label="Counselor"
                              title={counselorDisplayName}
                            />
                          ) : (
                            <div style={{ width: 40, height: 40 }} />
                          )}
                        </div>
                      ) : null}

                      <div
                        style={{
                          ...styles.bubble,
                          ...(isMe
                            ? {
                                ...styles.bubbleMe,
                                background: `${accent}BF`,
                              }
                            : styles.bubbleThem),
                          maxWidth: "86%",
                        }}
                      >
                        {m.text ? (
                          <div style={styles.bubbleText}>{m.text}</div>
                        ) : null}
                      </div>

                      {isMe ? (
                        <div style={styles.avatarGutter}>
                          {showAvatar ? (
                            <Avatar
                              size={40}
                              src={mode === "anonymous" ? "" : userAvatarUrl}
                              fallback={myAvatarFallback}
                              label="You"
                              title={mode === "anonymous" ? "Anonymous" : "You"}
                            />
                          ) : (
                            <div style={{ width: 40, height: 40 }} />
                          )}
                        </div>
                      ) : null}
                    </div>

                    {/* Row 2: meta below bubble (does not affect avatar alignment) */}
                    {showMeta ? (
                      <div
                        style={{
                          ...styles.metaRow,
                          justifyContent: isMe ? "flex-end" : "flex-start",
                          paddingLeft: !isMe
                            ? styles.avatarGutter.width + 8
                            : 0,
                          paddingRight: isMe
                            ? styles.avatarGutter.width + 8
                            : 0,
                        }}
                      >
                        <span style={styles.metaText}>
                          {getMessageTimeLabel(m)}
                        </span>
                        {isMe ? (
                          <>
                            <span style={styles.metaDot}>•</span>
                            <span style={styles.metaText}>
                              {getDeliveryLabel(m)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <div ref={chatEndRef} />
            </div>

            <div style={styles.inputBar}>
              <button
                ref={emojiBtnRef}
                style={styles.iconBtn}
                type="button"
                aria-label="Emoji"
                title="Emoji"
                onClick={() => setEmojiOpen((v) => !v)}
              >
                🙂
              </button>

              {emojiOpen ? (
                <div
                  ref={emojiPopRef}
                  style={styles.emojiPopover}
                  role="dialog"
                  aria-label="Emoji picker"
                >
                  <div style={styles.emojiGrid}>
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        style={styles.emojiItem}
                        onClick={() => insertEmoji(e)}
                        aria-label={`Insert ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (profanityError) setProfanityError("");
                }}
                onKeyDownCapture={(e) => {
                  if (e.isComposing) return;
                  const key = e.key || "";
                  const isEnter =
                    key === "Enter" ||
                    key === "NumpadEnter" ||
                    e.keyCode === 13;

                  if (isEnter && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSend(e.currentTarget.value);
                  }
                }}
                placeholder={
                  counselorClosed ? "Conversation closed." : "Type a message…"
                }
                style={{
                  ...styles.textarea,
                  ...(counselorClosed ? styles.textareaDisabled : null),
                }}
                rows={1}
                // ✅ PATCH: allow typing even before thread exists
                disabled={counselorClosed}
              />

              <button
                style={{
                  ...styles.sendIcon,
                  background: `${accent}E6`,
                  ...(canSend ? null : styles.sendIconDisabled),
                }}
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send"
                title="Send"
              >
                ➤
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.25)",
    zIndex: 9998,
  },

  drawer: {
    position: "fixed",
    zIndex: 9999,
    background: "rgba(255,255,255,0.94)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 18px 48px rgba(0,0,0,0.22)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    color: TEXT_MAIN,
  },

  header: {
    padding: "12px 12px",
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    alignItems: "center",
    borderBottom: "1px solid rgba(20,20,20,0.08)",
  },
  headerRight: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid rgba(20,20,20,0.10)",
    background: "rgba(20,20,20,0.04)",
    color: TEXT_MAIN,
    cursor: "pointer",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 14,
    display: "grid",
    placeItems: "center",
  },

  headerTitleWrap: { minWidth: 0, paddingLeft: 10, paddingRight: 10 },
  headerTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: {
    color: TEXT_MAIN,
    fontFamily: "Lora, serif",
    fontWeight: 900,
    fontSize: 19,
    letterSpacing: "0.2px",
  },

  modeBadge: {
    borderRadius: 999,
    padding: "4px 10px",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(185,255,102,0.35)",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 12,
    color: TEXT_MAIN,
  },
  sessionLine: {
    marginTop: 4,
    textAlign: "center",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 12,
    color: "rgba(20,20,20,0.62)",
  },

  menu: {
    position: "absolute",
    right: 0,
    top: 44,
    width: 220,
    borderRadius: 14,
    border: "1px solid rgba(20,20,20,0.10)",
    background: "rgba(255,255,255,0.98)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
    padding: 6,
    zIndex: 50,
  },
  menuItem: {
    width: "100%",
    textAlign: "left",
    border: "1px solid rgba(20,20,20,0.08)",
    background: "rgba(20,20,20,0.03)",
    padding: "10px 10px",
    borderRadius: 12,
    cursor: "pointer",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 13,
    color: "rgba(20,20,20,0.85)",
  },
  menuItemDanger: {
    background: "rgba(198,40,40,0.10)",
    border: "1px solid rgba(198,40,40,0.20)",
    color: "#C62828",
  },
  menuDivider: { height: 8 },

  centerWrap: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  panel: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    border: "1px solid rgba(20,20,20,0.10)",
    background: "rgba(255,255,255,0.80)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.10)",
    padding: 16,
  },
  panelTitle: {
    fontFamily: "Lora, serif",
    fontWeight: 900,
    fontSize: 18,
    color: TEXT_MAIN,
  },
  panelText: {
    marginTop: 6,
    fontFamily: "Nunito, sans-serif",
    fontWeight: 750,
    fontSize: 14,
    color: "rgba(20,20,20,0.72)",
    lineHeight: 1.55,
  },

  bigChoiceBtn: {
    width: "100%",
    textAlign: "left",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(185,255,102,0.55)",
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(0,0,0,0.08)",
    marginBottom: 10,
  },
  bigChoiceBtnAlt: {
    width: "100%",
    textAlign: "left",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(20,20,20,0.04)",
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(0,0,0,0.08)",
  },
  choiceTitle: {
    fontFamily: "Lora, serif",
    fontWeight: 900,
    fontSize: 16,
    color: TEXT_MAIN,
  },
  choiceSub: {
    marginTop: 6,
    fontFamily: "Lora, serif",
    fontWeight: 500,
    fontSize: 13,
    color: "rgba(20,20,20,0.70)",
    lineHeight: 1.4,
  },


  // Identity picker lock (after first message)
  lockedHint: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(20,20,20,0.10)",
    background: "rgba(245,245,245,0.90)",
    color: "rgba(20,20,20,0.78)",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 13,
    lineHeight: 1.35,
  },
  choiceDisabled: {
    opacity: 0.55,
    filter: "grayscale(100%)",
    cursor: "not-allowed",
  },
  label: {
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 13,
    color: "rgba(20,20,20,0.70)",
  },
  input: {
    marginTop: 8,
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    padding: "12px 12px",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 800,
    fontSize: 14,
    outline: "none",
    background: "rgba(255,255,255,0.98)",
  },
  inputError: {
    border: "1px solid rgba(198,40,40,0.65)",
    boxShadow: "0 0 0 3px rgba(198,40,40,0.10)",
  },
  hintText: {
    marginTop: 8,
    fontFamily: "Nunito, sans-serif",
    fontWeight: 800,
    fontSize: 12.5,
    color: "rgba(20,20,20,0.60)",
  },
  errorText: {
    marginTop: 8,
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 12.5,
    color: "#C62828",
  },

  primaryBtn: {
    flex: 1,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(185,255,102,0.90)",
    padding: "12px 14px",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    cursor: "pointer",
  },
  primaryBtnDisabled: { opacity: 0.55, cursor: "not-allowed" },
  secondaryBtn: {
    width: 110,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(20,20,20,0.04)",
    padding: "12px 14px",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    cursor: "pointer",
  },

  chatWrap: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },

  systemWrap: { padding: "12px 12px 0px" },
  systemBubble: {
    borderRadius: 18,
    border: "1px solid rgba(20,20,20,0.10)",
    background: "rgba(255,255,255,0.85)",
    padding: 12,
    boxShadow: "0 12px 26px rgba(0,0,0,0.08)",
  },
  systemTitle: {
    fontFamily: "Lora, serif",
    fontWeight: 900,
    fontSize: 14,
    color: TEXT_MAIN,
  },
  systemText: {
    marginTop: 6,
    fontFamily: "Nunito, sans-serif",
    fontWeight: 800,
    fontSize: 12.5,
    color: "rgba(20,20,20,0.72)",
    lineHeight: 1.45,
  },

  profanityBanner: {
    marginTop: 10,
    borderRadius: 14,
    border: "1px solid rgba(198,40,40,0.25)",
    background: "rgba(198,40,40,0.10)",
    padding: 10,
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 12.5,
    color: "#C62828",
  },

  chatBody: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "10px 12px 0px",
  },
  loadMoreHint: {
    textAlign: "center",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 12,
    color: "rgba(20,20,20,0.62)",
    marginBottom: 10,
  },
  loadMoreHintDim: {
    textAlign: "center",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 12,
    color: "rgba(20,20,20,0.42)",
    marginBottom: 10,
  },

  avatarGutter: {
    width: 44, // number so we can use it for meta indent
    display: "flex",
    justifyContent: "center",
    paddingBottom: 2,
  },

  bubble: {
    borderRadius: 18,
    padding: "10px 12px",
    border: "1px solid rgba(0,0,0,0.10)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.06)",
  },
  bubbleMe: { background: "rgba(185,255,102,0.75)" },
  bubbleThem: { background: "rgba(255,255,255,0.90)" },

  bubbleText: {
    fontFamily: "Nunito, sans-serif",
    fontWeight: 850,
    fontSize: 14,
    color: TEXT_MAIN,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  metaRow: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  metaText: {
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 11.5,
    color: "rgba(20,20,20,0.55)",
  },
  metaDot: {
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 11.5,
    color: "rgba(20,20,20,0.35)",
  },

  inputBar: {
    position: "relative",
    padding: 10,
    paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
    borderTop: "1px solid rgba(20,20,20,0.08)",
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    background: "rgba(255,255,255,0.92)",
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    border: "1px solid rgba(20,20,20,0.10)",
    background: "rgba(20,20,20,0.04)",
    cursor: "pointer",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 18,
    display: "grid",
    placeItems: "center",
  },

  textarea: {
    flex: 1,
    resize: "none",
    borderRadius: 16,
    border: "1px solid rgba(20,20,20,0.10)",
    padding: "10px 12px",
    outline: "none",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 850,
    fontSize: 14,
    color: TEXT_MAIN,
    background: "rgba(255,255,255,0.92)",
    lineHeight: 1.4,
    minHeight: 40,
    maxHeight: 120,
  },
  textareaDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },

  sendIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    border: "1px solid rgba(20,20,20,0.10)",
    background: "rgba(185,255,102,0.85)",
    cursor: "pointer",
    fontFamily: "Nunito, sans-serif",
    fontWeight: 900,
    fontSize: 16,
    display: "grid",
    placeItems: "center",
  },
  sendIconDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },

  emojiPopover: {
    position: "absolute",
    left: 10,
    bottom: 62,
    width: 260,
    borderRadius: 16,
    border: "1px solid rgba(20,20,20,0.10)",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
    padding: 10,
    zIndex: 55,
  },
  emojiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(8, 1fr)",
    gap: 6,
  },
  emojiItem: {
    borderRadius: 12,
    border: "1px solid rgba(20,20,20,0.08)",
    background: "rgba(20,20,20,0.03)",
    padding: "6px 0",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
  },
};