// src/pages/Journal.js
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/** CheckIn palette */
const CHECKIN_GREEN = "#B9FF66";
const CHECKIN_DARK = "#141414";

/** =========================
    STORAGE
========================= */
const ENTRIES_KEY_PREFIX = "journal_entries_v1";
const TERMS_KEY_PREFIX = "journal_terms_accepted_v1";

// Legacy (older builds used global keys — dangerous across multiple users on same device)
const LEGACY_ENTRIES_KEY = "journal_entries_v1";
const LEGACY_TERMS_KEY = "journal_terms_accepted_v1";
const LEGACY_OWNER_KEY = "journal_entries_owner_v1";

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
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
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
   - Keeps drafts isolated per logged-in user (prevents "everyone shares one journal" on the same device).
   - Still supports anonymous local use (falls back to :anon)
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

/* =========================
   ✅ API helpers (Render backend)
========================= */
function getApiBase() {
  try {
    const v =
      typeof process !== "undefined" && process?.env?.REACT_APP_API_URL
        ? process.env.REACT_APP_API_URL
        : "";
    return String(v || "").replace(/\/$/, "");
  } catch {
    return "";
  }
}

async function apiJson(path, { method = "GET", token, body } = {}) {
  const base = getApiBase();
  const url = `${base}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}


/** Keep PHQ shape for back-compat */
function ensureEntryShape(e) {
  const base = {
    mood: "",
    reason: "",
    notes: "",
    daySubmitted: false,
    daySubmittedAt: null,
    phq: { answers: Array(9).fill(null), submitted: false, score: null, completedAt: null },
  };
  if (!e) return base;
  return {
    ...base,
    ...e,
    notes: typeof e.notes === "string" ? e.notes : "",
    daySubmitted: !!e?.daySubmitted,
    daySubmittedAt: e?.daySubmittedAt || null,
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

/**
 * ✅ Local day key (consistent everywhere)
 * Avoid mixing local “today” with UTC math.
 */
function getTodayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  // Ensure it uses local time consistently (no UTC-based discrepancies)
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

/**
 * ✅ Safe date rendering
 * No Date.UTC(...) -> local shift risk removed.
 */
function formatNiceDate(dateKey) {
  const [y, m, d] = (dateKey || "").split("-").map((x) => Number(x));
  if (!y || !m || !d) return dateKey || "";
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function formatNiceTime(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Build tracker series (Saved moods only) — LOCAL date math */
function buildTrackerSeries(entries, baseDateKey, days = TRACKER_DAYS) {
  const list = [];
  const base = dateFromKeyLocal(baseDateKey);

  for (let i = 0; i < days; i++) {
    const x = new Date(base);
    x.setDate(base.getDate() - ((days - 1) - i));

    const key = keyFromDateLocal(x);
    const label = `${x.getMonth() + 1}/${x.getDate()}`;
    const e = getEntry(entries, key);

    const mood = (e.mood || "").trim() ? e.mood : null; // show draft mood too
    list.push({ key, label, mood });
  }
  return list;
}

/** Wellness tips based on Saved Mood/Reason/Notes (NOT PHQ requirement) */
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
  if (reason === "School") addOns.push("School tip: do the easiest task first to break procrastination.");
  if (reason === "Family") addOns.push("Family tip: set a small boundary (ex: “I need 10 minutes”).");
  if (reason === "Friends") addOns.push("Friends tip: clarify one thing with a short message instead of overthinking.");
  if (reason === "Health") addOns.push("Health tip: gentle routine (water, light food, rest).");
  if (reason === "Other") addOns.push("Try naming the trigger in 1 short sentence—clarity lowers stress.");

  const noteAdd = notes ? ["Your note matters—re-read it and highlight one thing you did well."] : [];

  return {
    personalized: true,
    label: "Wellness Tips",
    tips: [...core, ...addOns.slice(0, 1), ...noteAdd].slice(0, 4),
  };
}

/** Icons */
function IconChevron({ className = "", down = true }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M7 3v3M17 3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4.5 9h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Step icons */
function IconMood({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z" stroke="currentColor" strokeWidth="2" />
      <path d="M8.5 10.2h0.01M15.5 10.2h0.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M8.3 14.2c1.1 1.6 2.7 2.5 3.7 2.5s2.6-.9 3.7-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconReason({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M7 18l-3 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 9h8M8 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconNotes({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 3v4a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 12h8M8 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Tiny animated SVG mascot (no assets) */
function StepMascot({ show }) {
  const reduce = useReducedMotion();
  if (!show) return null;

  return (
    <motion.div className="absolute -top-2 -right-2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
      <motion.svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        animate={reduce ? {} : { y: [0, -4, 0], rotate: [0, -8, 8, 0] }}
        transition={reduce ? {} : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      >
        <path
          d="M12 2l1.4 4.1L18 7.5l-4.6 1.4L12 13l-1.4-4.1L6 7.5l4.6-1.4L12 2Z"
          stroke="rgba(20,20,20,0.9)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="19" cy="5" r="1.2" fill="rgba(185,255,102,0.95)" stroke="rgba(0,0,0,0.35)" />
      </motion.svg>
    </motion.div>
  );
}

/** Mobile step button */
function MobileStepButton({ label, active, done, disabled, onClick, icon: Icon }) {
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

  const labelClass = done ? "text-black" : active ? "text-black" : "text-black/55";

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
        style={{ boxShadow: active && !done ? "0 10px 22px rgba(185,255,102,0.22)" : "none" }}
      >
        {done ? <IconCheck className="h-4 w-4" /> : <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />}
      </div>

      {/* ✅ ONLY TEXT INCREASED HERE */}
      <div
        className={[
          "w-full text-center font-extrabold leading-tight truncate",
          "text-[clamp(13px,3vw,15px)]", // was ~10.5px–11px
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
  const key = (mood || "Okay").toLowerCase();
  const gid = useId();
  const gradFace = `face-${gid}`;
  const gradHi = `hi-${gid}`;
  const glow = `glow-${gid}`;

  const palette =
    key === "angry"
      ? { a: "#FF5C3A", b: "#FFB39E", stroke: "#D74322" }
      : key === "sad" || key === "fear" || key === "disgust"
      ? { a: "#FFD470", b: "#FFF1C2", stroke: "#D5A200" }
      : key === "stressed"
      ? { a: "#FFCC3A", b: "#FFF0B8", stroke: "#D5A200" }
      : { a: "#FFD34D", b: "#FFF4C8", stroke: "#D5A200" };

  const eyeMode = key === "calm" ? "closed" : key === "fear" || key === "surprise" ? "wide" : "normal";
  const tear = key === "sad";

  const mouth =
    key === "happy"
      ? { kind: "smile" }
      : key === "calm"
      ? { kind: "softsmile" }
      : key === "okay"
      ? { kind: "flat" }
      : key === "stressed"
      ? { kind: "zig" }
      : key === "sad"
      ? { kind: "frown" }
      : key === "angry"
      ? { kind: "angry" }
      : key === "fear"
      ? { kind: "tiny" }
      : key === "surprise"
      ? { kind: "o" }
      : key === "disgust"
      ? { kind: "tilt" }
      : { kind: "flat" };

  const brows =
    key === "angry"
      ? ["M8.2 9.6l3.2 1.2", "M15.8 9.6l-3.2 1.2"]
      : key === "stressed"
      ? ["M8.1 9.9c1.2-0.9 2.3-0.9 3.3 0", "M12.6 9.9c1.2-0.9 2.3-0.9 3.3 0"]
      : key === "fear"
      ? ["M8.1 9.2c1.2-1.2 2.3-1.2 3.3 0", "M12.6 9.2c1.2-1.2 2.3-1.2 3.3 0"]
      : key === "surprise"
      ? ["M8.2 9.1c1.2-0.8 2.2-0.8 3.2 0", "M12.6 9.1c1.2-0.8 2.2-0.8 3.2 0"]
      : key === "disgust"
      ? ["M8.2 10.0h3.0", "M12.6 9.1c1.0 0.3 2.0 0.8 3.0 1.4"]
      : ["M8.2 10.0h3.2", "M15.8 10.0h-3.2"];

  const Eye = ({ x, y, mode }) => {
    if (mode === "closed") {
      return <path d={`M${x - 2.2} ${y} Q ${x} ${y + 1.6} ${x + 2.2} ${y}`} stroke="#171717" strokeWidth="1.6" strokeLinecap="round" fill="none" />;
    }
    if (mode === "wide") {
      return (
        <>
          <circle cx={x} cy={y} r="1.7" fill="#FFF" stroke="#171717" strokeWidth="1.1" />
          <circle cx={x} cy={y + 0.2} r="0.85" fill="#171717" />
          <circle cx={x - 0.45} cy={y - 0.4} r="0.28" fill="#FFF" opacity="0.9" />
        </>
      );
    }
    return (
      <>
        <circle cx={x} cy={y} r="1.25" fill="#171717" />
        <circle cx={x - 0.4} cy={y - 0.45} r="0.25" fill="#FFF" opacity="0.8" />
      </>
    );
  };

  const Mouth = ({ kind }) => {
    if (kind === "o") return <circle cx="12" cy="16.2" r="1.6" fill="#171717" opacity="0.9" />;
    if (kind === "tiny") return <path d="M10.6 16.1c1.0-0.7 1.8-0.7 2.8 0" stroke="#171717" strokeWidth="1.7" strokeLinecap="round" fill="none" />;
    if (kind === "smile") return <path d="M8.2 15.0c1.9 2.5 5.7 2.5 7.6 0" stroke="#171717" strokeWidth="1.7" strokeLinecap="round" fill="none" />;
    if (kind === "softsmile") return <path d="M8.7 15.5c1.6 1.2 5.0 1.2 6.6 0" stroke="#171717" strokeWidth="1.7" strokeLinecap="round" fill="none" />;
    if (kind === "flat") return <path d="M8.8 16.0h6.4" stroke="#171717" strokeWidth="1.7" strokeLinecap="round" fill="none" />;
    if (kind === "zig") return <path d="M8.3 16.2c1.2-1.1 2.2 1.1 3.2 0 1.0-1.1 2.2-1.1 3.2 0" stroke="#171717" strokeWidth="1.7" strokeLinecap="round" fill="none" />;
    if (kind === "frown") return <path d="M8.2 17.0c1.9-2.4 5.7-2.4 7.6 0" stroke="#171717" strokeWidth="1.7" strokeLinecap="round" fill="none" />;
    if (kind === "angry") return <path d="M8.0 16.7c2.5-1.4 5.5-1.4 8.0 0" stroke="#171717" strokeWidth="1.7" strokeLinecap="round" fill="none" />;
    if (kind === "tilt") return <path d="M9.0 16.4c1.4 1.1 2.4-1.1 3.6 0 1.2 1.1 2.2-1.1 3.4 0" stroke="#171717" strokeWidth="1.7" strokeLinecap="round" fill="none" />;
    return null;
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={gradFace} cx="30%" cy="25%" r="75%">
          <stop offset="0%" stopColor={palette.b} />
          <stop offset="55%" stopColor={palette.a} />
          <stop offset="100%" stopColor={palette.a} />
        </radialGradient>
        <radialGradient id={gradHi} cx="25%" cy="20%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="65%" stopColor="#FFFFFF" stopOpacity="0.0" />
        </radialGradient>
        <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.2" floodColor="rgba(0,0,0,0.28)" />
        </filter>
      </defs>

      <g filter={`url(#${glow})`}>
        <circle cx="12" cy="12" r="9.3" fill={`url(#${gradFace})`} stroke={palette.stroke} strokeWidth="1.4" />
        <circle cx="9.2" cy="14.4" r="1.3" fill="#FFB7A3" opacity="0.30" />
        <circle cx="14.8" cy="14.4" r="1.3" fill="#FFB7A3" opacity="0.30" />
        <circle cx="10.3" cy="7.6" r="7.1" fill={`url(#${gradHi})`} opacity="0.55" />
      </g>

      <path d={brows[0]} stroke="#171717" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d={brows[1]} stroke="#171717" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <Eye x={9.2} y={12} mode={eyeMode} />
      <Eye x={14.8} y={12} mode={eyeMode} />
      <Mouth kind={mouth.kind} />

      {tear && <path d="M7.1 14.2c1.0 1.4 1.0 2.5 0 3.7-1.0-1.2-1.0-2.3 0-3.7Z" fill="#4DA3FF" stroke="#2B7FE6" strokeWidth="0.7" strokeLinejoin="round" />}
    </svg>
  );
}

/** Doodles (kept minimal + light) */
function DoodleSpark({ className = "" }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden="true">
      <path d="M60 10l7 18 18 7-18 7-7 18-7-18-18-7 18-7 7-18Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

/** UI helpers */
function Pill({ children, tone = "light" }) {
  const styles =
    tone === "green"
      ? { background: "rgba(185,255,102,0.60)", border: "rgba(0,0,0,0.14)", color: CHECKIN_DARK }
      : tone === "dark"
      ? { background: "rgba(20,20,20,0.92)", border: "rgba(0,0,0,0.12)", color: "white" }
      : tone === "warn"
      ? { background: "rgba(255, 214, 102,0.55)", border: "rgba(0,0,0,0.14)", color: CHECKIN_DARK }
      : { background: "rgba(0,0,0,0.03)", border: "rgba(0,0,0,0.12)", color: "rgba(0,0,0,0.70)" };

  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-extrabold"
      style={{ background: styles.background, borderColor: styles.border, color: styles.color }}
    >
      {children}
    </span>
  );
}


function Card({ title, right, children, className = "" }) {
  return (
    <div className={`rounded-[26px] border border-black/10 bg-white/85 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.08)] overflow-hidden ${className}`}>
      <div className="px-5 py-4 bg-black/[0.02] flex items-center justify-between gap-3">
        <div
          className="text-[16px] sm:text-[17px] lg:text-[18px] font-extrabold text-[#141414] flex items-center gap-2"
          style={{ fontFamily: "Lora, serif" }}
        >
          {title}
        </div>
        {right}
      </div>
      <div className="p-5 lg:p-6">{children}</div>
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
        boxShadow: active ? "0 14px 40px rgba(0,0,0,0.10)" : "0 8px 24px rgba(0,0,0,0.05)",
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

function MoodTracker({ series, todayKey, title = "Mood Tracker", subtitle = "Saved mood for the last 7 days.", compact = false }) {
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const w = 860;
  const h = compact ? 128 : 160;
  const padX = 34;
  const padYTop = 30;
  const padYBottom = 30;

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
      return { ...d, i, x: padX + i * step, y: lvl === null ? null : yForLevel(lvl) };
    });
  }, [series, step]);

  const path = useMemo(() => buildSmoothPath(points), [points]);
  const lineTransition = shouldReduceMotion ? { duration: 0 } : { duration: 0.9, ease: "easeOut" };
  const hasAny = useMemo(() => points.some((p) => p.y !== null), [points]);

  return (
    <div className="rounded-[24px] border border-black/10 bg-white shadow-[0_14px_40px_rgba(0,0,0,0.07)] overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <div className="text-[15px] lg:text-[16px] font-extrabold text-[#141414] flex items-center gap-2" style={{ fontFamily: "Lora, serif" }}>
          {title}
          <span className="text-[11px] font-extrabold text-black/35"></span>
        </div>
        {!compact && <div className="text-[12px] text-black/45 mt-1">{subtitle}</div>}
      </div>

      <div className="px-3 pb-4">
        <div className="w-full overflow-x-auto md:overflow-visible">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[520px] md:min-w-0">
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

            <rect x={padX} y={padYTop} width={w - padX * 2} height={h - padYTop - padYBottom} rx="14" fill={`url(#${bandId})`} opacity="0.9" />
            <rect x={padX} y={padYTop} width={w - padX * 2} height={h - padYTop - padYBottom} rx="14" fill={`url(#${gradId})`} opacity="0.50" />

            <line x1={padX} y1={h - padYBottom} x2={w - padX} y2={h - padYBottom} stroke="rgba(0,0,0,0.10)" strokeWidth="2" />

            {points.map((p) => (
              <line key={`grid-${p.i}`} x1={p.x} y1={h - padYBottom} x2={p.x} y2={padYTop + 10} stroke="rgba(0,0,0,0.06)" strokeWidth="2" strokeLinecap="round" />
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
                        fill={isToday ? "rgba(185,255,102,0.30)" : "rgba(185,255,102,0.22)"}
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

                      <g transform={`translate(${p.x - 14}, ${p.y - 32})`}>
                        <MoodEmote mood={p.mood} size={28} />
                      </g>

                      {/* ✅ Today badge now follows the point (no more floating top-right) */}
                      {isToday && (() => {
  const badgeW = 46;
  const badgeH = 18;

  // Calculate horizontal position to center it based on the mood point (p.x)
  const rawX = p.x - badgeW / 2;
  const tx = clamp(rawX, 6, w - badgeW - 6);

  // Move the "Today" badge above the mood emotes (Happy/Calm), making sure it's not overlapping
  const ty = p.y - 70;  // Adjusted position to place the "Today" badge above the mood emotes

  // Return the "Today" badge at the adjusted position
  
                      })()}
                    </>
                  ) : (
                    <circle cx={p.x} cy={h - padYBottom} r="3.5" fill="rgba(0,0,0,0.18)" />
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
                <text x={w / 2} y={h / 2} textAnchor="middle" fontSize="14" fill="rgba(0,0,0,0.55)" fontWeight="800">
                  No saved moods yet
                </text>
                <text x={w / 2} y={h / 2 + 18} textAnchor="middle" fontSize="12" fill="rgba(0,0,0,0.45)" fontWeight="700">
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
    History Modal
========================= */
/** =========================
    History Modal (Responsive + Footer Actions)
========================= */
function HistoryModal({ open, onClose, items, entries, trackerSeriesForDate, todayKey }) {
  const [page, setPage] = useState("list");
  const [selectedDate, setSelectedDate] = useState(null);

  const listScrollRef = useRef(null);
  const detailScrollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPage("list");
    setSelectedDate(null);
    requestAnimationFrame(() => {
      if (listScrollRef.current) listScrollRef.current.scrollTop = 0;
    });
  }, [open]);

  const detailEntry = useMemo(() => (selectedDate ? getEntry(entries, selectedDate) : null), [entries, selectedDate]);
  const detailTracker = useMemo(() => (selectedDate ? trackerSeriesForDate?.(selectedDate) || [] : []), [selectedDate, trackerSeriesForDate]);

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
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />

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
            {/* HEADER (no buttons here) */}
            <div
              className="p-4 sm:p-6"
              style={{
                background: `radial-gradient(900px 260px at 15% 0%, ${CHECKIN_GREEN} 0%, transparent 62%)`,
              }}
            >
              <div className="text-[15px] sm:text-[16px] font-extrabold text-[#141414]" style={{ fontFamily: "Lora, serif" }}>
                {page === "list" ? "History" : "History detail"}
              </div>
              <div className="mt-1 text-[12px] sm:text-[13px] text-black/60 font-semibold">
                {page === "list" ? "Tap a date to view it." : "Review the saved entry."}
              </div>
            </div>

            {/* BODY (extra bottom padding so footer won't cover content) */}
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
                      className="
                        max-h-[62vh] sm:max-h-[65vh]
                        overflow-auto
                        rounded-2xl
                        border border-black/10
                        pb-20 sm:pb-24
                      "
                    >
                      {items.map((it, idx) => (
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
                            <div className="text-[12px] text-black/55 font-semibold">{it.dayLocked ? "Saved" : "Draft"}</div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-black/65">
                            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                              <span className="font-extrabold">Mood:</span> {it.mood || "—"}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                              <span className="font-extrabold">Reason:</span> {it.reason || "—"}
                            </span>

                            {/* ✅ PHQ-only badge removed by your request: do NOT show PHQ-only days/badge */}
                            {/* {it.phqOnly && ... } */}

                            {it.notesPreview && (
                              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                                <span className="font-extrabold">Note:</span> {it.notesPreview}
                              </span>
                            )}
                          </div>

                          {idx !== items.length - 1 && <div className="mt-3 h-px bg-black/10" />}
                        </button>
                      ))}
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
                      className="
                        max-h-[62vh] sm:max-h-[65vh]
                        overflow-auto
                        rounded-2xl
                        border border-black/10
                        bg-white
                        pb-20 sm:pb-24
                      "
                    >
                      <div className="p-4 border-b border-black/10" style={{ background: "rgba(0,0,0,0.02)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[13px] font-extrabold text-[#141414]">{formatNiceDate(selectedDate)}</div>
                            <div className="text-[12px] text-black/55 font-semibold mt-1">{detailEntry.daySubmitted ? "Saved" : "Draft"}</div>
                          </div>

                          <div
                            className="h-9 rounded-full px-3 text-[12px] font-extrabold inline-flex items-center"
                            style={{ backgroundColor: CHECKIN_GREEN, color: CHECKIN_DARK, border: "1px solid rgba(0,0,0,0.15)" }}
                          >
                            View only
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-black/65">
                          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                            <span className="font-extrabold">Mood:</span> {safeText(detailEntry.mood)}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                            <span className="font-extrabold">Reason:</span> {safeText(detailEntry.reason)}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 border-b border-black/10">
                        <div className="text-[12px] font-extrabold text-black/70">Notes</div>
                        <div className="mt-2 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-[13px] text-black/70 whitespace-pre-wrap">
                          {safeText(detailEntry.notes)}
                        </div>
                      </div>

                      {/* ✅ Wellness Tips appear in history detail */}
                      <div className="p-4 border-b border-black/10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[12px] font-extrabold text-black/70 flex items-center gap-2">
                            <IconWellness className="h-4 w-4 text-black/55" />
                            Wellness Tips
                          </div>

                          {(() => {
                            const w = tipsForEntry(detailEntry);
                            return w.personalized ? <Pill tone="green">For you</Pill> : <Pill>General</Pill>;
                          })()}
                        </div>

                        {(() => {
                          const w = tipsForEntry(detailEntry);
                          return (
                            <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                              {w.personalized && <div className="text-[12px] text-black/55 font-semibold mb-2">Based on your mood + reason for this day.</div>}
                              <ul className="text-[13px] text-black/70 leading-relaxed space-y-2">
                                {w.tips.map((t, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="mt-[6px] h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHECKIN_GREEN }} />
                                    <span>{t}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="p-4">
                        <MoodTracker series={detailTracker} todayKey={todayKey} title="Mood Tracker" compact subtitle="Saved mood for the last 7 days." />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FOOTER ACTIONS (Bottom Right, responsive) */}
            <div
              className="
                absolute bottom-0 left-0 right-0
                border-t border-black/10
                bg-white/92 backdrop-blur
                px-3 sm:px-4
                py-3
              "
            >
              <div className="flex items-center justify-end gap-2 flex-wrap">
                {page === "detail" && (
                  <button
                    type="button"
                    onClick={goList}
                    className="
                      h-9 sm:h-10
                      rounded-full
                      border border-black/15
                      bg-white
                      px-3 sm:px-4
                      text-[12px] sm:text-[13px]
                      font-extrabold
                      text-black/70
                      hover:bg-black/5
                      transition
                    "
                  >
                    Back
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="
                    h-9 sm:h-10
                    rounded-full
                    px-3 sm:px-4
                    text-[12px] sm:text-[13px]
                    font-extrabold
                    transition
                  "
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
        <motion.div className="fixed inset-0 z-[1000] flex items-center justify-center px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/45" />

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
            <div className="p-6" style={{ background: `radial-gradient(900px 260px at 15% 0%, ${CHECKIN_GREEN} 0%, transparent 62%)` }}>
              <div className="text-[18px] sm:text-[20px] font-black text-[#141414]" style={{ fontFamily: "Lora, serif" }}>
                Terms & Conditions
              </div>
              <div className="mt-2 text-[13px] text-black/65 font-semibold">You must accept to use the Journal and Mood Tracker.</div>
            </div>

            <div className="p-6 pt-4">
              <div className="max-h-[55vh] overflow-auto rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-[13px] text-black/75 leading-relaxed">
                <ul className="space-y-2">
                  <li>
                    <span className="font-extrabold text-black/80">Purpose:</span> This Journal is for daily reflection and mood tracking.
                  </li>
                  <li>
                    <span className="font-extrabold text-black/80">Not medical advice:</span> This tool is not a substitute for professional help.
                  </li>
                  <li>
                    <span className="font-extrabold text-black/80">Respect & privacy:</span> Keep your notes respectful and avoid sharing sensitive info you don’t want stored on this device.
                  </li>
                  <li>
                    <span className="font-extrabold text-black/80">Responsibility:</span> You are responsible for how you use this feature and your device access.
                  </li>
                </ul>

                <div className="mt-4 rounded-xl border border-black/10 bg-white/80 p-3">
                  <div className="text-[12px] font-extrabold text-black/70">Emergency note</div>
                  <div className="mt-1 text-[12px] text-black/65">If you feel unsafe or in immediate danger, contact local emergency services or a trusted person right away.</div>
                </div>
              </div>

              {/* Adjusted bottom positioning of the button */}
              <div className="mt-10 flex justify-end"> {/* Increased the margin-top here */}
                <button
                  type="button"
                  onClick={onAgree}
                  className="h-11 rounded-full px-6 text-[13px] font-extrabold"
                  style={{
                    backgroundColor: CHECKIN_DARK,
                    color: "white",
                    textTransform: "none", // Ensure no transformations on text
                    writingMode: "horizontal-tb", // Ensures normal horizontal text orientation
                    paddingRight: "20px", // Adjust padding to fix button's right text position
                    paddingLeft: "20px", // Ensure padding on both sides is balanced
                  }}
                >
                  Agree & Continue
                </button>
              </div>

              <div className="mt-3 text-[11px] text-black/55 font-semibold">You cannot proceed without accepting.</div>
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
        <div className="text-[14px] lg:text-[16px] font-extrabold text-[#141414] flex items-center gap-2" style={{ fontFamily: "Lora, serif" }}>
          Notes
          <span className="text-[11px] font-extrabold text-black/35">(optional)</span>
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
            <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-[13px] text-black/80 whitespace-pre-wrap" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {safeText(notes)}
            </div>
            <div className="mt-3 text-[12px] text-black/60">Saved today — notes are view-only.</div>
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
            <div className="mt-3 text-[12px] text-black/60">Optional, but helpful for reflection.</div>
          </>
        )}
      </div>
    </div>
  );
}

/** =========================
    Main Journal Page
========================= */
export default function Journal() {
  const shouldReduceMotion = useReducedMotion();

  // ✅ who is using the journal (scopes local cache + cloud writes)
  const { token, userId } = getAuthFromStorage();
  const entriesStorageKey = entriesKeyForUser(userId);
  const termsStorageKey = termsKeyForUser(userId);

  const [todayKey, setTodayKey] = useState(() => getTodayKey());
  const [termsAccepted, setTermsAccepted] = useState(() => loadTermsAccepted(termsStorageKey));

  /** ✅ Refresh “Today” on focus + at local midnight (no interval spam) */
  useEffect(() => {
    const tick = () => {
      const next = getTodayKey();
      setTodayKey((prev) => (prev === next ? prev : next));
    };

    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
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
  // Keep a ref for effects (avoid dependency loops)
const entriesRef = useRef(entries);
useEffect(() => {
  entriesRef.current = entries;
}, [entries]);

// ✅ When user changes (login/logout), load that user's local cache + terms
useEffect(() => {
  setEntries(loadEntries(entriesStorageKey));
  setTermsAccepted(loadTermsAccepted(termsStorageKey));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [entriesStorageKey, termsStorageKey]);

// Cloud state (inline message; no modals)
const [cloudError, setCloudError] = useState("");
const [cloudReady, setCloudReady] = useState(false);

// ✅ Load journal from DB for this user (so yesterday shows after login)
useEffect(() => {
  let cancelled = false;

  async function run() {
    if (!token || !userId) return;

    try {
      setCloudError("");
      const to = todayKey; // YYYY-MM-DD local
      const d = dateFromKeyLocal(todayKey);
      const fromDate = new Date(d);
      fromDate.setDate(fromDate.getDate() - 120);
      const from = keyFromDateLocal(fromDate);

      const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=1000`;
      const data = await apiJson(`/api/journal/entries${qs}`, { method: "GET", token });

      const serverEntries = Array.isArray(data?.entries) ? data.entries : [];

      // Merge: newest clientUpdatedAt wins; submitted entries are never overwritten by drafts
      const local = loadEntries(entriesStorageKey);
      const merged = { ...(local || {}) };

      for (const se of serverEntries) {
        const k = String(se?.dateKey || "").trim();
        if (!isDateKey(k)) continue;

        const existingLocal = ensureEntryShape(merged[k]);
        const incoming = ensureEntryShape(se);

        const localTs = Number(existingLocal?.clientUpdatedAt || 0);
        const serverTs = Number(incoming?.clientUpdatedAt || 0);

        // Server submitted always wins (it is the official record)
        if (incoming.daySubmitted) {
          merged[k] = { ...existingLocal, ...incoming, daySubmitted: true };
          continue;
        }

        // Otherwise newest wins
        if (serverTs >= localTs) {
          merged[k] = { ...existingLocal, ...incoming };
        }
      }

      if (!cancelled) {
        saveEntries(merged, entriesStorageKey);
        setEntries(merged);
        setCloudReady(true);
      }

      // Best-effort sync local drafts up to server (controller refuses overwriting locked days)
      const localList = Object.keys(merged || {})
        .filter(isDateKey)
        .map((k) => ({ dateKey: k, ...ensureEntryShape(merged[k]) }))
        .filter((e) => Number(e.clientUpdatedAt || 0) > 0);

      if (localList.length) {
        try {
          await apiJson(`/api/journal/sync`, { method: "POST", token, body: { entries: localList } });
        } catch {
          // ignore — local cache remains the safety net
        }
      }
    } catch (e) {
      if (!cancelled) setCloudError(e?.message || "Could not load cloud journal.");
    }
  }

  run();
  return () => {
    cancelled = true;
  };
}, [token, userId, todayKey, entriesStorageKey]);

  const savedEntry = useMemo(() => getEntry(entries, todayKey), [entries, todayKey]);

  const dayLocked = !!savedEntry.daySubmitted;
  const inputsDisabled = dayLocked || !termsAccepted;

  const [mood, setMood] = useState(savedEntry.mood || "");
  const [reason, setReason] = useState(savedEntry.reason || "");
  const [notes, setNotes] = useState(savedEntry.notes || "");
  const [moodCollapsed, setMoodCollapsed] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saveTimer = useRef(null);
  const cloudTimer = useRef(null);
  const inFlightCloud = useRef(false);

  /** ✅ Notes are optional */
  const step = useMemo(() => {
    if (!termsAccepted) return "terms";
    if (dayLocked) return "save";
    if (!mood) return "mood";
    if (!reason) return "reason";
    return "save";
  }, [termsAccepted, dayLocked, mood, reason]);

  const progress = useMemo(() => {
    if (!termsAccepted) return 0;
    let p = 0;
    if (mood) p += 34;
    if (reason) p += 33;
    if ((notes || "").trim().length > 0) p += 33;
    if (dayLocked) p = 100;
    return Math.min(100, p);
  }, [termsAccepted, mood, reason, notes, dayLocked]);

  const focusMoodRef = useRef(null);
  const focusReasonRef = useRef(null);
  const focusNotesRef = useRef(null);

  const jumpToStep = useCallback(
    (k) => {
      if (inputsDisabled) return;
      if (k === "mood") {
        setMoodCollapsed(false);
        focusMoodRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }
      if (k === "reason") focusReasonRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      if (k === "notes") focusNotesRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      if (k === "save") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [inputsDisabled]
  );

  /** keep inputs synced when day changes */
  useEffect(() => {
    const e = getEntry(entries, todayKey);
    setMood(e.mood || "");
    setReason(e.reason || "");
    setNotes(e.notes || "");
    setSaveFailed(false);
    setMoodCollapsed(false);
  }, [todayKey, entries]);

  const isDirty = useMemo(() => {
    if (inputsDisabled) return false;
    const sameMood = (savedEntry.mood || "") === (mood || "");
    const sameReason = (savedEntry.reason || "") === (reason || "");
    const sameNotes = (savedEntry.notes || "") === (notes || "");
    return !(sameMood && sameReason && sameNotes);
  }, [inputsDisabled, savedEntry, mood, reason, notes]);

  const wellness = useMemo(() => tipsForEntry(savedEntry), [savedEntry]);

  const canSave = useMemo(() => {
    if (inputsDisabled) return false;
    return !!(mood && reason);
  }, [inputsDisabled, mood, reason]);

  function pulseSaved() {
    setSavedPulse(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedPulse(false), 1100);
  }

  /** ✅ No side-effects inside setEntries updater */
  function commitEntries(next, { pulse = false } = {}) {
    try { if (userId) localStorage.setItem(LEGACY_OWNER_KEY, String(userId)); } catch {}
    const ok = saveEntries(next, entriesStorageKey);
    setSaveFailed(!ok);
    if (ok && pulse) pulseSaved();
    setEntries(next);
  }


function cancelCloudTimer() {
  if (cloudTimer.current) {
    clearTimeout(cloudTimer.current);
    cloudTimer.current = null;
  }
}

async function pushEntryToCloud(dateKey, entryPatch, { immediate = false } = {}) {
  if (!token || !userId) return;

  const payload = {
    mood: (entryPatch?.mood ?? "").toString(),
    reason: (entryPatch?.reason ?? "").toString(),
    notes: (entryPatch?.notes ?? "").toString(),
    daySubmitted: entryPatch?.daySubmitted === true,
    clientUpdatedAt: Number(entryPatch?.clientUpdatedAt || Date.now()) || Date.now(),
  };

  const doRequest = async () => {
    inFlightCloud.current = true;
    try {
      const data = await apiJson(`/api/journal/entries/${encodeURIComponent(dateKey)}`, {
        method: "PUT",
        token,
        body: payload,
      });

      const serverEntry = ensureEntryShape(data?.entry);
      const next = setEntry(entriesRef.current || {}, dateKey, serverEntry);
      saveEntries(next, entriesStorageKey);
      setEntries(next);

      setCloudError("");
      setCloudReady(true);
    } catch (e) {
      setCloudError(e?.message || "Could not save to cloud.");
    } finally {
      inFlightCloud.current = false;
    }
  };

  if (immediate) return doRequest();

  cancelCloudTimer();
  cloudTimer.current = setTimeout(doRequest, 850);
}

// ✅ Dynamic autosave (local immediately + cloud debounced)
useEffect(() => {
  if (!termsAccepted) return;
  if (dayLocked) return;

  const hasSomething = !!((mood || "").trim() || (reason || "").trim() || (notes || "").trim());
  if (!hasSomething) return;

  const now = Date.now();
  const draft = {
    mood: (mood || "").trim(),
    reason: (reason || "").trim(),
    notes: notes ?? "",
    daySubmitted: false,
    clientUpdatedAt: now,
  };

  const next = setEntry(entriesRef.current || {}, todayKey, draft);
  commitEntries(next);
  pushEntryToCloud(todayKey, draft, { immediate: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [mood, reason, notes, todayKey, termsAccepted, dayLocked]);

  function saveNow() {
    if (dayLocked || !termsAccepted) return;
    const prevSaved = getEntry(entries, todayKey);
    const nowISO = new Date().toISOString();

    const next = setEntry(entries, todayKey, {
      mood: (mood || "").trim(),
      reason: (reason || "").trim(),
      notes: notes ?? "",
      daySubmitted: true,
      daySubmittedAt: prevSaved.daySubmittedAt || nowISO,
    });

    commitEntries(next, { pulse: true });

    // ✅ Manual save = finalize in DB immediately
    pushEntryToCloud(todayKey, { ...getEntry(next, todayKey), daySubmitted: true, clientUpdatedAt: Date.now() }, { immediate: true });
  }

  function clearTodayDraft() {
    if (dayLocked || !termsAccepted) return;

    setMood("");
    setReason("");
    setNotes("");
    setMoodCollapsed(false);
    setSaveFailed(false);

    const next = setEntry(entriesRef.current || {}, todayKey, { mood: "", reason: "", notes: "", daySubmitted: false, daySubmittedAt: null, clientUpdatedAt: Date.now() });
    commitEntries(next);
    pushEntryToCloud(todayKey, getEntry(next, todayKey), { immediate: true });
  }

  const trackerSeries = useMemo(() => buildTrackerSeries(entries, todayKey, TRACKER_DAYS), [entries, todayKey]);
  const trackerSeriesForDate = useCallback((baseDate) => buildTrackerSeries(entries, baseDate, TRACKER_DAYS), [entries]);

  const moods = ["Happy", "Calm", "Okay", "Stressed", "Sad", "Angry", "Fear", "Surprise", "Disgust"];
  const reasons = ["School", "Family", "Friends", "Health", "Other"];

  /** ✅ History: Mood/Reason/Notes only (NO PHQ-only days) + includes Wellness preview */
  const historyItems = useMemo(() => {
    const keys = Object.keys(entries || {}).filter(isDateKey);

    const truncate = (s, n = 52) => {
      const t = (s || "").trim();
      if (!t) return "";
      return t.length > n ? `${t.slice(0, n)}…` : t;
    };

    return keys
      .map((k) => {
        const e = getEntry(entries, k);

        // ✅ Only show days that cover mood tracker content
        const hasText = !!(e.mood || e.reason || (e.notes || "").trim());
        if (!hasText) return null; // ❌ removes PHQ-only days

        const noteTrim = (e.notes || "").trim();
        const notesPreview = noteTrim ? (noteTrim.length > 22 ? `${noteTrim.slice(0, 22)}…` : noteTrim) : "";

        const w = tipsForEntry(e);
        const wellnessPreview = truncate(w?.tips?.[0] || "");

        return {
          date: k,
          mood: e.mood || "",
          reason: e.reason || "",
          notesPreview,
          dayLocked: !!e.daySubmitted,
          phqSubmitted: !!e?.phq?.submitted, // optional badge
          wellnessPreview, // ✅ wellness tip appears in history list
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
    if (!(notes || "").trim()) return "Optional: add a short note — or Save to lock today.";
    return "Final step: Save to lock today.";
  }, [termsAccepted, dayLocked, mood, reason, notes]);

  const savedTimeLabel = useMemo(() => (savedEntry?.daySubmittedAt ? formatNiceTime(savedEntry.daySubmittedAt) : ""), [savedEntry]);

  /** subtle emote delight: float the selected chip emote */
  const activeEmoteAnim = useMemo(() => (shouldReduceMotion ? {} : { y: [0, -2, 0] }), [shouldReduceMotion]);

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        fontFamily: "Nunito, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        background:
  `
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

      <div className="pt-[56px] sm:pt-[66px] pb-10 relative z-[1]">
        <div className="max-w-6xl mx-auto px-3 sm:px-6">
          <div className="sticky top-[68px] sm:top-[72px] z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 pb-3">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
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
                  backgroundImage: "radial-gradient(rgba(0,0,0,0.35) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  maskImage: "radial-gradient(800px 260px at 30% 20%, black 0%, transparent 70%)",
                  WebkitMaskImage: "radial-gradient(800px 260px at 30% 20%, black 0%, transparent 70%)",
                }}
                animate={shouldReduceMotion ? {} : { backgroundPosition: ["0px 0px", "24px 24px"] }}
                transition={shouldReduceMotion ? {} : { duration: 10, repeat: Infinity, ease: "linear" }}
              />

              <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="relative">
                  <div className="text-[22px] sm:text-[26px] lg:text-[30px] font-black text-[#141414] leading-tight" style={{ fontFamily: "Lora, serif" }}>
                    How are you today?
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={nudgeText}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
                      className="mt-2 text-[12px] lg:text-[13px] font-extrabold text-black/60"
                    >
                      {nudgeText}
                    </motion.div>
                  </AnimatePresence>

                  {saveFailed && <div className="mt-2 text-[11px] font-semibold text-red-600">Storage error: couldn’t save on this device.</div>}

                  {token && userId && (
                    cloudError ? (
                      <div className="mt-2 text-[11px] font-semibold text-red-600">Cloud sync error: {cloudError}</div>
                    ) : cloudReady ? (
                      <div className="mt-2 text-[11px] font-semibold text-emerald-700">Cloud synced.</div>
                    ) : null
                  )}
                </div>

                <div className="relative flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                  <div className="inline-flex items-center gap-2 h-10 rounded-full border border-black/15 bg-white/85 backdrop-blur px-4 text-[13px] font-extrabold text-black/70">
                    <IconCalendar className="h-5 w-5 text-black/45" />
                    <span>Today</span>
                    <span className="text-black/35">•</span>
                    <span className="font-black text-black/75">{formatNiceDate(todayKey)}</span>
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
                    disabled={inputsDisabled || (!mood && !reason && !notes)}
                    className="h-10 rounded-full border border-black/15 bg-white/85 backdrop-blur px-4 text-[13px] font-extrabold text-black/70 hover:bg-black/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear
                  </button>

                  <motion.button
                    type="button"
                    onClick={saveNow}
                    disabled={inputsDisabled || !isDirty || !canSave}
                    whileHover={inputsDisabled || !isDirty || !canSave ? {} : { y: -1 }}
                    whileTap={inputsDisabled || !isDirty || !canSave ? {} : { scale: 0.98 }}
                    className="h-10 rounded-full px-4 text-[13px] font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: !inputsDisabled && isDirty && canSave ? CHECKIN_GREEN : "rgba(0,0,0,0.05)",
                      color: CHECKIN_DARK,
                      border: "1px solid rgba(0,0,0,0.15)",
                      boxShadow: !inputsDisabled && isDirty && canSave ? "0 18px 50px rgba(185,255,102,0.45)" : "none",
                    }}
                  >
                    {dayLocked ? "Saved ✓" : "Save"}
                  </motion.button>

                  <div className="ml-1" aria-live="polite">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={savedPulse ? "saved" : dayLocked ? "locked" : inputsDisabled ? "disabled" : isDirty ? "dirty" : "idle"}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
                      >
                        {savedPulse ? (
                          <Pill tone="green">Thank you 💚</Pill>
                        ) : dayLocked ? (
                          <Pill tone="dark">{savedTimeLabel ? `Saved • ${savedTimeLabel}` : "Saved today"}</Pill>
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
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "linear-gradient(180deg, #B9FF66, #A3F635)" }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: "mood", label: "Mood", icon: IconMood, done: !!mood },
                    { key: "reason", label: "Reason", icon: IconReason, done: !!reason },
                    { key: "notes", label: "Notes", icon: IconNotes, done: !!(notes || "").trim() },
                    { key: "save", label: "Done", icon: IconBolt, done: dayLocked },
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

                {!termsAccepted && <div className="mt-3 text-[12px] text-black/60 font-semibold">Accept Terms & Conditions to unlock the Journal.</div>}
              </div>
            </motion.div>
          </div>

          <div className="mt-3">
            <MoodTracker series={trackerSeries} todayKey={todayKey} subtitle="Saved mood for the last 7 days." />
          </div>

          <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <div ref={focusMoodRef} />
              <Card
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
                  animate={!inputsDisabled && step === "mood" ? { boxShadow: "0 0 0 4px rgba(185,255,102,0.35)" } : { boxShadow: "0 0 0 0px rgba(0,0,0,0)" }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
                >
                  <div className="h-12 w-12 lg:h-14 lg:w-14 rounded-2xl border border-black/10 bg-white flex items-center justify-center overflow-hidden" style={{ boxShadow: "0 10px 24px rgba(0,0,0,0.05)" }}>
                    <AnimatePresence mode="wait">
                      {mood ? (
                        <motion.div
                          key={mood}
                          initial={{ opacity: 0, scale: 0.85, rotate: -10, y: 6 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                          exit={{ opacity: 0, scale: 0.88, rotate: 8, y: -6 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
                        >
                          <MoodEmote mood={mood} size={40} />
                        </motion.div>
                      ) : (
                        <motion.div key="empty" className="text-[12px] font-extrabold text-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          —
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex-1">
                    <div className="text-[12px] font-extrabold text-black/70">Current mood</div>
                    <div className="text-[14px] lg:text-[16px] font-extrabold text-[#141414] mt-1">{mood || "Not selected"}</div>
                    <div className="text-[12px] text-black/55 font-semibold mt-1">
                      {(mood || "").trim() ? MOOD_MESSAGE[(mood || "").trim()] || "Thanks for checking in." : "Pick a mood to begin."}
                    </div>
                  </div>
                </motion.div>

                <AnimatePresence initial={false}>
                  {!moodCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
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
                                    ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                                    : { type: "spring", stiffness: 300, damping: 18 }
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

                      {!termsAccepted && <div className="mt-3 text-[12px] text-black/55 font-semibold">Accept Terms to unlock selections.</div>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              <div ref={focusReasonRef} />
              <Card title={<span className="flex items-center gap-2">Reason {inputsDisabled && <Pill>Locked</Pill>}</span>}>
                <motion.div
                  initial={false}
                  animate={!inputsDisabled && step === "reason" ? { boxShadow: "0 0 0 4px rgba(185,255,102,0.35)" } : { boxShadow: "0 0 0 0px rgba(0,0,0,0)" }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
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

                {!termsAccepted && <div className="mt-3 text-[12px] text-black/55 font-semibold">Accept Terms to unlock selections.</div>}
              </Card>

              <div ref={focusNotesRef} />
              <motion.div
                initial={false}
                animate={!inputsDisabled && step === "notes" ? { boxShadow: "0 0 0 4px rgba(185,255,102,0.35)", borderRadius: 28 } : { boxShadow: "0 0 0 0px rgba(0,0,0,0)", borderRadius: 28 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
              >
                <NotesCard notes={notes} setNotes={setNotes} disabled={inputsDisabled} />
              </motion.div>
            </div>

            <div className="flex flex-col gap-4">
              <Card
                title={
                  <span className="flex items-center gap-2">
                    <IconWellness className="h-5 w-5 text-black/60" />
                    Wellness Tips
                  </span>
                }
                right={wellness.personalized ? <Pill tone="green">For you</Pill> : <Pill>General</Pill>}
              >
                <motion.div
                  className="rounded-2xl border border-black/10 bg-black/[0.02] p-5 lg:p-6"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
                >
                  {wellness.personalized && <div className="text-[12px] text-black/55 font-semibold mb-3">Based on your mood + reason today.</div>}

                  <ul className="text-[13px] lg:text-[14px] text-black/70 leading-relaxed space-y-2">
                    {wellness.tips.map((t, i) => (
                      <motion.li
                        key={i}
                        className="flex items-start gap-2"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.06 + i * 0.05, duration: 0.2, ease: "easeOut" }}
                      >
                        <span className="mt-[6px] h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHECKIN_GREEN }} />
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
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



// 2) Replace your existing BackgroundFX() with this upgraded version:

function BackgroundFX() {
  const reduce = useReducedMotion();

  const blob = (a, b, opacity = 0.35) => ({
    background: `radial-gradient(circle at 30% 30%, ${a}, ${b})`,
    opacity,
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-[0] overflow-hidden">
      {/* Primary mint wash */}
      <motion.div
        className="absolute -top-36 -left-36 h-[560px] w-[560px] rounded-full blur-3xl"
        style={blob("rgba(185,255,102,0.95)", "rgba(185,255,102,0.00)", 0.42)}
        animate={reduce ? {} : { x: [0, 44, -24, 0], y: [0, 22, 56, 0], scale: [1, 1.08, 0.98, 1] }}
        transition={reduce ? {} : { duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Top-right soft green */}
      <motion.div
        className="absolute -top-40 -right-44 h-[680px] w-[680px] rounded-full blur-3xl"
        style={blob("rgba(218,252,182,0.95)", "rgba(218,252,182,0.00)", 0.34)}
        animate={reduce ? {} : { x: [0, -36, 18, 0], y: [0, 26, -14, 0], scale: [1, 1.06, 1.0, 1] }}
        transition={reduce ? {} : { duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Mid wash (adds the “soft field” look like your screenshot) */}
      <motion.div
        className="absolute top-[18%] left-[18%] h-[720px] w-[720px] rounded-full blur-3xl"
        style={blob("rgba(211,243,176,0.85)", "rgba(211,243,176,0.00)", 0.26)}
        animate={reduce ? {} : { x: [0, 24, -18, 0], y: [0, -10, 20, 0], scale: [1, 1.04, 0.99, 1] }}
        transition={reduce ? {} : { duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Bottom-left tint */}
      <motion.div
        className="absolute -bottom-44 -left-40 h-[640px] w-[640px] rounded-full blur-3xl"
        style={blob("rgba(224,252,193,0.85)", "rgba(224,252,193,0.00)", 0.22)}
        animate={reduce ? {} : { x: [0, 22, -10, 0], y: [0, -18, 12, 0], scale: [1, 1.05, 1.0, 1] }}
        transition={reduce ? {} : { duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Subtle darker depth (kept minimal) */}
      <motion.div
        className="absolute top-[10%] right-[6%] h-[560px] w-[560px] rounded-full blur-3xl"
        style={blob("rgba(20,20,20,0.10)", "rgba(20,20,20,0.00)", 0.16)}
        animate={reduce ? {} : { x: [0, -18, 10, 0], y: [0, 16, -10, 0], scale: [1, 1.03, 1.0, 1] }}
        transition={reduce ? {} : { duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Dots (existing vibe) */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(0,0,0,0.35) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.10,
          maskImage: "radial-gradient(900px 520px at 30% 20%, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(900px 520px at 30% 20%, black 0%, transparent 70%)",
        }}
        animate={reduce ? {} : { backgroundPosition: ["0px 0px", "24px 24px"] }}
        transition={reduce ? {} : { duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* ✅ Soft grain (adds richness without “noise assets”) */}
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