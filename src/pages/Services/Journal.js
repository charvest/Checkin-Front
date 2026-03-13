// src/pages/Journal.js
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/** CheckIn palette */
const CHECKIN_GREEN = "#B9FF66";
const CHECKIN_DARK = "#141414";

/** =========================
    STORAGE
========================= */
const ENTRIES_KEY_PREFIX = "journal_entries_v1";
const TERMS_KEY_PREFIX = "journal_terms_accepted_v1";

// Legacy (older builds used global keys — unsafe across multiple users on same device)
const LEGACY_ENTRIES_KEY = "journal_entries_v1";
const LEGACY_TERMS_KEY = "journal_terms_accepted_v1";
const LEGACY_OWNER_KEY = "journal_entries_owner_v1";

/** =========================
    ✅ Coping (from old Journal.js)
    - Dropdown removed (chips only)
========================= */
const COPING_QUICK = [
  "Breathing",
  "Talked to someone",
  "Walk / Stretch",
  "Rest",
  "Music",
  "Prayer",
  "Other",
];

/** =========================
    JOURNAL API (DB sync)
    - Uses same Bearer token auth as the rest of your app
    - Keeps localStorage as a safety net (refresh/offline)
========================= */
const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");

function getAuthTokenSafe() {
  try {
    return (
      window.localStorage.getItem("token") ||
      window.sessionStorage.getItem("token")
    );
  } catch {
    return null;
  }
}

async function apiUpsertJournalEntry(dateKey, payload, { signal } = {}) {
  const token = getAuthTokenSafe();
  if (!token) throw new Error("Not authorized: missing token");

  const url = `${API_BASE}/api/journal/entries/${encodeURIComponent(dateKey)}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Failed to save journal entry");
  }
  return data?.entry || null;
}

async function apiListJournalEntries({ from, to, limit = 500, signal } = {}) {
  const token = getAuthTokenSafe();
  if (!token) throw new Error("Not authorized: missing token");

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (limit) qs.set("limit", String(limit));

  const url = `${API_BASE}/api/journal/entries?${qs.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Failed to load journal entries");
  }
  return Array.isArray(data?.entries) ? data.entries : [];
}

/** Notes limit */
const NOTES_WORD_LIMIT = 100;

/** Tracker days */
const TRACKER_DAYS = 7;

/** =========================
    Storage helpers
========================= */
function loadEntries(key = LEGACY_ENTRIES_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveEntries(entries, key = LEGACY_ENTRIES_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function loadTermsAccepted(key = LEGACY_TERMS_KEY) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function saveTermsAccepted(key = LEGACY_TERMS_KEY) {
  try {
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

/* =========================
   ✅ Auth + per-user storage keys
========================= */
function readStorageItem(key) {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function getAuthFromStorage() {
  const token = readStorageItem("token");
  let user = null;
  try {
    const raw = readStorageItem("user");
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }
  const userId = user?._id || user?.id || null;
  return { token, user, userId };
}

function entriesKeyForUser(userId) {
  return `${ENTRIES_KEY_PREFIX}:${userId || "anon"}`;
}

function termsKeyForUser(userId) {
  return `${TERMS_KEY_PREFIX}:${userId || "anon"}`;
}

/**
 * ✅ Prevent accidental cross-user migration:
 * Only migrate legacy global entries if they were last written by the SAME userId.
 */
function maybeMigrateLegacyEntries({ userId, entriesKey }) {
  try {
    const owner = localStorage.getItem(LEGACY_OWNER_KEY) || null;
    if (!owner || !userId || owner !== String(userId)) return;

    const already = localStorage.getItem(entriesKey);
    if (already) return;

    const legacy = localStorage.getItem(LEGACY_ENTRIES_KEY);
    if (!legacy) return;

    localStorage.setItem(entriesKey, legacy);
    // keep legacy too (do NOT delete) — safer for recovery
  } catch {
    // ignore
  }
}

/** Keep PHQ shape for back-compat + ✅ add copingUsed */
function ensureEntryShape(e) {
  const base = {
    mood: "",
    reason: "",
    notes: "",
    copingUsed: [],
    daySubmitted: false,
    daySubmittedAt: null,
    clientUpdatedAt: null,
    phq: {
      answers: Array(9).fill(null),
      submitted: false,
      score: null,
      completedAt: null,
    },
  };
  if (!e) return base;

  const copingUsed = Array.isArray(e?.copingUsed)
    ? e.copingUsed.filter(Boolean)
    : [];

  return {
    ...base,
    ...e,
    notes: typeof e.notes === "string" ? e.notes : "",
    copingUsed,
    daySubmitted: !!e?.daySubmitted,
    daySubmittedAt: e?.daySubmittedAt || null,
    clientUpdatedAt:
      typeof e?.clientUpdatedAt === "number"
        ? e.clientUpdatedAt
        : base.clientUpdatedAt,
    phq: {
      ...base.phq,
      ...(e.phq || {}),
      answers: Array.isArray(e?.phq?.answers)
        ? [...e.phq.answers].slice(0, 9).concat(Array(9).fill(null)).slice(0, 9)
        : Array(9).fill(null),
      submitted: !!e?.phq?.submitted,
      score: typeof e?.phq?.score === "number" ? e.phq.score : null,
      completedAt: e?.phq?.completedAt || null,
    },
  };
}

function getEntry(entries, dateKey) {
  return ensureEntryShape(entries?.[dateKey]);
}

function setEntry(entries, dateKey, patch) {
  const prev = getEntry(entries, dateKey);
  return {
    ...entries,
    [dateKey]: {
      ...prev,
      ...patch,
      copingUsed: Array.isArray(patch?.copingUsed)
        ? patch.copingUsed
        : prev.copingUsed,
      phq: patch?.phq ? { ...prev.phq, ...patch.phq } : prev.phq,
    },
  };
}

/** =========================
    Helpers
========================= */
const MOOD_MESSAGE = {
  Happy: "Protect your good energy today. Share it if you can.",
  Calm: "Nice. Keep this calm momentum going.",
  Okay: "You’re doing okay. Small steps still count.",
  Stressed: "Slow breath in, slower breath out — you’re safe.",
  Sad: "Be gentle with yourself today. You don’t have to rush.",
  Angry: "It’s okay to feel this way. Pause before reacting.",
  Fear: "You’re not alone. Take one grounding breath.",
  Surprise: "Unexpected moments happen. Stay present.",
  Disgust: "That reaction makes sense. Step back if needed.",
};

function safeText(s) {
  const t = (s || "").trim();
  return t ? t : "—";
}

function isDateKey(k) {
  return /^\d{4}-\d{2}-\d{2}$/.test(k);
}

/** ✅ Local day key */
function getTodayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateFromKeyLocal(key) {
  const [y, m, d] = (key || "").split("-").map((x) => Number(x));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function keyFromDateLocal(dt) {
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatNiceDate(dateKey) {
  const [y, m, d] = (dateKey || "").split("-").map((x) => Number(x));
  if (!y || !m || !d) return dateKey || "";
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatNiceTime(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Build tracker series (Saved moods only) — LOCAL date math */
function buildTrackerSeries(entries, baseDateKey, days = TRACKER_DAYS) {
  const list = [];
  const base = dateFromKeyLocal(baseDateKey);

  for (let i = 0; i < days; i++) {
    const x = new Date(base);
    x.setDate(base.getDate() - (days - 1 - i));

    const key = keyFromDateLocal(x);
    const label = `${x.getMonth() + 1}/${x.getDate()}`;
    const e = getEntry(entries, key);

    const mood = e.daySubmitted ? e.mood || null : null;
    list.push({ key, label, mood });
  }
  return list;
}

/** Wellness tips */
function tipsForEntry(entry) {
  const isSubmitted = !!entry?.daySubmitted;
  if (!isSubmitted) {
    return {
      personalized: false,
      label: "Wellness Tips",
      tips: [
        "Save today’s Mood + Reason to tailor your tips.",
        "Quick reset: slow inhale (4s), slower exhale (6–8s) × 5 breaths.",
        "Do one small win: 5–10 minutes only.",
      ],
    };
  }

  const mood = (entry?.mood || "").trim();
  const reason = (entry?.reason || "").trim();
  const notes = (entry?.notes || "").trim();

  let core = [];
  const low = ["Sad", "Angry", "Stressed", "Fear", "Disgust"].includes(mood);
  const high = ["Happy", "Calm"].includes(mood);

  if (low) {
    core = [
      "Grounding: name 5 things you see, 4 you feel, 3 you hear.",
      "Body reset: water + stretch shoulders/neck for 2 minutes.",
      "Pick ONE task only (smallest next step).",
    ];
  } else if (high) {
    core = [
      "Protect your good day: keep sleep + meals consistent.",
      "Share the energy: message one friend / family member.",
      "5-minute tidy or walk to keep momentum.",
    ];
  } else {
    core = [
      "Balance check: 10-minute focus + 2-minute break.",
      "Move a little: short walk or light stretching.",
      "Write 1 sentence: what helped today?",
    ];
  }

  const addOns = [];
  if (reason === "School")
    addOns.push(
      "School tip: do the easiest task first to break procrastination.",
    );
  if (reason === "Family")
    addOns.push("Family tip: set a small boundary (ex: “I need 10 minutes”).");
  if (reason === "Friends")
    addOns.push(
      "Friends tip: clarify one thing with a short message instead of overthinking.",
    );
  if (reason === "Health")
    addOns.push("Health tip: gentle routine (water, light food, rest).");
  if (reason === "Other")
    addOns.push(
      "Try naming the trigger in 1 short sentence—clarity lowers stress.",
    );

  const noteAdd = notes
    ? ["Your note matters—re-read it and highlight one thing you did well."]
    : [];

  return {
    personalized: true,
    label: "Wellness Tips",
    tips: [...core, ...addOns.slice(0, 1), ...noteAdd].slice(0, 4),
  };
}

/** Icons */
function IconChevron({ className = "", down = true }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d={down ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 3v3M17 3v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.5 9h15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.5 6h11c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-11c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWellness({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 21s-7-4.6-9-9.2C1.3 8 3.7 5.5 6.6 5.5c1.9 0 3.4 1 4.4 2.5 1-1.5 2.5-2.5 4.4-2.5 2.9 0 5.3 2.5 3.6 6.3C19 16.4 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M7.2 12h2.4l1.2-2.2 1.4 4.2 1.2-2h2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBolt({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13 2L3 14h7l-1 8 12-14h-7l-1-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCheck({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Step icons */
function IconMood({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8.5 10.2h0.01M15.5 10.2h0.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M8.3 14.2c1.1 1.6 2.7 2.5 3.7 2.5s2.6-.9 3.7-2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconReason({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 18l-3 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8 9h8M8 12h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconNotes({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M14 3v4a1 1 0 0 0 1 1h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8 12h8M8 16h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCoping({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* Clean heart + centered plus (matches the Coping card header & step chip) */}
      <path
        d="M12 21s-7-4.6-9-9.2C1.3 8 3.7 5.5 6.6 5.5c1.9 0 3.4 1 4.4 2.5 1-1.5 2.5-2.5 4.4-2.5 2.9 0 5.3 2.5 3.6 6.3C19 16.4 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.8v6.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8.9 11.9h6.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Tiny animated SVG mascot (no assets) */
function StepMascot({ show }) {
  const reduce = useReducedMotion();
  if (!show) return null;

  return (
    <motion.div
      className="absolute -top-2 -right-2"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        animate={reduce ? {} : { y: [0, -4, 0], rotate: [0, -8, 8, 0] }}
        transition={
          reduce ? {} : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <path
          d="M12 2l1.4 4.1L18 7.5l-4.6 1.4L12 13l-1.4-4.1L6 7.5l4.6-1.4L12 2Z"
          stroke="rgba(20,20,20,0.9)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle
          cx="19"
          cy="5"
          r="1.2"
          fill="rgba(185,255,102,0.95)"
          stroke="rgba(0,0,0,0.35)"
        />
      </motion.svg>
    </motion.div>
  );
}

/** Mobile step button */
function MobileStepButton({
  label,
  active,
  done,
  disabled,
  onClick,
  icon: Icon,
}) {
  const wrapClass = done
    ? "bg-[#B9FF66]/70 border-black/20 text-black"
    : active
      ? "bg-black/5 border-black/30 text-black"
      : "bg-white border-black/10 text-black/50";

  const bubbleClass = done
    ? "bg-black text-white"
    : active
      ? "bg-[#B9FF66]/55 text-[#141414]"
      : "bg-black/10 text-black/55";

  const labelClass = done
    ? "text-black"
    : active
      ? "text-black"
      : "text-black/55";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "relative min-w-0",
        "flex flex-col items-center justify-center",
        "rounded-xl border px-2 py-2",
        "transition",
        disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-black/[0.03]",
        wrapClass,
      ].join(" ")}
      aria-current={active ? "step" : undefined}
      aria-disabled={disabled ? "true" : undefined}
    >
      <StepMascot show={active && !done && !disabled} />

      <div
        className={[
          "mb-1 rounded-full flex items-center justify-center",
          "h-7 w-7 sm:h-8 sm:w-8",
          bubbleClass,
        ].join(" ")}
        style={{
          boxShadow:
            active && !done ? "0 10px 22px rgba(185,255,102,0.22)" : "none",
        }}
      >
        {done ? (
          <IconCheck className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        )}
      </div>

      <div
        className={[
          "w-full text-center font-extrabold leading-tight truncate",
          "text-[clamp(13px,3vw,15px)]",
          labelClass,
        ].join(" ")}
      >
        {label}
      </div>
    </button>
  );
}

/** =========================
    3D-ish EMOTE (SVG)
========================= */
function MoodEmote({ mood = "Okay", size = 28, className = "" }) {
  // ✅ Use the same Unicode emoji style as Counselor Inbox (no SVG brows / no "unibrow" risk)
  const MOOD_EMOJI = {
    Happy: "😄",
    Calm: "😌",
    Okay: "🙂",
    Stressed: "😣",
    Sad: "😢",
    Angry: "😠",
    Fear: "😨",
    Surprise: "😮",
    Disgust: "🤢",
  };

  const emo = MOOD_EMOJI[mood] || "🙂";

  return (
    <span
      className={className}
      style={{
        fontSize: typeof size === "number" ? `${size}px` : size,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden="true"
    >
      {emo}
    </span>
  );
}

/** Doodles (kept minimal + light) */
function DoodleSpark({ className = "" }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M60 10l7 18 18 7-18 7-7 18-7-18-18-7 18-7 7-18Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** UI helpers */
function Pill({ children, tone = "light" }) {
  const styles =
    tone === "green"
      ? {
          background: "rgba(185,255,102,0.60)",
          border: "rgba(0,0,0,0.14)",
          color: CHECKIN_DARK,
        }
      : tone === "dark"
        ? {
            background: "rgba(20,20,20,0.92)",
            border: "rgba(0,0,0,0.12)",
            color: "white",
          }
        : tone === "warn"
          ? {
              background: "rgba(255, 214, 102,0.55)",
              border: "rgba(0,0,0,0.14)",
              color: CHECKIN_DARK,
            }
          : tone === "error"
            ? {
                background: "rgba(255, 120, 120, 0.20)",
                border: "rgba(220, 38, 38, 0.35)",
                color: "rgba(185, 28, 28, 0.95)",
              }
            : {
                background: "rgba(0,0,0,0.03)",
                border: "rgba(0,0,0,0.12)",
                color: "rgba(0,0,0,0.70)",
              };

  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-extrabold"
      style={{
        background: styles.background,
        borderColor: styles.border,
        color: styles.color,
      }}
    >
      {children}
    </span>
  );
}

function IconMiniCheck({ className = "" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16.2 5.8 8.7 13.3 3.8 8.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMiniCloud({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7.5 18.5h9.2a4.3 4.3 0 0 0 .6-8.6A5.7 5.7 0 0 0 6.6 8.6 4.2 4.2 0 0 0 7.5 18.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMiniWarn({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3.5 22 20.5H2L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 17.2h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpinnerMini({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2.8a9.2 9.2 0 1 0 9.2 9.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloudStatusPill({ status, message }) {
  const tone =
    status === "saved" ? "green" : status === "error" ? "error" : "light";
  const Icon =
    status === "saving"
      ? SpinnerMini
      : status === "saved"
        ? IconMiniCheck
        : status === "error"
          ? IconMiniWarn
          : IconMiniCloud;

  return (
    <Pill tone={tone}>
      <span className="inline-flex items-center gap-2">
        <span className={status === "saving" ? "animate-spin" : ""}>
          <Icon className="h-4 w-4" />
        </span>
        <span>{message}</span>
      </span>
    </Pill>
  );
}

function Card({ title, right, children, className = "", bodyClassName = "" }) {
  return (
    <div
      className={`rounded-[26px] border border-black/10 bg-white/85 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col ${className}`}
    >
      <div className="px-5 py-4 bg-black/[0.02] flex items-center justify-between gap-3">
        <div
          className="text-[16px] sm:text-[17px] lg:text-[18px] font-extrabold text-[#141414] flex items-center gap-2"
          style={{ fontFamily: "Lora, serif" }}
        >
          {title}
        </div>
        {right}
      </div>
      <div className={`p-5 lg:p-6 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function Chip({ active, children, onClick, left, disabled }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      whileHover={disabled ? {} : { y: -1 }}
      className="
        px-3.5 py-2.5 rounded-full border text-[13px] lg:text-[14px] font-extrabold transition
        inline-flex items-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2
      "
      style={{
        borderColor: active ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.14)",
        background: active
          ? "linear-gradient(180deg, rgba(185,255,102,0.60), rgba(185,255,102,0.30))"
          : "rgba(255,255,255,0.90)",
        color: CHECKIN_DARK,
        boxShadow: active
          ? "0 14px 40px rgba(0,0,0,0.10)"
          : "0 8px 24px rgba(0,0,0,0.05)",
      }}
      aria-pressed={active ? "true" : "false"}
    >
      {left}
      {children}
    </motion.button>
  );
}

/** Mood mapping for tracker */
function moodToLevel(mood) {
  if (!mood) return null;
  if (mood === "Angry") return 0;
  if (mood === "Stressed") return 1;
  if (mood === "Sad" || mood === "Fear" || mood === "Disgust") return 1;
  if (mood === "Okay" || mood === "Surprise") return 2;
  if (mood === "Calm" || mood === "Happy") return 3;
  return 2;
}

/** Graph helpers */
function buildSmoothPath(pts) {
  const p = pts.filter((x) => x.y !== null);
  if (p.length < 2) return "";
  const tension = 0.25;
  const d = [];
  d.push(`M ${p[0].x} ${p[0].y}`);
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

function MoodTracker({
  series,
  todayKey,
  title = "Mood Tracker",
  subtitle = "Saved mood for the last 7 days.",
  compact = false,
}) {
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const w = 860;
  const h = compact ? 128 : 160;
  const padX = 34;
  const padYTop = 30;
  const padYBottom = 30;

  // Emoji marker above each saved mood point
  const EMOJI_SIZE = compact ? 20 : 24;
  const EMOJI_LIFT = 10; // px gap above the dot

  const shouldReduceMotion = useReducedMotion();
  const gid = useId();
  const gradId = `g1-${gid}`;
  const bandId = `bands-${gid}`;

  const days = series.length;
  const step = days > 1 ? (w - padX * 2) / (days - 1) : 0;

  const yForLevel = (lvl) => {
    const usable = h - padYTop - padYBottom;
    return padYTop + usable * (1 - lvl / 3);
  };

  const points = useMemo(() => {
    return series.map((d, i) => {
      const lvl = moodToLevel(d.mood);
      return {
        ...d,
        i,
        x: padX + i * step,
        y: lvl === null ? null : yForLevel(lvl),
      };
    });
  }, [series, step]);

  const path = useMemo(() => buildSmoothPath(points), [points]);
  const lineTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.9, ease: "easeOut" };
  const hasAny = useMemo(() => points.some((p) => p.y !== null), [points]);

  return (
    <div className="rounded-[24px] border border-black/10 bg-white shadow-[0_14px_40px_rgba(0,0,0,0.07)] overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <div
          className="text-[15px] lg:text-[16px] font-extrabold text-[#141414] flex items-center gap-2"
          style={{ fontFamily: "Lora, serif" }}
        >
          {title}
          <span className="text-[11px] font-extrabold text-black/35"></span>
        </div>
        {!compact && (
          <div className="text-[12px] text-black/45 mt-1">{subtitle}</div>
        )}
      </div>

      <div className="px-3 pb-4">
        <div className="w-full overflow-x-auto md:overflow-visible">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full min-w-[520px] md:min-w-0"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(185,255,102,0.26)" />
                <stop offset="100%" stopColor="rgba(185,255,102,0.00)" />
              </linearGradient>
              <linearGradient id={bandId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(0,0,0,0.03)" />
                <stop offset="33%" stopColor="rgba(0,0,0,0.01)" />
                <stop offset="66%" stopColor="rgba(0,0,0,0.02)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.03)" />
              </linearGradient>
            </defs>

            <rect
              x={padX}
              y={padYTop}
              width={w - padX * 2}
              height={h - padYTop - padYBottom}
              rx="14"
              fill={`url(#${bandId})`}
              opacity="0.9"
            />
            <rect
              x={padX}
              y={padYTop}
              width={w - padX * 2}
              height={h - padYTop - padYBottom}
              rx="14"
              fill={`url(#${gradId})`}
              opacity="0.50"
            />

            <line
              x1={padX}
              y1={h - padYBottom}
              x2={w - padX}
              y2={h - padYBottom}
              stroke="rgba(0,0,0,0.10)"
              strokeWidth="2"
            />

            {points.map((p) => (
              <line
                key={`grid-${p.i}`}
                x1={p.x}
                y1={h - padYBottom}
                x2={p.x}
                y2={padYTop + 10}
                stroke="rgba(0,0,0,0.06)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}

            {path && (
              <>
                <motion.path
                  d={path}
                  fill="none"
                  stroke="rgba(0,0,0,0.10)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  initial={{ pathLength: shouldReduceMotion ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={lineTransition}
                />
                <motion.path
                  d={path}
                  fill="none"
                  stroke="rgba(185,255,102,0.95)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: shouldReduceMotion ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={lineTransition}
                />
              </>
            )}

            {points.map((p) => {
              const isToday = todayKey && p.key === todayKey;
              return (
                <g key={p.key}>
                  {p.y !== null ? (
                    <>
                      <motion.circle
                        cx={p.x}
                        cy={p.y}
                        r={isToday ? 12 : 8}
                        fill={
                          isToday
                            ? "rgba(185,255,102,0.30)"
                            : "rgba(185,255,102,0.22)"
                        }
                        initial={{ scale: shouldReduceMotion ? 1 : 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
                      />
                      <motion.circle
                        cx={p.x}
                        cy={p.y}
                        r={isToday ? 6 : 4.5}
                        fill="rgba(20,20,20,0.9)"
                        initial={{ scale: shouldReduceMotion ? 1 : 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
                      />

                      {/* Mood emoji above point */}
                      <foreignObject
                        x={p.x - EMOJI_SIZE / 2}
                        y={clamp(
                          p.y - (EMOJI_SIZE + EMOJI_LIFT),
                          2,
                          h - EMOJI_SIZE - 2,
                        )}
                        width={EMOJI_SIZE}
                        height={EMOJI_SIZE}
                        style={{ overflow: "visible", pointerEvents: "none" }}
                      >
                        <div
                          xmlns="http://www.w3.org/1999/xhtml"
                          style={{
                            width: `${EMOJI_SIZE}px`,
                            height: `${EMOJI_SIZE}px`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <MoodEmote mood={p.mood} size={EMOJI_SIZE} />
                        </div>
                      </foreignObject>

                      {/* ✅ Today badge fixed + positioned above the point */}
                      {isToday &&
                        (() => {
                          const badgeW = 50;
                          const badgeH = 18;
                          const rawX = p.x - badgeW / 2;
                          const tx = clamp(rawX, 6, w - badgeW - 6);
                          const ty = clamp(p.y - 74, 6, h - badgeH - 6);

                          return (
                            <g transform={`translate(${tx}, ${ty})`}>
                              <rect
                                x="0"
                                y="0"
                                width={badgeW}
                                height={badgeH}
                                rx="9"
                                fill="rgba(20,20,20,0.92)"
                              />
                              <text
                                x={badgeW / 2}
                                y={12.5}
                                textAnchor="middle"
                                fontSize="11"
                                fill="white"
                                fontWeight="900"
                              >
                                Today
                              </text>
                            </g>
                          );
                        })()}
                    </>
                  ) : (
                    <circle
                      cx={p.x}
                      cy={h - padYBottom}
                      r="3.5"
                      fill="rgba(0,0,0,0.18)"
                    />
                  )}

                  {p.label && (
                    <text
                      x={p.x}
                      y={h - 9}
                      textAnchor="middle"
                      fontSize="12"
                      fill="rgba(0,0,0,0.55)"
                      fontWeight="800"
                      className={p.i % 2 === 1 ? "hidden sm:block" : ""}
                    >
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}

            {!hasAny && (
              <g>
                <text
                  x={w / 2}
                  y={h / 2}
                  textAnchor="middle"
                  fontSize="14"
                  fill="rgba(0,0,0,0.55)"
                  fontWeight="800"
                >
                  No saved moods yet
                </text>
                <text
                  x={w / 2}
                  y={h / 2 + 18}
                  textAnchor="middle"
                  fontSize="12"
                  fill="rgba(0,0,0,0.45)"
                  fontWeight="700"
                >
                  Pick a mood and press Save to start tracking
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

/** =========================
    History Modal (Responsive + Footer Actions)
========================= */
function HistoryModal({
  open,
  onClose,
  items,
  entries,
  trackerSeriesForDate,
  todayKey,
}) {
  const [page, setPage] = useState("list");
  const [selectedDate, setSelectedDate] = useState(null);
  const [visibleCount, setVisibleCount] = useState(7);

  const listScrollRef = useRef(null);
  const detailScrollRef = useRef(null);
  const listSentinelRef = useRef(null);

  const visibleItems = useMemo(
    () => items.slice(0, Math.min(items.length, Math.max(7, visibleCount))),
    [items, visibleCount],
  );

  useEffect(() => {
    if (!open) return;
    setPage("list");
    setSelectedDate(null);
    setVisibleCount(7);
    requestAnimationFrame(() => {
      if (listScrollRef.current) listScrollRef.current.scrollTop = 0;
    });
  }, [open]);

  useEffect(() => {
    setVisibleCount((v) => {
      const min = 7;
      const max = items.length || min;
      return Math.max(min, Math.min(v, max));
    });
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    if (page !== "list") return;

    const root = listScrollRef.current;
    const sentinel = listSentinelRef.current;

    if (!root || !sentinel) return;
    if (visibleCount >= items.length) return;

    const obs = new IntersectionObserver(
      (obsEntries) => {
        if (obsEntries.some((e) => e.isIntersecting)) {
          setVisibleCount((v) => Math.min(items.length, v + 14));
        }
      },
      { root, rootMargin: "140px" },
    );

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [open, page, items.length, visibleCount]);

  const detailEntry = useMemo(
    () => (selectedDate ? getEntry(entries, selectedDate) : null),
    [entries, selectedDate],
  );
  const detailTracker = useMemo(
    () => (selectedDate ? trackerSeriesForDate?.(selectedDate) || [] : []),
    [selectedDate, trackerSeriesForDate],
  );

  function goDetail(date) {
    setSelectedDate(date);
    setPage("detail");
    requestAnimationFrame(() => {
      if (detailScrollRef.current) detailScrollRef.current.scrollTop = 0;
    });
  }

  function goList() {
    setPage("list");
    requestAnimationFrame(() => {
      if (listScrollRef.current) listScrollRef.current.scrollTop = 0;
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center px-2 sm:px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/25" onClick={onClose} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="History"
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="
              relative
              w-[calc(100vw-12px)] sm:w-[calc(100vw-24px)]
              max-w-3xl
              rounded-[20px] sm:rounded-[24px]
              border border-black/10
              bg-white
              shadow-xl
              overflow-hidden
            "
          >
            <div
              className="p-4 sm:p-6"
              style={{
                background: `radial-gradient(900px 260px at 15% 0%, ${CHECKIN_GREEN} 0%, transparent 62%)`,
              }}
            >
              <div
                className="text-[15px] sm:text-[16px] font-extrabold text-[#141414]"
                style={{ fontFamily: "Lora, serif" }}
              >
                {page === "list" ? "History" : "History detail"}
              </div>
              <div className="mt-1 text-[12px] sm:text-[13px] text-black/60 font-semibold">
                {page === "list"
                  ? "Tap a date to view it."
                  : "Review the saved entry."}
              </div>
            </div>

            <div className="p-3 sm:p-4">
              {page === "list" ? (
                <div className="w-full">
                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-[13px] text-black/60">
                      No saved entries yet.
                    </div>
                  ) : (
                    <div
                      ref={listScrollRef}
                      className="max-h-[62vh] sm:max-h-[65vh] overflow-auto rounded-2xl border border-black/10 pb-20 sm:pb-24"
                    >
                      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur px-3 sm:px-4 py-2 border-b border-black/10 text-[11px] text-black/55 font-semibold">
                        Showing latest {visibleItems.length} of {items.length}.
                        Scroll down to load earlier entries.
                      </div>

                      {visibleItems.map((it, idx) => (
                        <button
                          key={it.date}
                          type="button"
                          onClick={() => goDetail(it.date)}
                          className="w-full text-left px-3 sm:px-4 py-3 hover:bg-black/[0.03] transition"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[13px] font-extrabold text-[#141414] flex items-center gap-2">
                              {it.mood ? (
                                <span className="inline-flex items-center justify-center h-7 w-7 rounded-xl border border-black/10 bg-white">
                                  <MoodEmote mood={it.mood} size={18} />
                                </span>
                              ) : null}
                              {formatNiceDate(it.date)}
                            </div>
                            <div className="text-[12px] text-black/55 font-semibold">
                              {it.dayLocked ? "Saved" : "Draft"}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-black/65">
                            <span
                              className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                              style={{ borderColor: "rgba(0,0,0,0.12)" }}
                            >
                              <span className="font-extrabold">Mood:</span>{" "}
                              {it.mood || "—"}
                            </span>
                            <span
                              className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                              style={{ borderColor: "rgba(0,0,0,0.12)" }}
                            >
                              <span className="font-extrabold">Reason:</span>{" "}
                              {it.reason || "—"}
                            </span>

                            {it.copingPreview ? (
                              <span
                                className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                                style={{ borderColor: "rgba(0,0,0,0.12)" }}
                              >
                                <span className="font-extrabold">Coping:</span>{" "}
                                {it.copingPreview}
                              </span>
                            ) : null}

                            {it.notesPreview && (
                              <span
                                className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                                style={{ borderColor: "rgba(0,0,0,0.12)" }}
                              >
                                <span className="font-extrabold">Note:</span>{" "}
                                {it.notesPreview}
                              </span>
                            )}
                          </div>

                          {idx !== visibleItems.length - 1 && (
                            <div className="mt-3 h-px bg-black/10" />
                          )}
                        </button>
                      ))}

                      <div ref={listSentinelRef} className="h-10" />

                      {visibleCount < items.length && (
                        <div className="px-3 sm:px-4 pb-4">
                          <button
                            type="button"
                            onClick={() =>
                              setVisibleCount((v) =>
                                Math.min(items.length, v + 14),
                              )
                            }
                            className="w-full rounded-xl border border-black/10 bg-black/[0.02] px-4 py-2 text-[12px] font-extrabold text-[#141414] hover:bg-black/[0.04] transition"
                          >
                            Load earlier entries
                          </button>
                          <div className="mt-2 text-[11px] text-black/55 font-semibold">
                            Tip: keep scrolling to load more.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full">
                  {!selectedDate || !detailEntry ? (
                    <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-[13px] text-black/60">
                      No date selected.
                    </div>
                  ) : (
                    <div
                      ref={detailScrollRef}
                      className="max-h-[62vh] sm:max-h-[65vh] overflow-auto rounded-2xl border border-black/10 bg-white pb-20 sm:pb-24"
                    >
                      <div
                        className="p-4 border-b border-black/10"
                        style={{ background: "rgba(0,0,0,0.02)" }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[13px] font-extrabold text-[#141414]">
                              {formatNiceDate(selectedDate)}
                            </div>
                            <div className="text-[12px] text-black/55 font-semibold mt-1">
                              {detailEntry.daySubmitted ? "Saved" : "Draft"}
                            </div>
                          </div>

                          <div
                            className="h-9 rounded-full px-3 text-[12px] font-extrabold inline-flex items-center"
                            style={{
                              backgroundColor: CHECKIN_GREEN,
                              color: CHECKIN_DARK,
                              border: "1px solid rgba(0,0,0,0.15)",
                            }}
                          >
                            View only
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-black/65">
                          <span
                            className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                            style={{ borderColor: "rgba(0,0,0,0.12)" }}
                          >
                            <span className="font-extrabold">Mood:</span>{" "}
                            {safeText(detailEntry.mood)}
                          </span>
                          <span
                            className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                            style={{ borderColor: "rgba(0,0,0,0.12)" }}
                          >
                            <span className="font-extrabold">Reason:</span>{" "}
                            {safeText(detailEntry.reason)}
                          </span>
                        </div>
                      </div>

                      {/* ✅ Coping (history detail) */}
                      <div className="p-4 border-b border-black/10">
                        <div className="text-[12px] font-extrabold text-black/70 flex items-center gap-2">
                          <IconCoping className="h-4 w-4 text-black/55" />
                          Coping used
                        </div>
                        <div className="mt-2 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-[13px] text-black/70">
                          {Array.isArray(detailEntry.copingUsed) &&
                          detailEntry.copingUsed.length
                            ? detailEntry.copingUsed.join(", ")
                            : "—"}
                        </div>
                      </div>

                      <div className="p-4 border-b border-black/10">
                        <div className="text-[12px] font-extrabold text-black/70">
                          Notes
                        </div>
                        <div className="mt-2 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-[13px] text-black/70 whitespace-pre-wrap">
                          {safeText(detailEntry.notes)}
                        </div>
                      </div>

                      <div className="p-4 border-b border-black/10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[12px] font-extrabold text-black/70 flex items-center gap-2">
                            <IconWellness className="h-4 w-4 text-black/55" />
                            Wellness Tips
                          </div>

                          {(() => {
                            const w = tipsForEntry(detailEntry);
                            return w.personalized ? (
                              <Pill tone="green">For you</Pill>
                            ) : (
                              <Pill>General</Pill>
                            );
                          })()}
                        </div>

                        {(() => {
                          const w = tipsForEntry(detailEntry);
                          return (
                            <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                              {w.personalized && (
                                <div className="text-[12px] text-black/55 font-semibold mb-2">
                                  Based on your mood + reason for this day.
                                </div>
                              )}
                              <ul className="text-[13px] text-black/70 leading-relaxed space-y-2">
                                {w.tips.map((t, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2"
                                  >
                                    <span
                                      className="mt-[6px] h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: CHECKIN_GREEN }}
                                    />
                                    <span>{t}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="p-4">
                        <MoodTracker
                          series={detailTracker}
                          todayKey={todayKey}
                          title="Mood Tracker"
                          compact
                          subtitle="Saved mood for the last 7 days."
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 border-t border-black/10 bg-white/92 backdrop-blur px-3 sm:px-4 py-3">
              <div className="flex items-center justify-end gap-2 flex-wrap">
                {page === "detail" && (
                  <button
                    type="button"
                    onClick={goList}
                    className="h-9 sm:h-10 rounded-full border border-black/15 bg-white px-3 sm:px-4 text-[12px] sm:text-[13px] font-extrabold text-black/70 hover:bg-black/5 transition"
                  >
                    Back
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 sm:h-10 rounded-full px-3 sm:px-4 text-[12px] sm:text-[13px] font-extrabold transition"
                  style={{ backgroundColor: CHECKIN_DARK, color: "white" }}
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** =========================
    Terms Modal (MANDATORY)
========================= */
function TermsModal({ open, onAgree }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") e.preventDefault();
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/25" />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Terms and Conditions"
            initial={{ y: 18, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.985 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2 }}
            className="relative w-full max-w-2xl rounded-[24px] border border-black/10 bg-white shadow-xl overflow-hidden"
          >
            <div
              className="p-6"
              style={{
                background: `radial-gradient(900px 260px at 15% 0%, ${CHECKIN_GREEN} 0%, transparent 62%)`,
              }}
            >
              <div
                className="text-[18px] sm:text-[20px] font-black text-[#141414]"
                style={{ fontFamily: "Lora, serif" }}
              >
                Terms & Conditions
              </div>
              <div className="mt-2 text-[13px] text-black/65 font-semibold">
                You must accept to use the Journal and Mood Tracker.
              </div>
            </div>

            <div className="p-6 pt-4">
              <div className="max-h-[55vh] overflow-auto rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-[13px] text-black/75 leading-relaxed">
                <ul className="space-y-2">
                  <li>
                    <span className="font-extrabold text-black/80">
                      Purpose:
                    </span>{" "}
                    This Journal is for daily reflection and mood tracking.
                  </li>
                  <li>
                    <span className="font-extrabold text-black/80">
                      Not medical advice:
                    </span>{" "}
                    This tool is not a substitute for professional help.
                  </li>
                  <li>
                    <span className="font-extrabold text-black/80">
                      Respect & privacy:
                    </span>{" "}
                    Keep your notes respectful and avoid sharing sensitive info
                    you don’t want stored on this device.
                  </li>
                  <li>
                    <span className="font-extrabold text-black/80">
                      Responsibility:
                    </span>{" "}
                    You are responsible for how you use this feature and your
                    device access.
                  </li>
                </ul>

                <div className="mt-4 rounded-xl border border-black/10 bg-white/80 p-3">
                  <div className="text-[12px] font-extrabold text-black/70">
                    Emergency note
                  </div>
                  <div className="mt-1 text-[12px] text-black/65">
                    If you feel unsafe or in immediate danger, contact local
                    emergency services or a trusted person right away.
                  </div>
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <button
                  type="button"
                  onClick={onAgree}
                  className="h-11 rounded-full px-6 text-[13px] font-extrabold"
                  style={{
                    backgroundColor: CHECKIN_DARK,
                    color: "white",
                    textTransform: "none",
                    writingMode: "horizontal-tb",
                    paddingRight: "20px",
                    paddingLeft: "20px",
                  }}
                >
                  Agree & Continue
                </button>
              </div>

              <div className="mt-3 text-[11px] text-black/55 font-semibold">
                You cannot proceed without accepting.
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Notes card */
function NotesCard({ notes, setNotes, disabled = false }) {
  const [copied, setCopied] = useState(false);

  const words = useMemo(() => {
    const trimmed = (notes || "").trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [notes]);

  async function copyNotes() {
    try {
      await navigator.clipboard.writeText(notes || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  function onChange(e) {
    if (disabled) return;
    const value = e.target.value ?? "";
    const tokens = value.match(/\S+/g) || [];
    if (tokens.length <= NOTES_WORD_LIMIT) {
      setNotes(value);
      return;
    }

    let count = 0;
    let i = 0;
    const len = value.length;
    while (i < len) {
      while (i < len && /\s/.test(value[i])) i++;
      if (i >= len) break;
      while (i < len && !/\s/.test(value[i])) i++;
      count++;
      if (count >= NOTES_WORD_LIMIT) break;
    }
    const clamped = value.slice(0, i).replace(/\s+$/g, "");
    setNotes(clamped);
  }

  return (
    <div className="rounded-[24px] border border-black/10 bg-white shadow-[0_14px_40px_rgba(0,0,0,0.07)] overflow-hidden">
      <div className="px-5 py-4 bg-black/[0.02] flex items-center justify-between gap-2">
        <div
          className="text-[14px] lg:text-[16px] font-extrabold text-[#141414] flex items-center gap-2"
          style={{ fontFamily: "Lora, serif" }}
        >
          Notes
          <span className="text-[11px] font-extrabold text-black/35">
            (optional)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[12px] font-extrabold text-black/65">
            {words}/{NOTES_WORD_LIMIT}
          </div>

          {disabled && (
            <button
              type="button"
              onClick={copyNotes}
              className="h-9 rounded-full border border-black/15 bg-white px-3 text-[12px] font-extrabold text-black/75 hover:bg-black/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          )}
        </div>
      </div>

      <div className="p-5 lg:p-6">
        {disabled ? (
          <>
            <div
              className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-[13px] text-black/80 whitespace-pre-wrap"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              {safeText(notes)}
            </div>
            <div className="mt-3 text-[12px] text-black/60">
              Saved today — notes are view-only.
            </div>
          </>
        ) : (
          <>
            <textarea
              value={notes}
              onChange={onChange}
              disabled={disabled}
              placeholder="One sentence is enough — what happened today?"
              className="w-full min-h-[150px] lg:min-h-[180px] rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] lg:text-[14px] text-black/80 outline-none focus:border-black/25 focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2"
            />
            <div className="mt-3 text-[12px] text-black/60">
              Optional, but helpful for reflection.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
const JOURNAL_TUTORIAL_KEY = "checkin:tutorial:journal";

function readTutorialSeen(key) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markTutorialSeen(key) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}

function getTutorialRect(node) {
  if (!node || typeof node.getBoundingClientRect !== "function") return null;
  const rect = node.getBoundingClientRect();
  return {
    top: Math.max(10, rect.top - 10),
    left: Math.max(10, rect.left - 10),
    width: Math.max(96, rect.width + 20),
    height: Math.max(52, rect.height + 20),
  };
}

function ServiceTutorialOverlay({
  open,
  steps,
  stepIndex,
  onNext,
  onSkip,
  ariaLabel = "Journal tutorial",
  accentColor = "#B9FF66",
  accentText = "#141414",
}) {
  const step = steps?.[stepIndex] || null;
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!open || !step?.targetRef?.current) {
      setRect(null);
      return undefined;
    }

    const target = step.targetRef.current;
    const update = () => setRect(getTutorialRect(target));

    target.scrollIntoView?.({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
    update();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step]);

  if (!open || !step) return null;

  const isLast = stepIndex === steps.length - 1;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 720;
  const cardWidth = Math.min(360, viewportW - 32);

  const cardTop = rect
    ? rect.top + rect.height + 18 + 210 > viewportH
      ? Math.max(18, rect.top - 198)
      : rect.top + rect.height + 18
    : 24;

  const cardLeft = rect
    ? Math.min(Math.max(16, rect.left), viewportW - cardWidth - 16)
    : 16;

  return (
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        aria-label="Skip tutorial"
        onClick={onSkip}
        className="absolute inset-0 bg-black/25"
      />

      {rect && (
        <div
          className="pointer-events-none fixed rounded-[26px] border border-white/80 transition-all duration-200"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px rgba(20,20,20,0.42)",
          }}
        />
      )}

      <div
        className="fixed rounded-[26px] border border-white/15 bg-[#141414] text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] p-5 sm:p-6"
        style={{
          top: cardTop,
          left: cardLeft,
          width: cardWidth,
          maxWidth: "calc(100vw - 32px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.16em] text-white/55">
              Step {stepIndex + 1} of {steps.length}
            </div>
            <div className="mt-2 text-[18px] font-black leading-tight">
              {step.title}
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-white/78">
              {step.description}
            </p>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-black text-white/80 transition hover:bg-white/10"
            aria-label="Close tutorial"
          >
            ×
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-[14px] font-extrabold text-white/82 transition hover:bg-white/10"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={onNext}
            className="rounded-full px-5 py-2.5 text-[14px] font-extrabold transition"
            style={{
              backgroundColor: accentColor,
              color: accentText,
              boxShadow: "0 16px 40px rgba(185,255,102,0.28)",
            }}
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
/** =========================
    Main Journal Page
========================= */
export default function Journal() {
  const shouldReduceMotion = useReducedMotion();

  // ✅ who is using the journal (scopes local cache + terms)
  const { userId } = getAuthFromStorage();
  const entriesStorageKey = entriesKeyForUser(userId);
  const termsStorageKey = termsKeyForUser(userId);
  const headingRef = useRef(null);
  const stepsNavRef = useRef(null);
  const moodTrackerRef = useRef(null);
  const moodCardRef = useRef(null);
  const copingCardRef = useRef(null);
  const reasonCardRef = useRef(null);
  const wellnessTipsRef = useRef(null);
  const notesCardRef = useRef(null);
  const actionsRef = useRef(null);

  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [todayKey, setTodayKey] = useState(() => getTodayKey());
  const [termsAccepted, setTermsAccepted] = useState(() =>
    loadTermsAccepted(termsStorageKey),
  );
  const tutorialSteps = useMemo(
    () => [
      {
        targetRef: headingRef,
        title: "Welcome to your Journal",
        description:
          "Use this space for a quick daily check-in — mood, reason, optional notes, and coping you tried.",
      },
      {
        targetRef: moodTrackerRef,
        title: "Mood Tracker",
        description:
          "See your saved moods over the last 7 days. Today’s point shows your latest saved mood.",
      },
      {
        targetRef: stepsNavRef,
        title: "Daily progress",
        description:
          "Jump between Mood, Reason, Notes, Coping, and Done. Finish what matters most first.",
      },
      {
        targetRef: moodCardRef,
        title: "Mood",
        description:
          "Pick how you feel today. This drives your tracker and can personalize tips.",
      },
      {
        targetRef: copingCardRef,
        title: "Coping",
        description:
          "Tap what you tried today (breathing, walk/stretch, music, etc.). Tap again to remove.",
      },
      {
        targetRef: reasonCardRef,
        title: "Reason",
        description:
          "Choose what’s influencing your mood (school, family, friends, health, other).",
      },
      {
        targetRef: wellnessTipsRef,
        title: "Wellness Tips",
        description:
          "Helpful suggestions based on your mood + reason. Unlocks after accepting Terms.",
      },
      {
        targetRef: notesCardRef,
        title: "Notes",
        description:
          "Optional space to capture what happened, what helped, and what you want to remember.",
      },
      {
        targetRef: actionsRef,
        title: "Save & review",
        description:
          "Use History to review entries, Clear to reset today’s draft, and Save when ready.",
      },
    ],
    [],
  );

  const closeTutorial = useCallback(() => {
    markTutorialSeen(JOURNAL_TUTORIAL_KEY);
    setTutorialOpen(false);
    setTutorialStep(0);
  }, []);

  const nextTutorialStep = useCallback(() => {
    setTutorialStep((prev) => {
      if (prev >= tutorialSteps.length - 1) {
        closeTutorial();
        return 0;
      }
      return prev + 1;
    });
  }, [closeTutorial, tutorialSteps.length]);

  useEffect(() => {
    if (!termsAccepted) return;
    if (readTutorialSeen(JOURNAL_TUTORIAL_KEY)) return;

    const id = window.setTimeout(() => {
      setTutorialOpen(true);
      setTutorialStep(0);
    }, 600);

    return () => window.clearTimeout(id);
  }, [termsAccepted]);
  /** ✅ Refresh “Today” on focus + at local midnight */
  useEffect(() => {
    const tick = () => {
      const next = getTodayKey();
      setTodayKey((prev) => (prev === next ? prev : next));
    };

    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1,
        0,
      );
      const ms = Math.max(250, nextMidnight.getTime() - now.getTime());
      return window.setTimeout(() => {
        tick();
      }, ms);
    };

    window.addEventListener("focus", tick);
    const midnightTimer = scheduleMidnight();

    return () => {
      window.removeEventListener("focus", tick);
      window.clearTimeout(midnightTimer);
    };
  }, []);

  const [entries, setEntries] = useState(() => {
    maybeMigrateLegacyEntries({ userId, entriesKey: entriesStorageKey });
    return loadEntries(entriesStorageKey);
  });

  // ✅ When user changes (login/logout), load that user's local cache + terms
  useEffect(() => {
    setEntries(loadEntries(entriesStorageKey));
    setTermsAccepted(loadTermsAccepted(termsStorageKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesStorageKey, termsStorageKey]);

  const savedEntry = useMemo(
    () => getEntry(entries, todayKey),
    [entries, todayKey],
  );

  /** =========================
      LOAD FROM CLOUD (per user)
  ========================= */
  const cloudSupportsCoping = useRef(true);

  useEffect(() => {
    const token = getAuthTokenSafe();
    if (!token) return;

    let alive = true;
    const ac = new AbortController();

    (async () => {
      try {
        const to = todayKey;
        const d = new Date();
        d.setDate(d.getDate() - 180);
        const from = d.toISOString().slice(0, 10);

        const cloudEntries = await apiListJournalEntries({
          from,
          to,
          limit: 1000,
          signal: ac.signal,
        });
        if (!alive) return;

        if (cloudEntries.length) {
          const merged = { ...loadEntries(entriesStorageKey) };
          for (const ce of cloudEntries) {
            const k = String(ce.dateKey || "").trim();
            if (!k) continue;

            const local = merged[k] || {};
            const localTs = Number(local.clientUpdatedAt || 0);
            const cloudTs = Number(ce.clientUpdatedAt || 0);

            const cloudWins =
              cloudTs >= localTs || (ce.daySubmitted && !local.daySubmitted);

            if (cloudWins) {
              merged[k] = ensureEntryShape({
                ...local,
                ...ce,
                daySubmittedAt:
                  ce.daySubmittedAt || local.daySubmittedAt || null,
              });
            }
          }

          const ok = saveEntries(merged, entriesStorageKey);
          setSaveFailed(!ok);
          setEntries(merged);
          setCloudSaved("Synced from cloud — you’re up to date.");
        } else {
          setCloudIdle();
        }
      } catch (e) {
        setCloudError(
          e?.message
            ? `Could not load cloud journal: ${e.message}`
            : "Could not load cloud journal.",
        );
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, entriesStorageKey]);

  const dayLocked = !!savedEntry.daySubmitted;
  const inputsDisabled = dayLocked || !termsAccepted;

  const [mood, setMood] = useState(savedEntry.mood || "");
  const [reason, setReason] = useState(savedEntry.reason || "");
  const [notes, setNotes] = useState(savedEntry.notes || "");
  const [copingUsed, setCopingUsed] = useState(
    Array.isArray(savedEntry.copingUsed) ? savedEntry.copingUsed : [],
  );
  const [moodCollapsed, setMoodCollapsed] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Cloud sync status (MongoDB)
  const [cloudSync, setCloudSync] = useState({ status: "idle", message: "" });
  const cloudTimer = useRef(null);
  const cloudAbort = useRef(null);
  const pendingCloudRef = useRef(null);

  // UX: show sync as a small pill and auto-hide success
  const [showCloudPill, setShowCloudPill] = useState(false);
  const cloudPillTimer = useRef(null);

  useEffect(() => {
    if (cloudSync.status === "idle") {
      setShowCloudPill(false);
      if (cloudPillTimer.current) {
        clearTimeout(cloudPillTimer.current);
        cloudPillTimer.current = null;
      }
      return;
    }

    setShowCloudPill(true);

    if (cloudSync.status === "saved") {
      if (cloudPillTimer.current) clearTimeout(cloudPillTimer.current);
      cloudPillTimer.current = setTimeout(() => setShowCloudPill(false), 2600);
    } else {
      if (cloudPillTimer.current) {
        clearTimeout(cloudPillTimer.current);
        cloudPillTimer.current = null;
      }
    }
  }, [cloudSync.status, cloudSync.message]);

  useEffect(() => {
    return () => {
      if (cloudPillTimer.current) clearTimeout(cloudPillTimer.current);
    };
  }, []);

  function setCloudIdle() {
    setCloudSync({ status: "idle", message: "" });
  }
  function setCloudSaving(msg = "Saving to cloud...") {
    setCloudSync({ status: "saving", message: msg });
  }
  function setCloudSaved(msg = "Saved to cloud.") {
    setCloudSync({ status: "saved", message: msg });
  }
  function setCloudError(msg = "Cloud sync failed. Saved locally.") {
    setCloudSync({ status: "error", message: msg });
  }

  const saveTimer = useRef(null);

  /** ✅ Notes are optional */
  /** ✅ Notes and Coping are optional (but tracked) */
  const step = useMemo(() => {
    if (!termsAccepted) return "terms";
    if (dayLocked) return "save";
    if (!mood) return "mood";
    if (!reason) return "reason";

    const hasNotes = (notes || "").trim().length > 0;
    const hasCoping = Array.isArray(copingUsed) && copingUsed.length > 0;

    // guide the user through optional steps, without blocking Save
    if (!hasNotes && !hasCoping) return "notes";
    if (!hasNotes) return "notes";
    if (!hasCoping) return "coping";
    return "save";
  }, [termsAccepted, dayLocked, mood, reason, notes, copingUsed]);

  const progress = useMemo(() => {
    if (!termsAccepted) return 0;
    let p = 0;

    // ✅ Required steps
    if (mood) p += 34;
    if (reason) p += 33;

    // ✅ Optional steps (but tracked in the progress UI)
    if ((notes || "").trim().length > 0) p += 16;
    if (Array.isArray(copingUsed) && copingUsed.length > 0) p += 17;

    if (dayLocked) p = 100;
    return Math.min(100, p);
  }, [termsAccepted, mood, reason, notes, copingUsed, dayLocked]);

  const focusMoodRef = useRef(null);
  const focusReasonRef = useRef(null);
  const focusNotesRef = useRef(null);
  const focusCopingRef = useRef(null);

  const jumpToStep = useCallback(
    (k) => {
      if (inputsDisabled) return;
      if (k === "mood") {
        setMoodCollapsed(false);
        focusMoodRef.current?.scrollIntoView?.({
          behavior: "smooth",
          block: "start",
        });
      }
      if (k === "reason")
        focusReasonRef.current?.scrollIntoView?.({
          behavior: "smooth",
          block: "start",
        });
      if (k === "notes")
        focusNotesRef.current?.scrollIntoView?.({
          behavior: "smooth",
          block: "start",
        });
      if (k === "coping")
        focusCopingRef.current?.scrollIntoView?.({
          behavior: "smooth",
          block: "start",
        });
      if (k === "save") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [inputsDisabled],
  );

  /** keep inputs synced when day changes */
  useEffect(() => {
    const e = getEntry(entries, todayKey);
    setMood(e.mood || "");
    setReason(e.reason || "");
    setNotes(e.notes || "");
    setCopingUsed(Array.isArray(e.copingUsed) ? e.copingUsed : []);
    setSaveFailed(false);
    setMoodCollapsed(false);
  }, [todayKey, entries]);

  const isDirty = useMemo(() => {
    if (inputsDisabled) return false;
    const sameMood = (savedEntry.mood || "") === (mood || "");
    const sameReason = (savedEntry.reason || "") === (reason || "");
    const sameNotes = (savedEntry.notes || "") === (notes || "");
    const a = Array.isArray(savedEntry.copingUsed) ? savedEntry.copingUsed : [];
    const b = Array.isArray(copingUsed) ? copingUsed : [];
    const sameCoping = a.length === b.length && a.every((x, i) => x === b[i]);
    return !(sameMood && sameReason && sameNotes && sameCoping);
  }, [inputsDisabled, savedEntry, mood, reason, notes, copingUsed]);

  /** ✅ No side-effects inside setEntries updater */
  function commitEntries(next, { pulse = false } = {}) {
    const ok = saveEntries(next, entriesStorageKey);
    setSaveFailed(!ok);
    if (ok && pulse) pulseSaved();
    setEntries(next);
  }

  function pulseSaved() {
    setSavedPulse(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedPulse(false), 1100);
  }

  async function upsertCloudWithFallback(dateKey, payload, { signal } = {}) {
    // If the backend rejects unknown fields, retry once without copingUsed.
    try {
      return await apiUpsertJournalEntry(dateKey, payload, { signal });
    } catch (err) {
      if (
        cloudSupportsCoping.current &&
        Object.prototype.hasOwnProperty.call(payload || {}, "copingUsed")
      ) {
        try {
          const { copingUsed: _drop, ...rest } = payload || {};
          const res = await apiUpsertJournalEntry(dateKey, rest, { signal });
          cloudSupportsCoping.current = false; // stop sending copingUsed to cloud if backend is strict
          return res;
        } catch {
          throw err;
        }
      }
      throw err;
    }
  }

  /** =========================
      AUTO-SAVE (LOCAL + CLOUD)
  ========================= */
  useEffect(() => {
    if (inputsDisabled || !termsAccepted || dayLocked) return;
    if (!isDirty) return;

    const t = window.setTimeout(() => {
      const clientUpdatedAt = Date.now();

      const next = setEntry(entries, todayKey, {
        mood: (mood || "").trim(),
        reason: (reason || "").trim(),
        notes: notes ?? "",
        copingUsed: Array.isArray(copingUsed) ? copingUsed : [],
        daySubmitted: false,
        daySubmittedAt: null,
        clientUpdatedAt,
      });

      commitEntries(next);

      const basePayload = {
        mood: (mood || "").trim(),
        reason: (reason || "").trim(),
        notes: notes ?? "",
        daySubmitted: false,
        clientUpdatedAt,
      };

      pendingCloudRef.current = {
        dateKey: todayKey,
        payload: cloudSupportsCoping.current
          ? {
              ...basePayload,
              copingUsed: Array.isArray(copingUsed) ? copingUsed : [],
            }
          : basePayload,
      };

      if (cloudTimer.current) window.clearTimeout(cloudTimer.current);
      cloudTimer.current = window.setTimeout(async () => {
        const pending = pendingCloudRef.current;
        if (!pending) return;

        try {
          setCloudSaving();
          if (cloudAbort.current) cloudAbort.current.abort();
          cloudAbort.current = new AbortController();

          await upsertCloudWithFallback(pending.dateKey, pending.payload, {
            signal: cloudAbort.current.signal,
          });
          pendingCloudRef.current = null;
          setCloudSaved();
        } catch (e) {
          setCloudError(
            e?.message
              ? `Cloud sync failed: ${e.message}`
              : "Cloud sync failed. Saved locally.",
          );
        }
      }, 900);
    }, 450);

    return () => window.clearTimeout(t);
  }, [
    inputsDisabled,
    termsAccepted,
    dayLocked,
    isDirty,
    entries,
    todayKey,
    mood,
    reason,
    notes,
    copingUsed,
    entriesStorageKey,
  ]);

  // ✅ On refresh/close: force-save latest draft to localStorage synchronously
  useEffect(() => {
    const onBeforeUnload = () => {
      if (inputsDisabled || !termsAccepted || dayLocked) return;
      if (!isDirty) return;

      const clientUpdatedAt = Date.now();
      const next = setEntry(entries, todayKey, {
        mood: (mood || "").trim(),
        reason: (reason || "").trim(),
        notes: notes ?? "",
        copingUsed: Array.isArray(copingUsed) ? copingUsed : [],
        daySubmitted: false,
        daySubmittedAt: null,
        clientUpdatedAt,
      });

      try {
        localStorage.setItem(entriesStorageKey, JSON.stringify(next));
      } catch {}
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [
    inputsDisabled,
    termsAccepted,
    dayLocked,
    isDirty,
    entries,
    todayKey,
    mood,
    reason,
    notes,
    copingUsed,
    entriesStorageKey,
  ]);

  // Retry any pending cloud save when browser comes back online
  useEffect(() => {
    const onOnline = async () => {
      const pending = pendingCloudRef.current;
      if (!pending) return;
      try {
        setCloudSaving("Back online — syncing...");
        await upsertCloudWithFallback(pending.dateKey, pending.payload);
        pendingCloudRef.current = null;
        setCloudSaved("Synced after reconnect.");
      } catch (e) {
        setCloudError(
          e?.message
            ? `Cloud sync failed: ${e.message}`
            : "Cloud sync failed. Saved locally.",
        );
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const wellnessUnlocked = !!termsAccepted && !!mood && !!reason;

  const wellness = useMemo(
    () =>
      tipsForEntry({
        ...savedEntry,
        mood,
        reason,
        notes,
        daySubmitted: wellnessUnlocked,
      }),
    [savedEntry, mood, reason, notes, wellnessUnlocked],
  );

  const canSave = useMemo(() => {
    if (inputsDisabled) return false;
    return !!(mood && reason);
  }, [inputsDisabled, mood, reason]);

  async function saveNow() {
    if (dayLocked || !termsAccepted) return;
    if (!canSave) {
      setCloudError("Please select a Mood and Reason before saving.");
      return;
    }

    if (cloudTimer.current) {
      window.clearTimeout(cloudTimer.current);
      cloudTimer.current = null;
    }
    pendingCloudRef.current = null;

    const prevSaved = getEntry(entries, todayKey);
    const nowISO = new Date().toISOString();

    const next = setEntry(entries, todayKey, {
      mood: (mood || "").trim(),
      reason: (reason || "").trim(),
      notes: notes ?? "",
      copingUsed: Array.isArray(copingUsed) ? copingUsed : [],
      daySubmitted: true,
      daySubmittedAt: prevSaved.daySubmittedAt || nowISO,
      clientUpdatedAt: Date.now(),
    });

    commitEntries(next, { pulse: true });

    try {
      setCloudSaving("Finalizing in cloud...");
      if (cloudAbort.current) cloudAbort.current.abort();
      cloudAbort.current = new AbortController();

      const basePayload = {
        mood: (mood || "").trim(),
        reason: (reason || "").trim(),
        notes: notes ?? "",
        daySubmitted: true,
        clientUpdatedAt: Date.now(),
      };

      const payload = cloudSupportsCoping.current
        ? {
            ...basePayload,
            copingUsed: Array.isArray(copingUsed) ? copingUsed : [],
          }
        : basePayload;

      await upsertCloudWithFallback(todayKey, payload, {
        signal: cloudAbort.current.signal,
      });
      pendingCloudRef.current = null;
      setCloudSaved("Finalized and saved to cloud.");
    } catch (e) {
      const basePayload = {
        mood: (mood || "").trim(),
        reason: (reason || "").trim(),
        notes: notes ?? "",
        daySubmitted: true,
        clientUpdatedAt: Date.now(),
      };
      pendingCloudRef.current = {
        dateKey: todayKey,
        payload: cloudSupportsCoping.current
          ? {
              ...basePayload,
              copingUsed: Array.isArray(copingUsed) ? copingUsed : [],
            }
          : basePayload,
      };
      setCloudError(
        e?.message
          ? `Cloud save failed: ${e.message}`
          : "Cloud save failed. Saved locally.",
      );
    }
  }

  function clearTodayDraft() {
    if (dayLocked || !termsAccepted) return;

    setMood("");
    setReason("");
    setNotes("");
    setCopingUsed([]);
    setMoodCollapsed(false);
    setSaveFailed(false);

    const next = setEntry(entries, todayKey, {
      mood: "",
      reason: "",
      notes: "",
      copingUsed: [],
      daySubmitted: false,
      daySubmittedAt: null,
    });
    commitEntries(next);
  }

  /** Coping helpers (chips only) */
  const toggleCoping = useCallback(
    (value) => {
      if (inputsDisabled) return;
      if (!value) return;
      setCopingUsed((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.includes(value)
          ? list.filter((x) => x !== value)
          : [...list, value];
      });
    },
    [inputsDisabled],
  );

  const trackerSeries = useMemo(
    () => buildTrackerSeries(entries, todayKey, TRACKER_DAYS),
    [entries, todayKey],
  );
  const trackerSeriesForDate = useCallback(
    (baseDate) => buildTrackerSeries(entries, baseDate, TRACKER_DAYS),
    [entries],
  );

  const moods = [
    "Happy",
    "Calm",
    "Okay",
    "Stressed",
    "Sad",
    "Angry",
    "Fear",
    "Surprise",
    "Disgust",
  ];
  const reasons = ["School", "Family", "Friends", "Health", "Other"];

  /** ✅ History: includes coping preview */
  const historyItems = useMemo(() => {
    const keys = Object.keys(entries || {}).filter(isDateKey);

    const truncate = (s, n = 52) => {
      const t = (s || "").trim();
      if (!t) return "";
      return t.length > n ? `${t.slice(0, n)}…` : t;
    };

    const copingPreview = (arr) => {
      const list = Array.isArray(arr) ? arr.filter(Boolean) : [];
      if (!list.length) return "";
      const joined = list.slice(0, 2).join(", ");
      return list.length > 2 ? `${joined}…` : joined;
    };

    return keys
      .map((k) => {
        const e = getEntry(entries, k);

        const hasText = !!(
          e.mood ||
          e.reason ||
          (e.notes || "").trim() ||
          (Array.isArray(e.copingUsed) && e.copingUsed.length)
        );
        if (!hasText) return null;

        const noteTrim = (e.notes || "").trim();
        const notesPreview = noteTrim
          ? noteTrim.length > 22
            ? `${noteTrim.slice(0, 22)}…`
            : noteTrim
          : "";

        const w = tipsForEntry(e);
        const wellnessPreview = truncate(w?.tips?.[0] || "");

        return {
          date: k,
          mood: e.mood || "",
          reason: e.reason || "",
          notesPreview,
          copingPreview: copingPreview(e.copingUsed),
          dayLocked: !!e.daySubmitted,
          phqSubmitted: !!e?.phq?.submitted,
          wellnessPreview,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [entries]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const nudgeText = useMemo(() => {
    if (!termsAccepted) return "Please accept Terms & Conditions to continue.";
    if (dayLocked) return "Nice work — you’ve completed today’s check-in!";
    if (!mood) return "Step 1: choose your mood.";
    if (!reason) return "Step 2: choose the reason.";

    const hasNotes = (notes || "").trim().length > 0;
    const hasCoping = Array.isArray(copingUsed) && copingUsed.length > 0;

    if (!hasNotes && !hasCoping)
      return "Optional: add a short note or coping — or Save to lock today.";
    if (!hasNotes) return "Optional: add a short note — or Save to lock today.";
    if (!hasCoping)
      return "Optional: add a coping strategy — or Save to lock today.";
    return "Final step: Save to lock today.";
  }, [termsAccepted, dayLocked, mood, reason, notes, copingUsed]);

  const savedTimeLabel = useMemo(
    () =>
      savedEntry?.daySubmittedAt
        ? formatNiceTime(savedEntry.daySubmittedAt)
        : "",
    [savedEntry],
  );

  const activeEmoteAnim = useMemo(
    () => (shouldReduceMotion ? {} : { y: [0, -2, 0] }),
    [shouldReduceMotion],
  );

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        fontFamily:
          "Nunito, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        background: `
          radial-gradient(1100px 520px at 18% 0%, rgba(185,255,102,0.48) 0%, rgba(185,255,102,0.00) 58%),
          radial-gradient(980px 480px at 70% 6%, rgba(218,252,182,0.55) 0%, rgba(218,252,182,0.00) 62%),
          radial-gradient(900px 420px at 30% 28%, rgba(211,243,176,0.40) 0%, rgba(211,243,176,0.00) 60%),
          radial-gradient(760px 360px at 82% 36%, rgba(224,252,193,0.28) 0%, rgba(224,252,193,0.00) 62%),
          radial-gradient(820px 420px at 12% 62%, rgba(199,227,168,0.25) 0%, rgba(199,227,168,0.00) 62%),
          linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 58%, #F7F7F7 100%)
        `,
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:wght@400;600;700&display=swap');`}</style>

      <BackgroundFX />
      <DoodleSpark className="absolute -top-10 -left-10 h-24 w-24 sm:h-28 sm:w-28 text-black/10 rotate-12" />

      <TermsModal
        open={!termsAccepted}
        onAgree={() => {
          const ok = saveTermsAccepted(termsStorageKey);
          if (ok) setTermsAccepted(true);
        }}
      />

      <HistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        items={historyItems}
        entries={entries}
        trackerSeriesForDate={trackerSeriesForDate}
        todayKey={todayKey}
      />
      <ServiceTutorialOverlay
        open={tutorialOpen}
        steps={tutorialSteps}
        stepIndex={tutorialStep}
        onNext={nextTutorialStep}
        onSkip={closeTutorial}
        ariaLabel="Journal tutorial"
      />
      <div className="pt-[56px] sm:pt-[66px] pb-10 relative z-[1]">
        <div className="max-w-6xl mx-auto px-3 sm:px-6">
          <div className="sticky top-[68px] sm:top-[72px] z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 pb-3">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.25, ease: "easeOut" }
              }
              className="relative rounded-[28px] border border-black/10 bg-white/78 backdrop-blur-xl shadow-[0_22px_70px_rgba(0,0,0,0.10)] p-5 sm:p-6 lg:p-7 flex flex-col gap-4 overflow-hidden"
            >
              <div
                className="absolute inset-0 opacity-35"
                style={{
                  background: `radial-gradient(900px 260px at 12% 0%, ${CHECKIN_GREEN} 0%, transparent 62%),
                              radial-gradient(700px 240px at 90% 20%, rgba(20,20,20,0.10) 0%, transparent 60%)`,
                }}
              />

              <motion.div
                className="absolute inset-0 opacity-[0.10]"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(0,0,0,0.35) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  maskImage:
                    "radial-gradient(800px 260px at 30% 20%, black 0%, transparent 70%)",
                  WebkitMaskImage:
                    "radial-gradient(800px 260px at 30% 20%, black 0%, transparent 70%)",
                }}
                animate={
                  shouldReduceMotion
                    ? {}
                    : { backgroundPosition: ["0px 0px", "24px 24px"] }
                }
                transition={
                  shouldReduceMotion
                    ? {}
                    : { duration: 10, repeat: Infinity, ease: "linear" }
                }
              />

              <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="relative">
                  <div ref={headingRef} className="relative">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div
                        className="text-[22px] sm:text-[26px] lg:text-[30px] font-black text-[#141414] leading-tight"
                        style={{ fontFamily: "Lora, serif" }}
                      >
                        How are you today?
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!termsAccepted) return;
                          setTutorialStep(0);
                          setTutorialOpen(true);
                        }}
                        disabled={!termsAccepted}
                        className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/78 px-4 py-2 text-[13px] font-extrabold text-black/70 hover:bg-black/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ℹ️ Instructions
                      </button>
                    </div>

                    {/* keep your AnimatePresence block as-is below */}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={nudgeText}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { duration: 0.18 }
                      }
                      className="mt-2 text-[12px] lg:text-[13px] font-extrabold text-black/60"
                    >
                      {nudgeText}
                    </motion.div>
                  </AnimatePresence>

                  {saveFailed && (
                    <div className="mt-2 text-[11px] font-semibold text-red-600">
                      Storage error: couldn’t save on this device.
                    </div>
                  )}

                  {showCloudPill && cloudSync.status !== "idle" && (
                    <div className="mt-2">
                      <CloudStatusPill
                        status={cloudSync.status}
                        message={cloudSync.message}
                      />
                    </div>
                  )}
                </div>

                <div
                  ref={actionsRef}
                  className="relative flex flex-wrap items-center gap-2 justify-start lg:justify-end"
                >
                  <div className="inline-flex items-center gap-2 h-10 rounded-full border border-black/15 bg-white/85 backdrop-blur px-4 text-[13px] font-extrabold text-black/70">
                    <IconCalendar className="h-5 w-5 text-black/45" />
                    <span>Today</span>
                    <span className="text-black/35">•</span>
                    <span className="font-black text-black/75">
                      {formatNiceDate(todayKey)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="h-10 rounded-full border border-black/15 bg-white/85 backdrop-blur px-4 text-[13px] font-extrabold text-black/70 hover:bg-black/5 transition"
                  >
                    History
                  </button>

                  <button
                    type="button"
                    onClick={clearTodayDraft}
                    disabled={
                      inputsDisabled ||
                      (!mood &&
                        !reason &&
                        !notes &&
                        (!Array.isArray(copingUsed) || copingUsed.length === 0))
                    }
                    className="h-10 rounded-full border border-black/15 bg-white/85 backdrop-blur px-4 text-[13px] font-extrabold text-black/70 hover:bg-black/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear
                  </button>

                  <motion.button
                    type="button"
                    onClick={saveNow}
                    disabled={inputsDisabled || dayLocked || !canSave}
                    whileHover={
                      inputsDisabled || dayLocked || !canSave ? {} : { y: -1 }
                    }
                    whileTap={
                      inputsDisabled || dayLocked || !canSave
                        ? {}
                        : { scale: 0.98 }
                    }
                    className="h-10 rounded-full px-4 text-[13px] font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor:
                        !inputsDisabled && !dayLocked && canSave
                          ? CHECKIN_GREEN
                          : "rgba(0,0,0,0.05)",
                      color: CHECKIN_DARK,
                      border: "1px solid rgba(0,0,0,0.15)",
                      boxShadow:
                        !inputsDisabled && !dayLocked && canSave
                          ? "0 18px 50px rgba(185,255,102,0.45)"
                          : "none",
                    }}
                  >
                    {dayLocked ? "Saved ✓" : "Save"}
                  </motion.button>

                  <div className="ml-1" aria-live="polite">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={
                          savedPulse
                            ? "saved"
                            : dayLocked
                              ? "locked"
                              : inputsDisabled
                                ? "disabled"
                                : isDirty
                                  ? "dirty"
                                  : "idle"
                        }
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : { duration: 0.18 }
                        }
                      >
                        {savedPulse ? (
                          <Pill tone="green">Thank you 💚</Pill>
                        ) : dayLocked ? (
                          <Pill tone="dark">
                            {savedTimeLabel
                              ? `Saved • ${savedTimeLabel}`
                              : "Saved today"}
                          </Pill>
                        ) : !termsAccepted ? (
                          <Pill tone="warn">Accept Terms</Pill>
                        ) : isDirty ? (
                          <Pill tone="warn">Unsaved</Pill>
                        ) : (
                          <Pill>Saved</Pill>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="mt-2 rounded-[20px] border border-black/10 bg-white/90 p-4 lg:p-5 shadow-sm">
                <div className="mb-4">
                  <div className="flex items-center justify-between text-[12px] lg:text-[13px] font-bold text-black/60">
                    <span className="inline-flex items-center gap-2">
                      <IconBolt className="h-4 w-4 text-black/45" />
                      Daily progress
                    </span>
                    <span>{progress}%</span>
                  </div>

                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-black/10">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progress}%`,
                        background: "linear-gradient(180deg, #B9FF66, #A3F635)",
                      }}
                    />
                  </div>
                </div>

                <div
                  ref={stepsNavRef}
                  className="grid grid-cols-2 sm:grid-cols-5 gap-2"
                >
                  {[
                    {
                      key: "mood",
                      label: "Mood",
                      icon: IconMood,
                      done: !!mood,
                    },
                    {
                      key: "reason",
                      label: "Reason",
                      icon: IconReason,
                      done: !!reason,
                    },
                    {
                      key: "notes",
                      label: "Notes",
                      icon: IconNotes,
                      done: !!(notes || "").trim(),
                    },
                    {
                      key: "coping",
                      label: "Coping",
                      icon: IconCoping,
                      done: Array.isArray(copingUsed) && copingUsed.length > 0,
                    },
                    {
                      key: "save",
                      label: "Done",
                      icon: IconBolt,
                      done: dayLocked,
                    },
                  ].map((s) => {
                    const isActive = step === s.key;
                    const isDone = dayLocked ? true : s.done;

                    return (
                      <MobileStepButton
                        key={s.key}
                        label={s.label}
                        active={isActive}
                        done={isDone}
                        disabled={inputsDisabled}
                        onClick={() => jumpToStep(s.key)}
                        icon={s.icon}
                      />
                    );
                  })}
                </div>

                {!termsAccepted && (
                  <div className="mt-3 text-[12px] text-black/60 font-semibold">
                    Accept Terms & Conditions to unlock the Journal.
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <div ref={moodTrackerRef} className="mt-3">
            <MoodTracker
              series={trackerSeries}
              todayKey={todayKey}
              subtitle="Saved mood for the last 7 days."
            />
          </div>

          <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
            <div ref={moodCardRef} className="flex flex-col h-full">
              <div ref={focusMoodRef} />
              <Card
                className="h-full"
                title={
                  <span className="flex items-center gap-2">
                    Mood {inputsDisabled && <Pill>Locked</Pill>}
                  </span>
                }
                right={
                  <button
                    type="button"
                    disabled={inputsDisabled}
                    onClick={() => setMoodCollapsed((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {moodCollapsed ? "Expand" : "Collapse"}
                    <IconChevron className="h-4 w-4" down={moodCollapsed} />
                  </button>
                }
              >
                <motion.div
                  className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 flex items-center gap-3"
                  initial={false}
                  animate={
                    !inputsDisabled && step === "mood"
                      ? { boxShadow: "0 0 0 4px rgba(185,255,102,0.35)" }
                      : { boxShadow: "0 0 0 0px rgba(0,0,0,0)" }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.22, ease: "easeOut" }
                  }
                >
                  <div
                    className="h-12 w-12 lg:h-14 lg:w-14 rounded-2xl border border-black/10 bg-white flex items-center justify-center overflow-hidden"
                    style={{ boxShadow: "0 10px 24px rgba(0,0,0,0.05)" }}
                  >
                    <AnimatePresence mode="wait">
                      {mood ? (
                        <motion.div
                          key={mood}
                          initial={{
                            opacity: 0,
                            scale: 0.85,
                            rotate: -10,
                            y: 6,
                          }}
                          animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                          exit={{ opacity: 0, scale: 0.88, rotate: 8, y: -6 }}
                          transition={
                            shouldReduceMotion
                              ? { duration: 0 }
                              : { duration: 0.24, ease: "easeOut" }
                          }
                        >
                          <MoodEmote mood={mood} size={40} />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="empty"
                          className="text-[12px] font-extrabold text-black/40"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          —
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex-1">
                    <div className="text-[12px] font-extrabold text-black/70">
                      Current mood
                    </div>
                    <div className="text-[14px] lg:text-[16px] font-extrabold text-[#141414] mt-1">
                      {mood || "Not selected"}
                    </div>
                    <div className="text-[12px] text-black/55 font-semibold mt-1">
                      {(mood || "").trim()
                        ? MOOD_MESSAGE[(mood || "").trim()] ||
                          "Thanks for checking in."
                        : "Pick a mood to begin."}
                    </div>
                  </div>
                </motion.div>

                <AnimatePresence initial={false}>
                  {!moodCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { duration: 0.2, ease: "easeOut" }
                      }
                      className="overflow-hidden"
                    >
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {moods.map((m) => (
                          <Chip
                            key={m}
                            active={mood === m}
                            onClick={() => {
                              if (inputsDisabled) return;
                              setMood(m);
                            }}
                            left={
                              <motion.span
                                initial={{ scale: 0.9 }}
                                animate={
                                  shouldReduceMotion
                                    ? { scale: mood === m ? 1.06 : 1 }
                                    : mood === m
                                      ? { scale: 1.08, ...activeEmoteAnim }
                                      : { scale: 1 }
                                }
                                transition={
                                  shouldReduceMotion
                                    ? { duration: 0 }
                                    : mood === m
                                      ? {
                                          duration: 1.2,
                                          repeat: Infinity,
                                          ease: "easeInOut",
                                        }
                                      : {
                                          type: "spring",
                                          stiffness: 300,
                                          damping: 18,
                                        }
                                }
                              >
                                <MoodEmote mood={m} size={18} />
                              </motion.span>
                            }
                            disabled={inputsDisabled}
                          >
                            {m}
                          </Chip>
                        ))}
                      </div>

                      {!termsAccepted && (
                        <div className="mt-3 text-[12px] text-black/55 font-semibold">
                          Accept Terms to unlock selections.
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </div>

            <div ref={copingCardRef} className="flex flex-col h-full">
              <div ref={focusCopingRef} />
              {/* ✅ Coping (chips only; dropdown removed) */}
              <Card
                className="h-full"
                title={<span className="flex items-center gap-2">Coping</span>}
                right={
                  copingUsed.length ? (
                    <Pill tone="green">{copingUsed.length} selected</Pill>
                  ) : (
                    <Pill>Optional</Pill>
                  )
                }
              >
                <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <div className="text-[12px] text-black/60 font-semibold mb-3">
                    Tap what you tried today. Tap again to remove.
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {COPING_QUICK.map((c) => (
                      <Chip
                        key={c}
                        active={copingUsed.includes(c)}
                        onClick={() => toggleCoping(c)}
                        disabled={inputsDisabled}
                      >
                        {c}
                      </Chip>
                    ))}
                  </div>

                  <div className="mt-3 text-[12px] text-black/60">
                    <span className="font-extrabold text-black/70">
                      Selected:
                    </span>{" "}
                    {copingUsed.length ? copingUsed.join(", ") : "—"}
                  </div>

                  {inputsDisabled && (
                    <div className="mt-2 text-[12px] text-black/55 font-semibold">
                      Saved today — coping is view-only.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div ref={reasonCardRef} className="flex flex-col h-full">
              <div ref={focusReasonRef} />
              <Card
                className="h-full"
                title={
                  <span className="flex items-center gap-2">
                    Reason {inputsDisabled && <Pill>Locked</Pill>}
                  </span>
                }
              >
                <motion.div
                  initial={false}
                  animate={
                    !inputsDisabled && step === "reason"
                      ? { boxShadow: "0 0 0 4px rgba(185,255,102,0.35)" }
                      : { boxShadow: "0 0 0 0px rgba(0,0,0,0)" }
                  }
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.22, ease: "easeOut" }
                  }
                  className="rounded-2xl"
                >
                  <div className="flex flex-wrap gap-2">
                    {reasons.map((r) => (
                      <Chip
                        key={r}
                        active={reason === r}
                        onClick={() => {
                          if (inputsDisabled) return;
                          setReason(r);
                        }}
                        disabled={inputsDisabled}
                      >
                        {r}
                      </Chip>
                    ))}
                  </div>
                </motion.div>

                {!termsAccepted && (
                  <div className="mt-3 text-[12px] text-black/55 font-semibold">
                    Accept Terms to unlock selections.
                  </div>
                )}
              </Card>
            </div>
            <div ref={wellnessTipsRef} className="flex flex-col h-full">
              <Card
                className="h-full"
                title={
                  <span className="flex items-center gap-2">
                    <IconWellness className="h-5 w-5 text-black/60" />
                    Wellness Tips
                  </span>
                }
                right={
                  wellnessUnlocked ? (
                    wellness.personalized ? (
                      <Pill tone="green">For you</Pill>
                    ) : (
                      <Pill>General</Pill>
                    )
                  ) : (
                    <Pill>General</Pill>
                  )
                }
              >
                {wellnessUnlocked ? (
                  <motion.div
                    className="rounded-2xl border border-black/10 bg-black/[0.02] p-5 lg:p-6"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { duration: 0.22, ease: "easeOut" }
                    }
                  >
                    {wellness.personalized && (
                      <div className="text-[12px] text-black/55 font-semibold mb-3">
                        Based on your mood + reason today.
                      </div>
                    )}

                    <ul className="text-[13px] lg:text-[14px] text-black/70 leading-relaxed space-y-2">
                      {wellness.tips.map((t, i) => (
                        <motion.li
                          key={i}
                          className="flex items-start gap-2"
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={
                            shouldReduceMotion
                              ? { duration: 0 }
                              : {
                                  delay: 0.06 + i * 0.05,
                                  duration: 0.2,
                                  ease: "easeOut",
                                }
                          }
                        >
                          <span
                            className="mt-[6px] h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: CHECKIN_GREEN }}
                          />
                          <span>{t}</span>
                        </motion.li>
                      ))}
                    </ul>

                    {!termsAccepted && (
                      <div className="mt-4 rounded-xl border border-black/10 bg-white/80 p-3 text-[12px] text-black/60 font-semibold">
                        Tips will unlock after you accept Terms.
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-5 lg:p-6 min-h-[140px] h-full" />
                )}
              </Card>
            </div>

            <div ref={notesCardRef} className="flex flex-col xl:col-span-2">
              <div ref={focusNotesRef} />
              <motion.div
                initial={false}
                animate={
                  !inputsDisabled && step === "notes"
                    ? {
                        boxShadow: "0 0 0 4px rgba(185,255,102,0.35)",
                        borderRadius: 28,
                      }
                    : { boxShadow: "0 0 0 0px rgba(0,0,0,0)", borderRadius: 28 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.22, ease: "easeOut" }
                }
              >
                <NotesCard
                  notes={notes}
                  setNotes={setNotes}
                  disabled={inputsDisabled}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** =========================
    Background FX
========================= */
function BackgroundFX() {
  const reduce = useReducedMotion();

  const blob = (a, b, opacity = 0.35) => ({
    background: `radial-gradient(circle at 30% 30%, ${a}, ${b})`,
    opacity,
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-[0] overflow-hidden">
      <motion.div
        className="absolute -top-36 -left-36 h-[560px] w-[560px] rounded-full blur-3xl"
        style={blob("rgba(185,255,102,0.95)", "rgba(185,255,102,0.00)", 0.42)}
        animate={
          reduce
            ? {}
            : {
                x: [0, 44, -24, 0],
                y: [0, 22, 56, 0],
                scale: [1, 1.08, 0.98, 1],
              }
        }
        transition={
          reduce ? {} : { duration: 12, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <motion.div
        className="absolute -top-40 -right-44 h-[680px] w-[680px] rounded-full blur-3xl"
        style={blob("rgba(218,252,182,0.95)", "rgba(218,252,182,0.00)", 0.34)}
        animate={
          reduce
            ? {}
            : {
                x: [0, -36, 18, 0],
                y: [0, 26, -14, 0],
                scale: [1, 1.06, 1.0, 1],
              }
        }
        transition={
          reduce ? {} : { duration: 16, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <motion.div
        className="absolute top-[18%] left-[18%] h-[720px] w-[720px] rounded-full blur-3xl"
        style={blob("rgba(211,243,176,0.85)", "rgba(211,243,176,0.00)", 0.26)}
        animate={
          reduce
            ? {}
            : {
                x: [0, 24, -18, 0],
                y: [0, -10, 20, 0],
                scale: [1, 1.04, 0.99, 1],
              }
        }
        transition={
          reduce ? {} : { duration: 18, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <motion.div
        className="absolute -bottom-44 -left-40 h-[640px] w-[640px] rounded-full blur-3xl"
        style={blob("rgba(224,252,193,0.85)", "rgba(224,252,193,0.00)", 0.22)}
        animate={
          reduce
            ? {}
            : {
                x: [0, 22, -10, 0],
                y: [0, -18, 12, 0],
                scale: [1, 1.05, 1.0, 1],
              }
        }
        transition={
          reduce ? {} : { duration: 20, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <motion.div
        className="absolute top-[10%] right-[6%] h-[560px] w-[560px] rounded-full blur-3xl"
        style={blob("rgba(20,20,20,0.10)", "rgba(20,20,20,0.00)", 0.16)}
        animate={
          reduce
            ? {}
            : {
                x: [0, -18, 10, 0],
                y: [0, 16, -10, 0],
                scale: [1, 1.03, 1.0, 1],
              }
        }
        transition={
          reduce ? {} : { duration: 22, repeat: Infinity, ease: "easeInOut" }
        }
      />

      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(0,0,0,0.35) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.1,
          maskImage:
            "radial-gradient(900px 520px at 30% 20%, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(900px 520px at 30% 20%, black 0%, transparent 70%)",
        }}
        animate={reduce ? {} : { backgroundPosition: ["0px 0px", "24px 24px"] }}
        transition={
          reduce ? {} : { duration: 10, repeat: Infinity, ease: "linear" }
        }
      />

      <div
        className="absolute inset-0"
        style={{
          opacity: 0.06,
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(0,0,0,0.30) 0px, rgba(0,0,0,0.00) 1px, rgba(0,0,0,0.00) 3px),
            repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.00) 1px, rgba(0,0,0,0.00) 4px)
          `,
          mixBlendMode: "soft-light",
        }}
      />
    </div>
  );
}
