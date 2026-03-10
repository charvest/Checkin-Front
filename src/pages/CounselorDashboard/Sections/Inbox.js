// src/pages/CounselorDashboard/Sections/Inbox.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "framer-motion";
import Lottie from "lottie-react";
import messageAnim from "../../../assets/lottie/Message.json";

import {
  getMyUserId,
  listThreadsRaw,
  getThreadRaw,
  sendMessageRaw,
  markThreadRead,
} from "../../../api/messages.api";
import {
  connectMessagesSocket,
  onMessageNew,
  onThreadCreated,
  onThreadClaimed,
  onThreadUpdate,
} from "../../../api/messagesRealtime";
import { listCounselorThreadJournalEntries } from "../../../api/journal.api";


/* -----------------------------
  Fixed vocab
----------------------------- */
const MOODS = ["Happy", "Calm", "Okay", "Stressed", "Sad", "Angry", "Fear", "Surprise", "Disgust"];
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

function MoodLabel({ mood }) {
  const emo = MOOD_EMOJI[mood] || "•";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-base leading-none" aria-hidden="true">
        {emo}
      </span>
      <span className="whitespace-nowrap">{mood}</span>
    </span>
  );
}

const REASONS = ["School", "Family", "Friends", "Health", "Other"];
const COPING_OPTIONS = [
  "Breathing",
  "Talked to someone",
  "Walk / Stretch",
  "Rest",
  "Music",
  "Prayer",
  // legacy labels (still supported)
  "Deep breathing",
  "Walk / exercise",
  "Talk to friend",
  "Sleep / rest",
  "Grounding (5-4-3-2-1)",
  "Journaling",
  "Meditation",
  "Counselor session",
];

/* -----------------------------
  Chat emoji picker (chatbox only)
----------------------------- */
const CHAT_EMOJIS = ["😀", "😄", "😂", "😊", "😉", "😍", "🥰", "😢", "😡", "👍", "🙏", "❤️", "🎉", "👋"];

function insertTextAtCursor(textareaEl, currentValue, insertText) {
  const el = textareaEl;
  const value = String(currentValue ?? "");
  const start = typeof el?.selectionStart === "number" ? el.selectionStart : value.length;
  const end = typeof el?.selectionEnd === "number" ? el.selectionEnd : value.length;
  const next = value.slice(0, start) + insertText + value.slice(end);
  const caret = start + insertText.length;
  return { next, caret };
}

function EmojiPickButton({ emoji, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={[
        "h-9 w-9 max-[360px]:h-8 max-[360px]:w-8 grid place-items-center",
        "rounded-[10px] border border-slate-200 bg-white",
        "text-base leading-none",
        "hover:bg-slate-50 active:scale-[0.98] transition",
        "focus:outline-none focus:ring-4 focus:ring-slate-100",
      ].join(" ")}
      aria-label={`Insert ${emoji}`}
      title={`Insert ${emoji}`}
    >
      <span aria-hidden="true">{emoji}</span>
    </button>
  );
}

/* -----------------------------
  Helpers
----------------------------- */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function ymd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function addDays(dateKey, deltaDays) {
  const p = parseYmdParts(dateKey);
  if (!p) {
    const d = new Date();
    d.setDate(d.getDate() + deltaDays);
    return ymd(d);
  }
  const d = new Date(p.y, p.mo - 1, p.d);
  d.setDate(d.getDate() + deltaDays);
  return ymd(d);
}
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(arr, idx) {
  return arr[idx % arr.length];
}

function scrollToBottomAfterPaint(ref, tries = 60) {
  const attempt = () => {
    const el = ref?.current;
    if (!el) {
      if (tries-- > 0) requestAnimationFrame(attempt);
      return;
    }

    const before = el.scrollTop;
    el.scrollTop = el.scrollHeight;

    const moved = el.scrollTop !== before;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 2;

    if ((!atBottom || !moved) && tries-- > 0) requestAnimationFrame(attempt);
  };

  requestAnimationFrame(attempt);
}

function parseYmdParts(s) {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function monthKey(ymdStr) {
  const p = parseYmdParts(ymdStr);
  if (!p) return null;
  return `${p.y}-${pad2(p.mo)}`;
}

function sameMonth(a, b) {
  const ka = monthKey(a);
  const kb = monthKey(b);
  return !!ka && ka === kb;
}

function isOnOrBefore(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  return String(a).localeCompare(String(b)) <= 0;
}

/* -----------------------------
  Scoring (Mood + Reason + Coping)
----------------------------- */
function moodToLevel(mood) {
  if (!mood) return null;
  if (mood === "Angry") return 0;
  if (mood === "Stressed") return 1;
  if (mood === "Sad" || mood === "Fear" || mood === "Disgust") return 1;
  if (mood === "Okay" || mood === "Surprise") return 2;
  if (mood === "Calm" || mood === "Happy") return 3;
  return 2;
}

const REASON_WEIGHT = {
  School: -0.15,
  Family: -0.1,
  Friends: 0.1,
  Health: -0.15,
  Other: 0,
};

const COPING_WEIGHT = {
  // ✅ new student coping labels
  Breathing: 0.15,
  "Talked to someone": 0.18,
  "Walk / Stretch": 0.2,
  Rest: 0.1,
  Music: 0.12,
  Prayer: 0.15,

  // legacy labels (in case old data exists)
  "Deep breathing": 0.15,
  "Walk / exercise": 0.2,
  "Talk to friend": 0.18,
  Journaling: 0.15,
  Meditation: 0.18,
  "Sleep / rest": 0.1,
  "Grounding (5-4-3-2-1)": 0.18,
  "Counselor session": 0.22,
};

function scoreEntry(e) {
  const level = moodToLevel(e?.mood);
  if (typeof level !== "number" || !Number.isFinite(level)) return null;

  const rw = REASON_WEIGHT[e?.reason] ?? 0;

  // ✅ Supports new backend model: copingUsed: string[]
  const list = Array.isArray(e?.copingUsed)
    ? e.copingUsed
    : typeof e?.coping === "string" && e.coping.trim()
    ? [e.coping.trim()]
    : [];

  // sum with cap (so coping helps but doesn't dominate)
  const raw = list.reduce((sum, c) => sum + (COPING_WEIGHT[c] ?? 0), 0);
  const cw = Math.min(0.35, raw);

  return level + rw + cw;
}

function linearRegressionSlope(values) {
  const pts = safeArray(values)
    .map((y, i) => ({ x: i + 1, y }))
    .filter((p) => typeof p.y === "number" && Number.isFinite(p.y));

  if (pts.length < 2) return null;

  const n = pts.length;
  const sumX = pts.reduce((a, p) => a + p.x, 0);
  const sumY = pts.reduce((a, p) => a + p.y, 0);
  const sumXY = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = pts.reduce((a, p) => a + p.x * p.x, 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  return (n * sumXY - sumX * sumY) / denom;
}

function avg(values) {
  const pts = safeArray(values).filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!pts.length) return null;
  return pts.reduce((a, b) => a + b, 0) / pts.length;
}

function trendMeta(slope) {
  if (slope == null) return { label: "No trend", arrow: "—", badge: "bg-slate-50 text-slate-700 border-slate-200" };
  if (slope > 0.06) return { label: "Improving", arrow: "↗", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  if (slope < -0.06) return { label: "Declining", arrow: "↘", badge: "bg-rose-50 text-rose-800 border-rose-200" };
  return { label: "Stable", arrow: "→", badge: "bg-amber-50 text-amber-900 border-amber-200" };
}

/* -----------------------------
  Sparkline
----------------------------- */
function Sparkline({ values }) {
  const reduceMotion = useReducedMotion();
  const pts = safeArray(values).filter((v) => typeof v === "number" && Number.isFinite(v));

  const W = 360;
  const H = 88;
  const PAD_X = 10;
  const PAD_Y = 10;

  const idRef = useRef(`sp-${Math.random().toString(16).slice(2)}`);

  if (pts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
        Not enough data
      </div>
    );
  }

  const min = Math.min(...pts);
  const max = Math.max(...pts);

  const normY = (v) => {
    const innerH = H - PAD_Y * 2;
    if (max === min) return PAD_Y + innerH / 2;
    const t = (v - min) / (max - min);
    return PAD_Y + (1 - t) * innerH;
  };

  const step = pts.length === 1 ? 0 : (W - PAD_X * 2) / (pts.length - 1);

  const points = pts.map((v, i) => ({
    x: PAD_X + i * step,
    y: normY(v),
  }));

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${d} L ${(PAD_X + (pts.length - 1) * step).toFixed(1)} ${(H - PAD_Y).toFixed(1)} L ${PAD_X.toFixed(
    1
  )} ${(H - PAD_Y).toFixed(1)} Z`;

  const last = points[points.length - 1];

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <svg className="w-full h-[96px]" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Mood regression sparkline">
        <defs>
          <linearGradient id={`${idRef.current}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={`${idRef.current}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.65" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        <g className="text-slate-200" stroke="currentColor" strokeWidth="1" opacity="0.55">
          <line x1="0" y1={H * 0.33} x2={W} y2={H * 0.33} />
          <line x1="0" y1={H * 0.66} x2={W} y2={H * 0.66} />
        </g>

        <motion.path
          d={areaD}
          fill={`url(#${idRef.current}-fill)`}
          className="text-slate-900"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />

        <motion.path
          d={d}
          fill="none"
          stroke={`url(#${idRef.current}-stroke)`}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-900"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0.2 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
        />

        {points.map((p, i) => (
          <circle
            key={`${p.x}-${p.y}-${i}`}
            cx={p.x}
            cy={p.y}
            r={pts.length <= 8 ? 2.6 : 2.2}
            className="text-slate-900"
            fill="currentColor"
            opacity={0.9}
          />
        ))}

        {pts.length >= 1 ? (
          <>
            <motion.circle
              cx={last.x}
              cy={last.y}
              r="4.2"
              className="text-slate-900"
              fill="currentColor"
              initial={reduceMotion ? false : { scale: 0.9, opacity: 0.85 }}
              animate={reduceMotion ? { scale: 1, opacity: 0.85 } : { scale: [1, 1.35, 1], opacity: [0.9, 0.25, 0.9] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
            />
            <circle cx={last.x} cy={last.y} r="3.4" className="text-slate-900" fill="currentColor" />
          </>
        ) : null}
      </svg>

      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
        <span>min {min.toFixed(2)}</span>
        <span>max {max.toFixed(2)}</span>
      </div>
    </div>
  );
}

/* -----------------------------
  Messaging mapping helpers (REAL API)
  - System-wide counselor read
  - Claim-on-reply is enforced by backend
  - Identity hidden until claimed:
      * Unclaimed or claimed-by-other => treated as anonymous in UI (locks Mood Tracker)
      * Claimed-by-me => show identity (unless truly anonymous)
----------------------------- */
const PH_TZ = "Asia/Manila";

function resolveAvatarUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u) || u.startsWith("data:")) return u;

  const base = String(process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");
  if (base && u.startsWith("/")) return `${base}${u}`;
  return u;
}


function formatClock(iso) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: PH_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function threadLabelSuffix(threadId) {
  const s = String(threadId || "");
  return `T-${s.slice(-5)}`;
}

function mapThreadToParticipant(raw, myId) {
  const tid = String(raw?._id || "");
  const suffix = threadLabelSuffix(tid);

  const claimedBy = raw?.counselorId?._id || raw?.counselorId || null;
  const claimed = !!claimedBy;
  const mine = claimedBy && String(claimedBy) === String(myId);

  // Hide identity until claimed by current counselor
  const hideIdentity = !claimed || !mine;

  const trulyAnonymous = !!raw?.anonymous;
  const anonymous = hideIdentity || trulyAnonymous;

  const student = raw?.studentId || null;

  const displayName = !claimed
    ? `New Student • Unclaimed (${suffix})`
    : anonymous
    ? `Anonymous Student (${suffix})`
    : (student?.fullName || `Student (${suffix})`);

  const studentId = (!anonymous && student?.studentNumber) ? `#${student.studentNumber}` : null;

  const avatarUrl = (!anonymous && mine && student?.avatarUrl) ? resolveAvatarUrl(student.avatarUrl) : "";

  const lastMessage = raw?.lastMessageText || raw?.lastMessage || "—";
  const lastAtISO = raw?.lastMessageAt || raw?.updatedAt || raw?.createdAt || null;
  const lastSeen = lastAtISO ? String(lastAtISO).slice(0, 10) : "";
  const lastActivity = lastAtISO ? Date.parse(String(lastAtISO)) : 0;

  const unread = claimed ? Number(raw?.unreadCounts?.[String(myId)] || 0) : Number(raw?.unassignedUnread || 0);
  const read = unread === 0;

  // thread messages will be filled when opened via getThreadRaw()
  return {
    id: tid,
    status: raw?.status || "open",
    studentId,
    anonymous,
    displayName,
    avatarUrl,
    read,
    lastSeen,
    lastMessage,
    lastActivity,
    thread: [],
    moodTracking: { status: "idle", entries: [], error: "", loadedAt: 0 }, // loaded when Mood tab opens
    _raw: raw,
  };
}

function makeClientId() {
  return `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/* -----------------------------
  UI primitives
----------------------------- */
function Avatar({ label, src = "" }) {
  const initials = String(label || "?")
    .replace(/Anonymous (Participant|Student)\s*\([^)]+\)/i, "Anonymous")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const resolved = resolveAvatarUrl(src);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [resolved]);

  if (resolved && !broken) {
    return (
      <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 shadow-sm bg-white">
        <img
          src={resolved}
          alt={label || "Avatar"}
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  return (
    <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black shadow-sm">
      {initials || "A"}
    </div>
  );
}

function Badge({ children, tone = "neutral" }) {
  const styles =
    tone === "unread"
      ? "bg-indigo-50 text-indigo-800 border-indigo-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-extrabold ${styles}`}>
      {children}
    </span>
  );
}

/* -----------------------------
  Animated Inbox List
----------------------------- */
function AnimatedItem({ children, delay = 0, index, onMouseEnter, onClick }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.5, once: false });

  return (
    <motion.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.98, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.98, opacity: 0 }}
      transition={{ duration: 0.18, delay }}
      className="cursor-pointer"
    >
      {children}
    </motion.div>
  );
}

function AnimatedInboxList({
  items,
  selectedId,
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  displayScrollbar = true,
  className = "",
  containerStyle = {},
}) {
  const listRef = useRef(null);

  const initialIndex = Math.max(0, safeArray(items).findIndex((x) => x?.id === selectedId));
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1);

  useEffect(() => {
    const idx = safeArray(items).findIndex((x) => x?.id === selectedId);
    if (idx >= 0) setSelectedIndex(idx);
  }, [selectedId, items]);

  const handleItemMouseEnter = useCallback((index) => {
    setSelectedIndex(index);
  }, []);

  const handleItemClick = useCallback(
    (item, index) => {
      setSelectedIndex(index);
      onItemSelect?.(item, index);
    },
    [onItemSelect]
  );

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setTopGradientOpacity(Math.min(scrollTop / 50, 1));
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1));
  }, []);

  useEffect(() => {
    if (!enableArrowNavigation) return;

    const handleKeyDown = (e) => {
      if (!listRef.current) return;

      // ✅ prevent changing chats while typing / tapping controls (emoji picker, textarea, search, etc.)
      const t = e.target;
      const tag = t?.tagName;
      if (t?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") {
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault();
          onItemSelect?.(items[selectedIndex], selectedIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIndex, onItemSelect, enableArrowNavigation]);

  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return;

    const container = listRef.current;
    const selectedItem = container.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedItem) {
      const extraMargin = 50;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const itemTop = selectedItem.offsetTop;
      const itemBottom = itemTop + selectedItem.offsetHeight;

      if (itemTop < containerScrollTop + extraMargin) {
        container.scrollTo({ top: itemTop - extraMargin, behavior: "smooth" });
      } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
        container.scrollTo({ top: itemBottom - containerHeight + extraMargin, behavior: "smooth" });
      }
    }
    setKeyboardNav(false);
  }, [selectedIndex, keyboardNav]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={listRef}
        className={[
          "h-full min-h-0 overflow-y-auto",
          displayScrollbar
            ? "[&::-webkit-scrollbar]:w-[8px] [&::-webkit-scrollbar-track]:bg-white [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-[10px]"
            : "scrollbar-hide",
        ].join(" ")}
        onScroll={handleScroll}
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          scrollbarWidth: displayScrollbar ? "thin" : "none",
          scrollbarColor: displayScrollbar ? "#e2e8f0 #ffffff" : undefined,
          ...containerStyle,
        }}
      >
        <div className="divide-y divide-slate-100">
          {items.map((x, index) => {
            const active = x.id === selectedId;
            const hoverSelected = selectedIndex === index;

            return (
              <AnimatedItem
                key={x.id}
                delay={0.03}
                index={index}
                onMouseEnter={() => handleItemMouseEnter(index)}
                onClick={() => handleItemClick(x, index)}
              >
                <button
                  className={[
                    "w-full text-left px-4 py-3 transition flex gap-3",
                    active ? "bg-slate-50" : "bg-white hover:bg-slate-50/70",
                    !active && hoverSelected ? "ring-1 ring-slate-200" : "",
                  ].join(" ")}
                  type="button"
                >
                  <Avatar label={x.displayName} src={x.avatarUrl} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <div className="text-sm font-black text-slate-900 truncate leading-none">{x.displayName}</div>
                          {x.status === "closed" ? <Badge tone="unread">Closed</Badge> : null}{!x.read && x.status !== "closed" ? <Badge tone="unread">Unread</Badge> : null}
                        </div>

                        {!x.anonymous && x.studentId ? (
                          <div className="mt-1 text-[12px] font-bold text-slate-500 truncate">Student ID: {x.studentId}</div>
                        ) : null}
                      </div>

                      <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap text-right tabular-nums leading-none shrink-0">
                        {x.lastSeen}
                      </div>
                    </div>

                    <div className="mt-1 text-[13px] font-semibold text-slate-600 truncate">{x.lastMessage}</div>
                  </div>
                </button>
              </AnimatedItem>
            );
          })}
        </div>
      </div>

      {showGradients ? (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-[44px] bg-gradient-to-b from-white to-transparent pointer-events-none transition-opacity duration-300 ease"
            style={{ opacity: topGradientOpacity }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-[90px] bg-gradient-to-t from-white to-transparent pointer-events-none transition-opacity duration-300 ease"
            style={{ opacity: bottomGradientOpacity }}
          />
        </>
      ) : null}
    </div>
  );
}

/* -----------------------------
  Messenger-like chat area
----------------------------- */
function ChatBubble({ by, text, participantAvatarUrl = "" }) {
  const isCounselor = by === "Counselor";

  return (
    <div className={["flex items-start gap-2.5", isCounselor ? "justify-end" : "justify-start"].join(" ")}>
      {!isCounselor ? (
        <div className="shrink-0">
          <Avatar label="Student" src={participantAvatarUrl} />
        </div>
      ) : null}

      <div
        className={[
          "flex flex-col w-full",
          "max-w-[88%] sm:max-w-[420px] lg:max-w-[520px]",
          "leading-1.5 p-4 border shadow-[0_1px_0_rgba(0,0,0,0.03)]",
          isCounselor ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-200",
          isCounselor ? "rounded-s-2xl rounded-tr-2xl rounded-br-md" : "rounded-e-2xl rounded-tl-2xl rounded-bl-md",
        ].join(" ")}
      >
        <p className={["text-sm whitespace-pre-wrap break-words", isCounselor ? "text-white" : "text-slate-700"].join(" ")}>{text}</p>

        <span className={["mt-2 text-[11px] font-bold", isCounselor ? "text-right text-white/70" : "text-left text-slate-400"].join(" ")}>
          {isCounselor ? "Delivered" : "Seen"}
        </span>
      </div>
    </div>
  );
}

/* -----------------------------
  Mood Tracker (unchanged)
----------------------------- */
function MoodTracker({ moodTracking, day, onPickDay }) {
  const entries = safeArray(moodTracking?.entries).filter((e) => e?.date);
  const sorted = useMemo(() => [...entries].sort((a, b) => String(a.date).localeCompare(String(b.date))), [entries]);

  const [flashHistory, setFlashHistory] = useState(false);
  const lastMonthRef = useRef(monthKey(day));

  useEffect(() => {
    const mk = monthKey(day);
    if (!mk) return;

    if (lastMonthRef.current !== mk) {
      lastMonthRef.current = mk;
      setFlashHistory(true);
      const t = window.setTimeout(() => setFlashHistory(false), 120);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [day]);

  const monthEntriesAll = useMemo(() => sorted.filter((e) => sameMonth(e?.date, day)), [sorted, day]);
  const monthEntriesToDay = useMemo(
    () => monthEntriesAll.filter((e) => isOnOrBefore(String(e?.date || ""), String(day))),
    [monthEntriesAll, day]
  );

  const byDate = useMemo(() => {
    const m = new Map();
    for (const e of monthEntriesToDay) {
      const d = String(e?.date || "");
      if (!d) continue;
      const s = scoreEntry(e);
      if (typeof s !== "number" || !Number.isFinite(s)) continue;
      const arr = m.get(d) || [];
      arr.push(s);
      m.set(d, arr);
    }
    return m;
  }, [monthEntriesToDay]);

  const monthDatesToDay = useMemo(() => Array.from(byDate.keys()).sort((a, b) => String(a).localeCompare(String(b))), [byDate]);

  const last30DaysSeries = useMemo(() => {
    const last30Dates = monthDatesToDay.slice(-30);
    return last30Dates
      .map((d) => avg(byDate.get(d) || []))
      .filter((v) => typeof v === "number" && Number.isFinite(v));
  }, [monthDatesToDay, byDate]);

  const last7DaysSeries = useMemo(() => {
    const last7Dates = monthDatesToDay.slice(-7);
    return last7Dates
      .map((d) => avg(byDate.get(d) || []))
      .filter((v) => typeof v === "number" && Number.isFinite(v));
  }, [monthDatesToDay, byDate]);

  const last30Slope = linearRegressionSlope(last30DaysSeries);
  const last7Slope = linearRegressionSlope(last7DaysSeries);

  const last30Trend = trendMeta(last30Slope);
  const last7Trend = trendMeta(last7Slope);

  const last30Avg = avg(last30DaysSeries);
  const last7Avg = avg(last7DaysSeries);

  const historyEntries = useMemo(() => monthEntriesAll, [monthEntriesAll]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3 flex-wrap shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div>
          <div className="text-sm font-black text-slate-900">Mood Tracker</div>
          <div className="mt-1 text-xs font-bold text-slate-500">Mood • Reason • Coping • Trends</div>
        </div>
        <input
          type="date"
          value={day}
          onChange={(e) => onPickDay(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] xl:col-span-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-black text-slate-900">Regression Trend</div>
              <div className="mt-1 text-xs font-bold text-slate-500">Overall vs Recent (last 7)</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-extrabold text-slate-700">Last 30 Days</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-extrabold ${last30Trend.badge}`}>
                  {last30Trend.arrow} {last30Trend.label}
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  avg {last30Avg == null ? "—" : last30Avg.toFixed(2)} • n {last30DaysSeries.length}
                </span>
              </div>
              <div className="mt-2">
                <Sparkline values={last30DaysSeries} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-extrabold text-slate-700">Last 7 Days</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-extrabold ${last7Trend.badge}`}>
                  {last7Trend.arrow} {last7Trend.label}
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  avg {last7Avg == null ? "—" : last7Avg.toFixed(2)} • n {last7DaysSeries.length}
                </span>
              </div>
              <div className="mt-2">
                <Sparkline values={last7DaysSeries} />
              </div>
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-500">Trend is computed from Mood + Reason + Coping scores</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="text-sm font-black text-slate-900">History</div>

        <div
          className={[
            "mt-2 max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white",
            "[&::-webkit-scrollbar]:w-[8px] [&::-webkit-scrollbar-track]:bg-white [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-[10px]",
          ].join(" ")}
          style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 #ffffff" }}
        >
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
            <div className="hidden sm:grid grid-cols-[140px_110px_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 px-3 py-2 text-[11px] font-extrabold text-slate-500">
              <div>Date</div>
              <div>Mood</div>
              <div>Reason</div>
              <div>Coping</div>
            </div>

            <div className="sm:hidden px-3 py-2 text-[11px] font-extrabold text-slate-500">Entries</div>
          </div>

          <div className="divide-y divide-slate-100">
            {flashHistory ? null : historyEntries.length === 0 ? (
              <div className="px-3 py-3 text-sm font-semibold text-slate-500">No mood entries.</div>
            ) : (
              historyEntries
                .slice()
                .reverse()
                .map((e, index) => (
                  <AnimatedRow key={`${e.date}-${e.mood}-${index}`} index={index} delay={0.02}>
                    <div className="hidden sm:grid grid-cols-[140px_110px_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 px-3 py-2 text-sm font-semibold text-slate-700">
                      <div className="whitespace-nowrap">
                        <button onClick={() => onPickDay(e.date)} className="font-extrabold text-slate-900 hover:underline" type="button">
                          {e.date}
                        </button>
                      </div>
                      <div className="whitespace-nowrap">
                        <MoodLabel mood={e.mood} />
                      </div>

                      <div className="min-w-0">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-[15px] border border-slate-200 bg-slate-50 text-[12px] font-extrabold text-slate-700">
                          {e.reason}
                        </span>
                      </div>
                      <div className="min-w-0 whitespace-normal break-words">{(safeArray(e.copingUsed).join(", ") || e.coping || "—")}</div>
                    </div>

                    <div className="sm:hidden px-3 py-3 text-sm font-semibold text-slate-700 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <button onClick={() => onPickDay(e.date)} className="font-extrabold text-slate-900 hover:underline" type="button">
                          {e.date}
                        </button>
                        <span className="text-xs font-extrabold text-slate-600">{e.mood}</span>
                      </div>

                      <div className="text-[12px] font-bold text-slate-500">
                        Reason:{" "}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[15px] border border-slate-200 bg-slate-50 text-[12px] font-extrabold text-slate-700">
                          {e.reason}
                        </span>
                      </div>
                      <div className="text-[12px] font-bold text-slate-500">
                        Coping: <span className="font-semibold text-slate-700 break-words">{(safeArray(e.copingUsed).join(", ") || e.coping || "—")}</span>
                      </div>
                    </div>
                  </AnimatedRow>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimatedRow({ children, index, delay = 0.02 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.35, once: false });

  return (
    <motion.div
      ref={ref}
      data-index={index}
      initial={{ scale: 0.98, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.98, opacity: 0 }}
      transition={{ duration: 0.18, delay }}
      className="cursor-default"
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

/* -----------------------------
  Conversation Pane
----------------------------- */
function ConversationPane({
  selected,
  tab,
  setTab,
  moodDisabled,
  day,
  setDay,
  draft,
  setDraft,
  send,
  chatScrollRef,
  onBack,
  showBack,
  isMobileAnimated,
}) {
  const reduceMotion = useReducedMotion();
  const start = useRef({ x: 0, y: 0, t: 0 });
  const swiping = useRef(false);

  const inputRef = useRef(null);
  const emojiWrapRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  useEffect(() => {
    if (!emojiOpen) return undefined;

    const onDown = (e) => {
      const wrap = emojiWrapRef.current;
      if (!wrap) return;
      if (wrap.contains(e.target)) return;
      setEmojiOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [emojiOpen]);

  const addEmojiToDraft = useCallback(
    (emoji) => {
      const { next, caret } = insertTextAtCursor(inputRef.current, draft, emoji);
      setDraft(next);
      setEmojiOpen(false);

      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        try {
          el.setSelectionRange(caret, caret);
        } catch {
          // ignore
        }
      });
    },
    [draft, setDraft]
  );

  const pane = (
    <>
      <div className="shrink-0 sticky top-0 z-30 px-4 py-3 border-b border-slate-200 bg-white space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {selected ? <Avatar label={selected.displayName} src={selected.avatarUrl} /> : <Avatar label="—" />}

            <div className="min-w-0">
              <div className="text-sm font-black text-slate-900 truncate">{selected?.displayName || "Select a conversation"}</div>
              <div className="text-[12px] font-bold text-slate-500 truncate">
                {selected ? (!selected.anonymous && selected.studentId ? <>Student ID: {selected.studentId}</> : null) : "Choose a student from the list"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {showBack ? (
              <button
                onClick={onBack}
                className={[
                  "h-10 w-10 grid place-items-center",
                  "rounded-[10px] border border-slate-200 bg-white text-slate-700",
                  "hover:bg-slate-50 transition shrink-0",
                  "focus:outline-none focus:ring-4 focus:ring-slate-100",
                ].join(" ")}
                type="button"
                aria-label="Back"
                title="Back"
              >
                <IconBack className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={onBack}
                className={[
                  "h-10 px-3 inline-flex items-center gap-2",
                  "rounded-[10px] border border-slate-200 bg-white text-slate-700",
                  "hover:bg-slate-50 transition",
                  "focus:outline-none focus:ring-4 focus:ring-slate-100",
                ].join(" ")}
                type="button"
                aria-label="Close conversation"
                title="Close conversation"
              >
                <span className="text-sm font-extrabold">Close</span>
              </button>
            )}
          </div>
        </div>

        <LayoutGroup id="segmented-tabs">
          <div className="w-full">
            <div className="mx-auto w-full max-w-full sm:max-w-[520px] lg:max-w-[560px]">
              <div className="relative grid grid-cols-2 rounded-[10px] border border-slate-200 bg-white p-1 overflow-hidden">
                <motion.div
                  className="absolute top-1 bottom-1 left-1 rounded-[8px] bg-slate-900 shadow-sm"
                  initial={false}
                  animate={{ x: tab === "chat" ? 0 : "calc(100% + 4px)" }}
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  style={{ width: "calc(50% - 4px)" }}
                />

                <motion.button
                  type="button"
                  onClick={() => setTab("chat")}
                  whileTap={{ scale: 0.98 }}
                  className={[
                    "relative z-10 w-full rounded-full",
                    "px-2.5 sm:px-4 py-2",
                    "text-xs sm:text-sm font-extrabold select-none",
                    "inline-flex items-center justify-center gap-2 min-w-0",
                    tab === "chat" ? "text-white" : "text-slate-700 hover:text-slate-900",
                  ].join(" ")}
                >
                  <IconChat className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                  <span className="truncate">Messages</span>
                </motion.button>

                <motion.button
                  type="button"
                  disabled={moodDisabled}
                  onClick={() => !moodDisabled && setTab("mood")}
                  whileTap={moodDisabled ? undefined : { scale: 0.98 }}
                  className={[
                    "relative z-10 w-full rounded-full",
                    "px-2.5 sm:px-4 py-2",
                    "text-xs sm:text-sm font-extrabold select-none",
                    "inline-flex items-center justify-center gap-2 min-w-0",
                    moodDisabled ? "text-slate-400 cursor-not-allowed" : tab === "mood" ? "text-white" : "text-slate-700 hover:text-slate-900",
                  ].join(" ")}
                  title={moodDisabled ? "Mood Tracker is not available for anonymous students" : undefined}
                >
                  <IconMood className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                  <span className="truncate">
                    <span className="sm:hidden">Mood</span>
                    <span className="hidden sm:inline">Mood Tracker</span>
                  </span>
                </motion.button>
              </div>
            </div>
          </div>
        </LayoutGroup>
      </div>

      {!selected ? (
        <div className="flex-1 min-h-0 px-4 py-8 text-sm font-semibold text-slate-500">Pick a student from the left.</div>
      ) : (
        <>
          {tab === "chat" ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-4 py-4 space-y-3"
                style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}
              >
                <div className="flex justify-center">
                  <span className="text-[11px] font-bold text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                    {selected.read ? "Seen" : "Delivered"} • {selected.lastSeen}
                  </span>
                </div>

                {safeArray(selected.thread).map((m) => (
                  <ChatBubble key={m.id} by={m.by} text={m.text} participantAvatarUrl={selected.avatarUrl} />
                ))}
              </div>

              <div className="shrink-0 sticky bottom-2 z-20 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+24px)]">
                {/* ✅ wrapper is relative so the emoji popup can be centered within viewport */}
                <div ref={emojiWrapRef} className="relative flex items-end gap-2 max-[360px]:gap-1.5 min-w-0">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={1}
                    placeholder="Type a message…"
                    className="flex-1 min-w-0 resize-none rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        setEmojiOpen(false);
                        send();
                      }
                      if (e.key === "Escape") setEmojiOpen(false);
                    }}
                  />

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setEmojiOpen((v) => !v)}
                      className={[
                        "h-[46px] w-[46px] max-[360px]:h-10 max-[360px]:w-10 grid place-items-center",
                        "rounded-[10px] border border-slate-200 bg-white text-slate-700",
                        "hover:bg-slate-50 transition",
                        "focus:outline-none focus:ring-4 focus:ring-slate-100",
                      ].join(" ")}
                      aria-label="Insert emoji"
                      title="Emoji"
                    >
                      <IconEmoji className="w-5 h-5 max-[360px]:w-[18px] max-[360px]:h-[18px]" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setEmojiOpen(false);
                      send();
                    }}
                    type="button"
                    aria-label="Send"
                    className="shrink-0 h-[46px] max-[360px]:h-10 px-4 max-[360px]:px-3 rounded-[10px] text-sm font-extrabold bg-slate-900 text-white hover:bg-slate-800 shadow-sm inline-flex items-center justify-center"
                  >
                    <span className="max-[360px]:hidden">Send</span>
                    <span className="hidden max-[360px]:inline-flex" aria-hidden="true">
                      <IconSend className="w-5 h-5" />
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {emojiOpen ? (
                      // ✅ wrapper centers popup without fighting Framer Motion transforms
                      <div className="absolute bottom-[54px] left-1/2 z-50 w-[260px] max-w-[92vw] -translate-x-1/2">
                        <motion.div
                          initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                          transition={{ duration: reduceMotion ? 0 : 0.14, ease: "easeOut" }}
                          className="rounded-2xl border border-slate-200 bg-white shadow-lg p-2"
                        >
                          <div className="grid grid-cols-5 min-[360px]:grid-cols-6 min-[420px]:grid-cols-7 gap-1">
                            {CHAT_EMOJIS.map((emo) => (
                              <EmojiPickButton key={emo} emoji={emo} onPick={() => addEmojiToDraft(emo)} />
                            ))}
                          </div>
                        </motion.div>
                      </div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className="mt-1 text-[11px] font-bold text-slate-400">Enter = send • Shift+Enter = new line</div>
              </div>
            </div>
          ) : null}

          {tab === "mood" ? (
            <div className="h-full min-h-0 overflow-y-auto bg-slate-50 p-4">
              {selected.anonymous ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                  <div className="text-sm font-black text-slate-900">Mood Tracker locked</div>
                  <div className="mt-2 text-sm font-semibold text-slate-600">This student is anonymous, so mood history is not available.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {selected?.moodTracking?.status === "loading" ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                      <div className="text-sm font-black text-slate-900">Loading mood tracker…</div>
                      <div className="mt-2 text-sm font-semibold text-slate-600">Fetching submitted mood history.</div>
                    </div>
                  ) : selected?.moodTracking?.status === "error" ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                      <div className="text-sm font-black text-rose-800">Couldn’t load mood tracker</div>
                      <div className="mt-2 text-sm font-semibold text-rose-700">{selected?.moodTracking?.error || "Error"}</div>
                    </div>
                  ) : null}

                  <MoodTracker moodTracking={selected.moodTracking} day={day} onPickDay={setDay} />
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </>
  );

  if (!isMobileAnimated) {
    return <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col flex-1 min-h-0">{pane}</section>;
  }

  return (
    <motion.section
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col flex-1 min-h-0"
      initial={reduceMotion ? false : { x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { x: 60, opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        swiping.current = true;
      }}
      onPointerMove={(e) => {
        if (!swiping.current) return;
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) swiping.current = false;
      }}
      onPointerUp={() => {
        if (!swiping.current) return;
        swiping.current = false;
      }}
      style={{ touchAction: "pan-y" }}
    >
      {pane}
    </motion.section>
  );
}

/* -----------------------------
  Icons
----------------------------- */
function IconBack({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChat({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M7.5 18.5 4 20V6.8C4 5.8 4.8 5 5.8 5H18.2C19.2 5 20 5.8 20 6.8V14.2C20 15.2 19.2 16 18.2 16H9.2L7.5 18.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M7.5 9h9M7.5 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMood({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 21a9 9 0 1 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.8 14.2c1.1 1.3 2.5 2 4.2 2s3.1-.7 4.2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 10h.01M15 10h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IconEmoji({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 10h.01M15.5 10h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M8.4 14.2c1 1.2 2.2 1.8 3.6 1.8s2.6-.6 3.6-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSend({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M22 2 11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2 15 22l-4-9-9-4L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -----------------------------
  Main component
----------------------------- */
export default function Inbox() {
  const myId = getMyUserId();
  const today = useMemo(() => ymd(new Date()), []);

  const [desktopPaneOpen, setDesktopPaneOpen] = useState(true);

  // Real threads mapped into the same UI shape
  const [items, setItems] = useState([]);
  const [scrollKey, setScrollKey] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("chat");
  const [search, setSearch] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);

  const [day, setDay] = useState(today);
  const [draft, setDraft] = useState("");
  const [showConversation, setShowConversation] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selected = useMemo(() => items.find((x) => x.id === selectedId) || null, [items, selectedId]);
  const moodDisabled = !!selected?.anonymous; // identity hidden/unclaimed behaves like anonymous in UI
  const chatScrollRef = useRef(null);

  const closeDesktopConversation = () => {
    setDesktopPaneOpen(false);
    setSelectedId("");
    setTab("chat");
    setDraft("");
  };

  const activityOf = useCallback((x) => {
    const ts = typeof x?.lastActivity === "number" && Number.isFinite(x.lastActivity) ? x.lastActivity : null;
    if (ts != null) return ts;
    const d = Date.parse(String(x?.lastSeen || ""));
    return Number.isFinite(d) ? d : 0;
  }, []);

  const refreshThreads = useCallback(async () => {
    try {
      setError("");
      const res = await listThreadsRaw({ includeMessages: false, limit: 60, scope: "system" });
      const raw = Array.isArray(res?.items) ? res.items : [];
      const mapped = raw.map((t) => mapThreadToParticipant(t, myId));
      setItems((prev) => {
  const prevMap = new Map((prev || []).map((x) => [String(x.id), x]));
  return mapped.map((n) => {
    const old = prevMap.get(String(n.id));
    if (!old) return n;
    // preserve loaded chat + mood UI state to avoid blinking
    return {
      ...n,
      thread: Array.isArray(old.thread) && old.thread.length ? old.thread : n.thread,
      moodTracking: old.moodTracking || n.moodTracking,
    };
  });
});

      if (!selectedId && mapped.length) {
        setSelectedId(mapped[0].id);
      }
    } catch (e) {
      setError(e?.message || "Failed to load inbox.");
    } finally {
      setLoading(false);
    }
  }, [myId, selectedId]);

  const loadThread = useCallback(
    async (threadId) => {
      if (!threadId) return;
      try {
        // join realtime room for this thread (counselors can join any open thread)
        try {
          const s = connectMessagesSocket();
          s.emit("thread:join", { threadId: String(threadId) });
        } catch {}

        setError("");
        const res = await getThreadRaw(threadId, { limit: 200 });
        const t = res?.item;
        const msgs = Array.isArray(t?.messages) ? t.messages : [];

        const uiThread = msgs.map((m) => ({
          id: String(m._id),
          by: String(m.senderId) === String(myId) ? "Counselor" : "Participant",
          at: formatClock(m.createdAt),
          text: m.text,
          _raw: m,
        }));

        setItems((prev) =>
          prev.map((x) =>
            x.id === threadId
              ? {
                  ...x,
                  thread: uiThread,
                  lastMessage: t?.lastMessageText || x.lastMessage,
                  lastSeen: (t?.lastMessageAt || t?.updatedAt || t?.createdAt || "").slice(0, 10),
                  lastActivity: Date.parse(String(t?.lastMessageAt || t?.updatedAt || t?.createdAt || 0)) || x.lastActivity,
                  read: true,
                  _raw: t || x._raw,
                }
              : x
          )
        );

        markThreadRead(threadId).catch(() => {});
        requestAnimationFrame(() => setScrollKey((k) => k + 1));
      } catch (e) {
        const msg = e?.message || "Failed to load thread.";

        // ✅ PATCH (UX): if thread was claimed by another counselor, remove it immediately
        // so the counselor doesn't have to refresh and won't keep seeing "Forbidden".
        if (/forbidden/i.test(msg) || /claimed/i.test(msg)) {
          let nextSelected = "";
          setItems((prev) => {
            const next = (prev || []).filter((x) => String(x.id) !== String(threadId));
            // pick a sensible next selection if this was the active one
            if (String(selectedId) === String(threadId)) {
              nextSelected = String(next?.[0]?.id || "");
            }
            return next;
          });

          if (String(selectedId) === String(threadId)) {
            setSelectedId(nextSelected);
            setShowConversation(false);
          }

          setError("This conversation was claimed by another counselor.");
          return;
        }

        setError(msg);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setItems, selectedId]
  );


  const loadMoodTracking = useCallback(
    async (threadId, baseDay = today) => {
      if (!threadId) return;

      // only load when the UI allows (claimed-by-me & not anonymous)
      const current = items.find((x) => String(x.id) === String(threadId));
      if (!current || current.anonymous) return;

      const mt = current.moodTracking || {};
      const existing = safeArray(mt.entries);

      // if already loaded recently, and baseDay is within range, skip
      const loadedAt = Number(mt.loadedAt || 0);
      const fresh = Date.now() - loadedAt < 60_000; // 60s cache
      const has = existing.length > 0;

      // If counselor picks an older date than our earliest entry, refetch a wider window
      const earliest = has ? existing.reduce((min, e) => (String(e.date) < String(min) ? String(e.date) : String(min)), existing[0].date) : null;
      const needWider = earliest && String(baseDay) < String(earliest);

      if (fresh && has && !needWider) return;

      // Fetch a wide window around the selected day
      const from = addDays(baseDay, -420);
      const to = addDays(baseDay, 0);

      setItems((prev) =>
        prev.map((x) =>
          x.id === threadId
            ? { ...x, moodTracking: { ...(x.moodTracking || {}), status: "loading", error: "" } }
            : x
        )
      );

      try {
        const res = await listCounselorThreadJournalEntries(threadId, { from, to, limit: 1200 });
        const raw = safeArray(res?.entries);

        // map backend -> UI model (NO drafts; backend already filters)
        const mapped = raw
          .filter((e) => e?.daySubmitted) // safety
          .map((e) => ({
            date: String(e.dateKey || ""),
            mood: e.mood || "",
            reason: e.reason || "",
            notes: e.notes || "",
            copingUsed: safeArray(e.copingUsed),
          }))
          .filter((e) => !!e.date);

        setItems((prev) =>
          prev.map((x) =>
            x.id === threadId
              ? {
                  ...x,
                  moodTracking: { status: "ready", entries: mapped, error: "", loadedAt: Date.now() },
                }
              : x
          )
        );
      } catch (e) {
        setItems((prev) =>
          prev.map((x) =>
            x.id === threadId
              ? { ...x, moodTracking: { ...(x.moodTracking || {}), status: "error", error: e?.message || "Failed to load mood tracker.", loadedAt: Date.now() } }
              : x
          )
        );
      }
    },
    [items, today]
  );
  // initial load
  useEffect(() => {
    refreshThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when selecting a new thread, load messages
  useEffect(() => {
    if (!selectedId) return;
    loadThread(selectedId);
  }, [selectedId, loadThread]);
  // ✅ when opening Mood tab, load mood tracker (submitted only) for this thread
  useEffect(() => {
    if (!selectedId) return;
    if (tab !== "mood") return;
    if (moodDisabled) return;
    loadMoodTracking(selectedId, day);
  }, [selectedId, tab, moodDisabled, day, loadMoodTracking]);


  // scroll on changes
  useEffect(() => {
    if (!selected) return;
    if (tab !== "chat") return;
    if (!showConversation && window.innerWidth < 1024) return;
    scrollToBottomAfterPaint(chatScrollRef, 60);
  }, [selected?.id, tab, selected?.thread?.length, scrollKey, showConversation]);

  const list = useMemo(() => {
    let base = [...items].sort((a, b) => activityOf(b) - activityOf(a));
    if (filterUnread) base = base.filter((x) => !x.read);

    const q = search.trim().toLowerCase();
    if (!q) return base;

    return base.filter((x) => {
      const name = (x.displayName || "").toLowerCase();
      const sid = (x.studentId || "").toLowerCase();
      const msg = (x.lastMessage || "").toLowerCase();
      return name.includes(q) || sid.includes(q) || msg.includes(q);
    });
  }, [items, filterUnread, search, activityOf]);

  const markReadLocal = (id) => setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));

  const selectChat = (id) => {
    setSelectedId(id);
    markReadLocal(id);
    setTab("chat");
    setDay(today);
    setDraft("");
    setShowConversation(true);
    setDesktopPaneOpen(true);
    requestAnimationFrame(() => setScrollKey((k) => k + 1));
  };

  const send = async () => {
    if (!selected) return;
    const text = draft.trim();
    if (!text) return;

    // Block sending to closed threads
    if (String(selected?._raw?.status || "open") === "closed") {
      setError("This conversation is closed.");
      return;
    }

    // Read-only if claimed by another counselor
    const claimedBy = selected?._raw?.counselorId?._id || selected?._raw?.counselorId || null;
    if (claimedBy && String(claimedBy) !== String(myId)) {
      setError("This conversation is already claimed by another counselor (read-only).");
      return;
    }

    setError("");
    setDraft("");

    // optimistic (single)
    const tmpId = `tmp_${Date.now()}`;
    const now = new Date();
    const at = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const ts = now.getTime();

    setItems((prev) =>
      prev.map((x) =>
        x.id === selected.id
          ? {
              ...x,
              thread: [...safeArray(x.thread), { id: tmpId, by: "Counselor", at, text, _optimistic: true }],
              lastMessage: text,
              read: true,
              lastSeen: ymd(now),
              lastActivity: ts,
            }
          : x
      )
    );
    setScrollKey((k) => k + 1);

    try {
      const res = await sendMessageRaw({ threadId: selected.id, text, clientId: makeClientId() });
      const real = res?.item;

      if (real?._id) {
        setItems((prev) =>
          prev.map((x) => {
            if (x.id !== selected.id) return x;
            const withoutTmp = safeArray(x.thread).filter((m) => m.id !== tmpId);
            const exists = withoutTmp.some((m) => String(m.id) === String(real._id));
            const nextThread = exists
              ? withoutTmp
              : [...withoutTmp, { id: String(real._id), by: "Counselor", at: formatClock(real.createdAt), text: real.text, _raw: real }];

            return {
              ...x,
              thread: nextThread,
              lastMessage: real.text || x.lastMessage,
              lastSeen: ymd(new Date(real.createdAt)),
              lastActivity: Date.parse(String(real.createdAt)) || x.lastActivity,
            };
          })
        );
      } else {
        // fallback: remove tmp if API didn't return message
        setItems((prev) =>
          prev.map((x) => (x.id === selected.id ? { ...x, thread: safeArray(x.thread).filter((m) => m.id !== tmpId) } : x))
        );
      }

      markThreadRead(selected.id).catch(() => {});
      refreshThreads(); // update claim status + identity if claimed by me
    } catch (e) {
      // rollback tmp
      setItems((prev) =>
        prev.map((x) => (x.id === selected.id ? { ...x, thread: safeArray(x.thread).filter((m) => m.id !== tmpId) } : x))
      );
      setDraft(text);
      setError(e?.message || "Failed to send. If someone claimed it first, refresh.");
    }
  };



  // realtime: refresh list and keep open conversation in sync (no manual refresh)
  useEffect(() => {
    const s = connectMessagesSocket();

    // ✅ PATCH: After reconnect, re-join the currently opened thread so `message:new` arrives
    const handleConnect = () => {
      if (!selectedId) return;
      try {
        s.emit("thread:join", { threadId: String(selectedId) });
      } catch {}
    };
    try {
      s.on("connect", handleConnect);
    } catch {}

    // ✅ PATCH: If we only receive `thread:update` (metadata) but not `message:new`,
    // sync messages for the active thread (throttled) so the body updates without refresh.
    let syncing = false;
    let lastSyncAt = 0;

    const syncActiveThread = async (tid) => {
      if (!tid) return;
      const now = Date.now();
      if (syncing) return;
      if (now - lastSyncAt < 500) return; // throttle
      syncing = true;
      lastSyncAt = now;

      try {
        const res = await getThreadRaw(tid, { limit: 200 });
        const t = res?.item;
        const msgs = Array.isArray(t?.messages) ? t.messages : [];

        const uiThread = msgs.map((m) => ({
          id: String(m._id),
          by: String(m.senderId) === String(myId) ? "Counselor" : "Participant",
          at: formatClock(m.createdAt),
          text: m.text,
          _raw: m,
        }));

        setItems((prev) =>
          prev.map((x) => {
            if (String(x.id) !== String(tid)) return x;

            // keep any local optimistic bubbles that haven't come back from API yet
            const optimistic = safeArray(x.thread).filter((m) => m?._optimistic);
            const seen = new Set(uiThread.map((m) => String(m.id)));
            const merged = [...uiThread, ...optimistic.filter((m) => !seen.has(String(m.id)))];

            const lastAt = t?.lastMessageAt || t?.updatedAt || t?.createdAt || x._raw?.lastMessageAt || x._raw?.updatedAt;
            return {
              ...x,
              thread: merged,
              lastMessage: t?.lastMessageText || t?.lastMessage || x.lastMessage,
              lastSeen: lastAt ? ymd(new Date(lastAt)) : x.lastSeen,
              lastActivity: Date.parse(String(lastAt)) || x.lastActivity,
              _raw: t || x._raw,
            };
          })
        );

        // If the counselor is viewing this thread, mark it read (best effort)
        try {
          if (String(tid) === String(selectedId)) {
            markThreadRead(tid).catch(() => {});
          }
        } catch {}

        setScrollKey((k) => k + 1);
      } catch {
        // ignore sync errors; list still updates
      } finally {
        syncing = false;
      }
    };

    const offNew = onMessageNew((payload) => {
      const tid = String(payload?.threadId || "");
      const msg = payload?.message;
      if (!tid || !msg?._id) return;

      setItems((prev) =>
        prev.map((x) => {
          if (x.id !== tid) return x;

          const isOpen = String(tid) === String(selectedId);
          const thread = safeArray(x.thread);

          const exists = thread.some((m) => String(m.id) === String(msg._id));
          const nextThread =
            isOpen && !exists
              ? [
                  ...thread,
                  {
                    id: String(msg._id),
                    by: String(msg.senderId) === String(myId) ? "Counselor" : "Participant",
                    at: formatClock(msg.createdAt),
                    text: msg.text,
                    _raw: msg,
                  },
                ]
              : thread;

          const lastAt = msg.createdAt || x._raw?.lastMessageAt || x._raw?.updatedAt;
          return {
            ...x,
            thread: nextThread,
            lastMessage: msg.text || x.lastMessage,
            lastSeen: lastAt ? ymd(new Date(lastAt)) : x.lastSeen,
            lastActivity: Date.parse(String(lastAt)) || x.lastActivity,
          };
        })
      );

      setScrollKey((k) => k + 1);
    });

    const offUpd = onThreadUpdate((payload) => {
      refreshThreads();
      const tid = String(payload?.threadId || "");
      if (tid && String(tid) === String(selectedId)) {
        syncActiveThread(tid);
      }
    });

    const offCreate = onThreadCreated(() => refreshThreads());

    const offClaim = onThreadClaimed((payload) => {
      const tid = String(payload?.threadId || "");
      const claimedBy = String(payload?.counselorId || "");
      if (!tid) return;

      // ✅ PATCH (UX): if another counselor claimed it, remove it immediately.
      if (claimedBy && claimedBy !== String(myId)) {
        let nextSelected = "";
        setItems((prev) => {
          const next = (prev || []).filter((x) => String(x.id) !== tid);
          if (String(selectedId) === tid) {
            nextSelected = String(next?.[0]?.id || "");
          }
          return next;
        });

        if (String(selectedId) === tid) {
          setSelectedId(nextSelected);
          setShowConversation(false);
        }

        setError("This conversation was claimed by another counselor.");
      }
    });

    // ✅ PATCH: also try to re-join the room right away (in case socket is already connected)
    handleConnect();

    return () => {
      try {
        offNew?.();
      } catch {}
      try {
        offUpd?.();
      } catch {}
      try {
        offCreate?.();
      } catch {}
      try {
        offClaim?.();
      } catch {}
      try {
        s.off("connect", handleConnect);
      } catch {}
      // keep socket alive (shared singleton)
    };
  }, [refreshThreads, selectedId, myId]);


  const InboxList = (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-200 bg-white space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-black text-slate-900">Student List</div>
          <button
            onClick={() => setFilterUnread((v) => !v)}
            className={[
              "px-3 py-2 rounded-xl text-sm font-extrabold transition border",
              filterUnread ? "bg-slate-900 text-white border-slate-900 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
            ].join(" ")}
            type="button"
          >
            Unread
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-slate-100"
        />

        {loading ? (
          <div className="text-[12px] font-bold text-slate-500">Loading…</div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0">
        {list.length === 0 ? (
          <div className="px-4 py-6 text-sm font-semibold text-slate-500">No conversations yet.</div>
        ) : (
          <AnimatedInboxList
            items={list}
            selectedId={selectedId}
            onItemSelect={(item) => selectChat(item.id)}
            showGradients
            enableArrowNavigation
            displayScrollbar
            className="h-full min-h-0"
            containerStyle={{}}
          />
        )}
      </div>
    </section>
  );

  return (
    <div className="h-full min-h-0 min-w-0" style={{ fontFamily: 'Nunito, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial' }}>
      <div className="lg:hidden h-full min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {!showConversation ? (
              <motion.div
                key="list"
                className="flex-1 min-h-0 flex flex-col"
                initial={{ x: 0, opacity: 1 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {InboxList}
              </motion.div>
            ) : (
              <motion.div key="conversation" className="flex-1 min-h-0 flex flex-col">
                <ConversationPane
                  selected={selected}
                  tab={tab}
                  setTab={setTab}
                  moodDisabled={moodDisabled}
                  day={day}
                  setDay={setDay}
                  draft={draft}
                  setDraft={setDraft}
                  send={send}
                  chatScrollRef={chatScrollRef}
                  showBack
                  onBack={() => setShowConversation(false)}
                  isMobileAnimated
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="hidden lg:block h-full min-h-0">
        <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          {InboxList}

          {desktopPaneOpen ? (
            <ConversationPane
              selected={selected}
              tab={tab}
              setTab={setTab}
              moodDisabled={moodDisabled}
              day={day}
              setDay={setDay}
              draft={draft}
              setDraft={setDraft}
              send={send}
              chatScrollRef={chatScrollRef}
              showBack={false}
              onBack={closeDesktopConversation}
              isMobileAnimated={false}
            />
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="h-full min-h-0 flex items-center justify-center bg-slate-50 px-6">
                <div className="text-center max-w-[420px]">
                  <div className="mx-auto w-[220px] sm:w-[260px]">
                    <Lottie animationData={messageAnim} loop autoplay className="w-full h-auto" />
                  </div>

                  <div className="mt-4 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Select a conversation</div>
                  <div className="mt-2 text-base sm:text-lg font-semibold text-slate-600">Choose a student from the list to view messages.</div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
