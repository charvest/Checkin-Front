// src/pages/Services/SessionType/Request.js
import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";

import MessagesDrawer from "../../../components/Message/MessagesDrawer";
import FloatingMessagesPill from "../../../components/Message/FloatingMessagesPill";
import { cancelCurrentRequest } from "./Request"; // adjust path if needed

/* ===================== THEME ===================== */
const LOGIN_PRIMARY = "#B9FF66";
const TEXT_MAIN = "#141414";
const TEXT_MUTED = "rgba(20,20,20,0.82)";
const TEXT_SOFT = "rgba(20,20,20,0.66)";
const ERROR_TEXT = "#C62828";
const PH_TZ = "Asia/Manila";

/* ===================== AUTH (logged-in identity) ===================== */
function safeJSON(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function base64UrlDecode(str) {
  try {
    const pad = "=".repeat((4 - (str.length % 4)) % 4);
    const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(
      Array.from(atob(b64))
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
  } catch {
    return null;
  }
}

function decodeJWT(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = base64UrlDecode(parts[1]);
  return payload ? safeJSON(payload) : null;
}

function pickIdentity(obj) {
  if (!obj || typeof obj !== "object") return null;

  const email =
    obj.email ||
    obj.user?.email ||
    obj.profile?.email ||
    obj.account?.email ||
    obj.data?.email ||
    obj.user?.profile?.email;

  if (!email || typeof email !== "string") return null;

  const name =
    obj.name ||
    obj.user?.name ||
    obj.profile?.name ||
    obj.displayName ||
    obj.user?.displayName ||
    obj.fullName ||
    obj.user?.fullName ||
    "";

  const studentNumber =
    obj.studentNumber ||
    obj.user?.studentNumber ||
    obj.profile?.studentNumber ||
    obj.studentNo ||
    obj.user?.studentNo ||
    "";

  return { email, name, studentNumber };
}

function readLoggedInIdentity() {
  if (typeof window === "undefined") return null;

  const preferredKeys = [
    "currentUser",
    "user",
    "authUser",
    "profile",
    "checkin:user",
    "checkin:auth",
    "firebase:authUser",
    "persist:root",
  ];

  for (const k of preferredKeys) {
    const raw = window.localStorage.getItem(k);
    if (!raw) continue;

    if (k === "persist:root") {
      const root = safeJSON(raw);
      if (root && typeof root === "object") {
        for (const v of Object.values(root)) {
          if (typeof v !== "string") continue;
          const parsed = safeJSON(v);
          const id = pickIdentity(parsed);
          if (id) return id;
        }
      }
      continue;
    }

    const parsed = safeJSON(raw);
    const id = pickIdentity(parsed);
    if (id) return id;
  }

  try {
    for (const k of Object.keys(window.localStorage)) {
      const raw = window.localStorage.getItem(k);
      if (!raw || raw.length > 50_000) continue;

      const parsed = safeJSON(raw);
      const id = pickIdentity(parsed);
      if (id) return id;

      if (k.toLowerCase().includes("token")) {
        const payload = decodeJWT(raw);
        const tokId = pickIdentity(payload);
        if (tokId) return tokId;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/* ===================== STORAGE (shared with ViewRequest.js) ===================== */
const REQUESTS_STORAGE_KEY = "checkin:counseling_requests"; // ✅ same key used by ViewRequest.js

function safeJSONParse(v, fallback) {
  try {
    const x = JSON.parse(v);
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

function loadAllRequests() {
  try {
    const raw = window.localStorage.getItem(REQUESTS_STORAGE_KEY);
    const list = safeJSONParse(raw || "[]", []);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveAllRequests(list) {
  try {
    window.localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

function upsertRequest(item) {
  const list = loadAllRequests();
  const idx = list.findIndex((r) => r.id === item.id);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = { ...next[idx], ...item };
    saveAllRequests(next);
    return;
  }
  saveAllRequests([item, ...list]);
}

function patchRequest(id, patch) {
  const list = loadAllRequests();
  const next = list.map((r) => (r.id === id ? { ...r, ...patch } : r));
  saveAllRequests(next);
}

/* ===================== DATA ===================== */
const REASONS = [
  "Academic stress",
  "Anxiety / Overthinking",
  "Depression / Low mood",
  "Family / Relationships",
  "Self-esteem",
  "Grief / Loss",
  "Other",
];

const COUNSELORS = [
  { id: "C-101", name: "Counselor A" },
  { id: "C-102", name: "Counselor B" },
  { id: "C-103", name: "Counselor C" },
  { id: "C-104", name: "Counselor D" },
];

const HOLIDAYS = [
  "2026-01-01",
  "2026-04-09",
  "2026-04-10",
  "2026-05-01",
  "2026-06-12",
  "2026-08-21",
  "2026-11-30",
  "2026-12-25",
  "2026-12-30",
];

/* ===================== TIME RULES ===================== */
const LUNCH_SLOT = "12:00";
const LUNCH_REASON = "Lunch break (12:00–12:59 PM)";
const ALWAYS_OPEN_SLOT = "13:00"; // ✅ 1:00 PM always available (demo)

/* ===================== ID HELPERS ===================== */
function makeId(prefix = "id") {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch (_) {}
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ===================== TIME / DATE HELPERS ===================== */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function compareISO(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
function toMin(h, m) {
  return h * 60 + m;
}
function hhmmToMin(hhmm) {
  const [h, m] = String(hhmm || "00:00")
    .split(":")
    .map(Number);
  return h * 60 + m;
}
function minToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}
function formatTime12(hhmm) {
  const [h, m] = String(hhmm || "00:00")
    .split(":")
    .map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(m)} ${suffix}`;
}
function isWithinWorkHours(hhmm) {
  const t = hhmmToMin(hhmm);
  return t >= hhmmToMin("08:00") && t <= hhmmToMin("17:00");
}

/* ===================== SLOT BUILDER ===================== */
function buildSlots(start = "08:00", end = "17:00", stepMin = 60) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = toMin(sh, sm);
  const e = toMin(eh, em);

  const out = [];
  for (let t = s; t < e; t += stepMin) out.push(minToTime(t));
  return out;
}

const SCHOOL_SLOTS = buildSlots("08:00", "17:00", 60);

/* ===================== PH TIME HELPERS ===================== */
function getPHParts(date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23", // ✅ prevents "24:xx" edge case
  });
  const parts = dtf.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;

  const hh = Number(get("hour") ?? 0);
  const mm = Number(get("minute") ?? 0);

  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hh: pad2(Number.isFinite(hh) ? hh : 0),
    mm: pad2(Number.isFinite(mm) ? mm : 0),
  };
}
function todayISO_PH() {
  const p = getPHParts();
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}
function nowHHMM_PH() {
  const p = getPHParts();
  return `${p.hh}:${p.mm}`;
}
function todayISO_LOCAL() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function safeMinDateISO() {
  const local = todayISO_LOCAL();
  const ph = todayISO_PH();
  return compareISO(local, ph) > 0 ? local : ph;
}
function dayOfWeekFromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.getUTCDay();
}
function isWeekend(iso) {
  if (!iso) return false;
  const day = dayOfWeekFromISO(iso);
  return day === 0 || day === 6;
}
function isHoliday(iso) {
  return !!iso && HOLIDAYS.includes(iso);
}
function getDayState(iso) {
  if (!iso) return { ok: false, label: "Select a date" };
  if (compareISO(iso, todayISO_PH()) < 0)
    return { ok: false, label: "Past date (not allowed)" };
  if (isHoliday(iso)) return { ok: false, label: "Holiday (No service)" };
  if (isWeekend(iso)) return { ok: false, label: "Weekend (No service)" };
  return { ok: true, label: "Available" };
}
function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}
function isoToNice(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
function findNextWorkingDay(startISO) {
  let cur = startISO;
  for (let i = 0; i < 90; i++) {
    if (getDayState(cur).ok) return cur;
    cur = addDaysISO(cur, 1);
  }
  return startISO;
}
function getReviewInfoPH() {
  const today = todayISO_PH();
  const ds = getDayState(today);
  const within = isWithinWorkHours(nowHHMM_PH());

  if (ds.ok && within) {
    return {
      ok: true,
      title: "Within 24 hours",
      desc: "Submitted during working hours, reviewed within 24 hours.",
      next: "Review is open now (until 5:00 PM).",
    };
  }

  const nextDay =
    ds.ok && !within
      ? findNextWorkingDay(addDaysISO(today, 1))
      : findNextWorkingDay(today);
  const when =
    nextDay === addDaysISO(today, 1) ? "tomorrow" : `on ${isoToNice(nextDay)}`;

  return {
    ok: false,
    title: "Queued",
    desc: !ds.ok
      ? `Today is ${ds.label}. Your request will be queued.`
      : "Outside working hours (8:00 AM – 5:00 PM). Your request will be queued.",
    next: `Next review starts ${when} at 8:00 AM.`,
  };
}

/* ===================== AVAILABILITY (DEMO) ===================== */
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getCounselorAvailability(counselorId, dateStr) {
  const ds = getDayState(dateStr);
  if (!ds.ok) return { onLeave: true, booked: new Set(SCHOOL_SLOTS) };

  const seed = hashStr(`${counselorId}|${dateStr}`);
  const rnd = mulberry32(seed);

  const onLeave = rnd() < 0.08;
  if (onLeave) return { onLeave: true, booked: new Set(SCHOOL_SLOTS) };

  const bookedRatio = 0.25 + rnd() * 0.4;
  const bookCount = Math.max(2, Math.floor(SCHOOL_SLOTS.length * bookedRatio));

  const booked = new Set();
  while (booked.size < bookCount) {
    const idx = Math.floor(rnd() * SCHOOL_SLOTS.length);
    const slot = SCHOOL_SLOTS[idx];
    if (slot === LUNCH_SLOT) continue;
    if (slot === ALWAYS_OPEN_SLOT) continue;
    booked.add(slot);
  }

  booked.add(LUNCH_SLOT);
  booked.delete(ALWAYS_OPEN_SLOT);

  return { onLeave: false, booked };
}

function counselorStatus(onLeave, openCount) {
  if (onLeave) return "On Leave";
  if (openCount <= 0) return "Fully Booked";
  if (openCount <= 2) return "Limited";
  return "Available";
}

/* ===================== PENDING LOCK ===================== */
function hasAnyPendingMeetRequest() {
  const list = loadAllRequests();
  return list.some(
    (r) => r && r.type === "MEET" && (r.status || "Pending") === "Pending",
  );
}

/* ===================== COMPONENT ===================== */
export default function Request({ onClose }) {
  const navigate = useNavigate();

  const [userIdentity, setUserIdentity] = useState(() =>
    readLoggedInIdentity(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = () => setUserIdentity(readLoggedInIdentity());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [openMessages, setOpenMessages] = useState(false);

  const [pillUnlocked, setPillUnlocked] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return window.localStorage.getItem("pillUnlocked") === "1";
    } catch {
      return false;
    }
  });

  const [pillPop, setPillPop] = useState(false);
  const prevOpenRef = useRef(false);

  const buildInitialThreads = () => [
    {
      id: "thread-1",
      name: "Guidance Counselor",
      subtitle: "Counselor",
      avatarUrl: "https://via.placeholder.com/48",
      lastMessage: "Hi! How can I help you?",
      lastTime: "now",
      unread: 1,
      messages: [
        {
          id: "m1",
          from: "them",
          text: "Hi! How can I help you?",
          time: "09:00",
          createdAt: Date.now(),
        },
      ],
    },
  ];

  const [threads, setThreads] = useState(buildInitialThreads);

  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + (t.unread || 0), 0),
    [threads],
  );

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Request state (cancel only) - legacy key for this page
  const [currentRequest, setCurrentRequest] = useState(() => {
    try {
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem("currentRequest");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // ✅ Single pending meet lock state (derived from shared storage)
  const [pendingLocked, setPendingLocked] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return hasAnyPendingMeetRequest();
    } catch {
      return false;
    }
  });

  const refreshPendingLock = useCallback(() => {
    setPendingLocked(hasAnyPendingMeetRequest());
  }, []);

  // Persist legacy currentRequest
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (!currentRequest) window.localStorage.removeItem("currentRequest");
      else
        window.localStorage.setItem(
          "currentRequest",
          JSON.stringify(currentRequest),
        );
    } catch {}
  }, [currentRequest]);

  // Persist pillUnlocked
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem("pillUnlocked", pillUnlocked ? "1" : "0");
    } catch {}
  }, [pillUnlocked]);

  // Escape closes messages drawer
  useEffect(() => {
    if (!openMessages) return;
    const onKeyDown = (e) => e.key === "Escape" && setOpenMessages(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openMessages]);

  const handleSendMessage = ({ threadId, text }) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;

        const newMsg = {
          id: makeId("msg"),
          from: "me",
          text,
          time: new Intl.DateTimeFormat("en-US", {
            timeZone: PH_TZ,
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }).format(new Date()),
          createdAt: Date.now(),
        };

        return {
          ...t,
          messages: [...(t.messages || []), newMsg],
          lastMessage: text,
          lastTime: "now",
          unread: 0,
        };
      }),
    );
  };

  const handleEndChat = useCallback((threadId) => {
    const now = new Date();
    const timeLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: PH_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(now);

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;

        const greeting = {
          id: makeId("msg"),
          from: "them",
          text: "Hi! How can I help you?",
          time: timeLabel,
          createdAt: Date.now(),
        };
        return {
          ...t,
          lastMessage: greeting.text,
          lastTime: "now",
          unread: 0,
          messages: [greeting],
        };
      }),
    );
  }, []);

  const handleRefreshThreads = useCallback(() => {
    setThreads(buildInitialThreads());
  }, []);

  const close = () => {
    if (typeof onClose === "function") return onClose();
    navigate(-1);
  };

  const openMessagesFlow = useCallback(() => {
    if (!termsAccepted) {
      setShowTerms(true);
      return;
    }
    setPillUnlocked(true);
    setOpenMessages(true);
  }, [termsAccepted]);

  useEffect(() => {
    const wasOpen = prevOpenRef.current;

    if (wasOpen && !openMessages && pillUnlocked) {
      setPillPop(true);
      const t = setTimeout(() => setPillPop(false), 260);
      prevOpenRef.current = openMessages;
      return () => clearTimeout(t);
    }

    prevOpenRef.current = openMessages;
  }, [openMessages, pillUnlocked]);

  const [step, setStep] = useState(0);

  const [meet, setMeet] = useState({
    sessionType: "",
    reason: "",
    counselorId: "",
    date: "",
    time: "",
    notes: "",
  });

  const [meetError, setMeetError] = useState("");
  const [meetSuccess, setMeetSuccess] = useState("");

  const clearMeetFeedback = useCallback(() => {
    setMeetError("");
    setMeetSuccess("");
  }, []);

  const [reviewInfo, setReviewInfo] = useState(() => getReviewInfoPH());
  useEffect(() => {
    const id = setInterval(() => setReviewInfo(getReviewInfoPH()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ✅ Keep pending lock fresh (in case ViewRequest updates status)
  useEffect(() => {
    refreshPendingLock();
    const onStorage = (e) => {
      if (e.key === REQUESTS_STORAGE_KEY) refreshPendingLock();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshPendingLock]);

  // ✅ Backward compatibility: if legacy currentRequest exists, ensure it is stored in shared list
  useEffect(() => {
    if (!currentRequest) return;
    if (currentRequest?.status && currentRequest.status !== "Pending") return;
    if (!currentRequest?.date || !currentRequest?.time) return; // only MEET-like
    const maybe = {
      id: currentRequest.id || makeId("REQ-MEET"),
      type: "MEET",
      status: currentRequest.status || "Pending",
      sessionType: currentRequest.sessionType,
      reason: currentRequest.reason,
      date: currentRequest.date,
      time: formatTime12(currentRequest.time),
      counselorName: currentRequest.counselorName || "Any counselor",
      notes: currentRequest.notes || "",
      createdAt: new Date(currentRequest.createdAt || Date.now()).toISOString(),
      completedAt: "",
    };
    upsertRequest(maybe);
    refreshPendingLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayState = useMemo(() => getDayState(meet.date), [meet.date]);

  const availabilityByCounselor = useMemo(() => {
    const out = {};
    if (!meet.date) return out;
    for (const c of COUNSELORS)
      out[c.id] = getCounselorAvailability(c.id, meet.date);
    return out;
  }, [meet.date]);

  const counselorsComputed = useMemo(() => {
    return COUNSELORS.map((c) => {
      if (!meet.date)
        return {
          ...c,
          _status: "Select date",
          _openCount: 0,
          _onLeave: false,
          _booked: new Set(),
        };

      const info = availabilityByCounselor[c.id];

      // open slots as user-selectable slots; exclude lunch from the count
      const bookedCountExcludingLunch = info.booked.has(LUNCH_SLOT)
        ? info.booked.size - 1
        : info.booked.size;
      const openCount = Math.max(
        0,
        SCHOOL_SLOTS.length - 1 - bookedCountExcludingLunch,
      );

      return {
        ...c,
        _onLeave: info.onLeave,
        _booked: info.booked,
        _openCount: openCount,
        _status: counselorStatus(info.onLeave, openCount),
      };
    }).sort((a, b) => {
      const rank = {
        Available: 0,
        Limited: 1,
        "Fully Booked": 2,
        "On Leave": 3,
        "Select date": 4,
      };
      return (rank[a._status] ?? 9) - (rank[b._status] ?? 9);
    });
  }, [meet.date, availabilityByCounselor]);

  const slotAvailability = useMemo(() => {
    const out = {};

    if (!meet.date || !dayState.ok) {
      SCHOOL_SLOTS.forEach(
        (t) => (out[t] = { enabled: false, reason: dayState.label }),
      );
      return out;
    }

    if (meet.counselorId) {
      const info = availabilityByCounselor[meet.counselorId];
      SCHOOL_SLOTS.forEach((t) => {
        const enabled = !info.onLeave && !info.booked.has(t);
        out[t] = {
          enabled,
          reason: enabled ? "" : info.onLeave ? "On leave" : "Booked",
        };
      });

      out[LUNCH_SLOT] = { enabled: false, reason: LUNCH_REASON };
      return out;
    }

    SCHOOL_SLOTS.forEach((t) => {
      let any = false;
      for (const c of COUNSELORS) {
        const info = availabilityByCounselor[c.id];
        if (!info.onLeave && !info.booked.has(t)) {
          any = true;
          break;
        }
      }
      out[t] = { enabled: any, reason: any ? "" : "No counselors available" };
    });

    out[LUNCH_SLOT] = { enabled: false, reason: LUNCH_REASON };
    return out;
  }, [
    meet.date,
    meet.counselorId,
    dayState.ok,
    dayState.label,
    availabilityByCounselor,
  ]);

  const selectedCounselor = useMemo(
    () => COUNSELORS.find((c) => c.id === meet.counselorId) || null,
    [meet.counselorId],
  );

  const autoAssignCounselor = useCallback(
    (dateStr, timeStr) => {
      const useCache = dateStr === meet.date;
      if (timeStr === LUNCH_SLOT) return null;

      for (const c of COUNSELORS) {
        const info = useCache
          ? availabilityByCounselor[c.id]
          : getCounselorAvailability(c.id, dateStr);
        if (info && !info.onLeave && !info.booked.has(timeStr)) return c;
      }
      return null;
    },
    [availabilityByCounselor, meet.date],
  );

  const onDateChange = (val) => {
    const ds = getDayState(val);
    clearMeetFeedback();

    setMeet((p) => ({
      ...p,
      date: val,
      time: "",
      counselorId: ds.ok ? p.counselorId : "",
    }));
  };

  const requireTermsOr = (fn) => {
    if (!termsAccepted) return setShowTerms(true);
    fn?.();
  };

  const totalSteps = 5;
  const progress =
    step <= 0
      ? 0
      : step >= 6
        ? 100
        : Math.round(((step - 1) / (totalSteps - 1)) * 100);

  const meetSummary = useMemo(() => {
    const parts = [];
    if (meet.sessionType) parts.push(meet.sessionType);
    if (meet.date) parts.push(isoToNice(meet.date));
    if (meet.time) parts.push(formatTime12(meet.time));
    return parts.length ? parts.join(" • ") : "—";
  }, [meet.sessionType, meet.date, meet.time]);

  const canContinue = useMemo(() => {
    if (step === 1) return !!meet.sessionType;
    if (step === 2) return !!meet.reason;
    if (step === 3) return !!meet.date && dayState.ok;
    if (step === 4)
      return !!meet.time && !!slotAvailability[meet.time]?.enabled;
    if (step === 5) return true;
    return false;
  }, [
    step,
    meet.sessionType,
    meet.reason,
    meet.date,
    meet.time,
    dayState.ok,
    slotAvailability,
  ]);

  const validateStep = useCallback(() => {
    if (!termsAccepted) return { ok: false, msg: null, showTerms: true };

    if (step === 1 && !meet.sessionType)
      return { ok: false, msg: "Choose a session type." };
    if (step === 2 && !meet.reason)
      return { ok: false, msg: "Choose a reason." };
    if (step === 3) {
      if (!meet.date) return { ok: false, msg: "Select a date." };
      if (!dayState.ok) return { ok: false, msg: dayState.label };
    }
    if (step === 4) {
      if (!meet.time) return { ok: false, msg: "Select a time." };
      if (meet.time === LUNCH_SLOT) return { ok: false, msg: LUNCH_REASON };
      const slot = slotAvailability[meet.time];
      if (!slot?.enabled)
        return {
          ok: false,
          msg: `Time not available${slot?.reason ? ` (${slot.reason})` : ""}.`,
        };
    }
    return { ok: true };
  }, [
    termsAccepted,
    step,
    meet.sessionType,
    meet.reason,
    meet.date,
    meet.time,
    dayState.ok,
    dayState.label,
    slotAvailability,
  ]);

  // ✅ Hard lock: if pendingLocked and user is in booking steps, push to success view
  useEffect(() => {
    if (!pendingLocked) return;
    if (step >= 1 && step <= 5) {
      setMeetError("");
      setMeetSuccess(
        "You already have a pending request. Cancel it first before booking a new one.",
      );
      setStep(6);
    }
  }, [pendingLocked, step]);

  const goNext = () => {
    clearMeetFeedback();

    if (pendingLocked) {
      setMeetSuccess(
        "You already have a pending request. Cancel it first before booking a new one.",
      );
      return setStep(6);
    }

    const v = validateStep();
    if (v.showTerms) return setShowTerms(true);
    if (!v.ok) return setMeetError(v.msg || "Please complete this step.");

    setStep((s) => Math.min(6, s + 1));
  };

  const goBack = () => {
    clearMeetFeedback();
    if (step === 0) return close();
    if (step === 6) return setStep(0);
    setStep((s) => Math.max(0, s - 1));
  };

  const submitMeet = () => {
    clearMeetFeedback();

    if (pendingLocked) {
      setMeetSuccess(
        "You already have a pending request. Cancel it first before booking a new one.",
      );
      return setStep(6);
    }

    if (!termsAccepted) return setShowTerms(true);
    if (!meet.sessionType) return setMeetError("Choose a session type.");
    if (!meet.reason) return setMeetError("Choose a reason.");
    if (!meet.date) return setMeetError("Select a date.");
    if (!dayState.ok) return setMeetError(dayState.label);
    if (!meet.time) return setMeetError("Select a time.");
    if (meet.time === LUNCH_SLOT) return setMeetError(LUNCH_REASON);

    const slot = slotAvailability[meet.time];
    if (!slot || !slot.enabled)
      return setMeetError(
        `Time not available${slot?.reason ? ` (${slot.reason})` : ""}.`,
      );

    const assigned = meet.counselorId
      ? selectedCounselor
      : autoAssignCounselor(meet.date, meet.time);
    if (!assigned) return setMeetError("No counselor available for that slot.");

    const payload = {
      sessionType: meet.sessionType,
      reason: meet.reason,
      date: meet.date,
      time: meet.time,
      notes: meet.notes,
      counselorId: assigned.id,
      counselorName: assigned.name,
      status: "Pending",
      updatedAt: Date.now(),
    };

    const newReq = {
      id: makeId("REQ-MEET"),
      createdAt: Date.now(),
      ...payload,
    };
    setCurrentRequest(newReq);
    setMeetSuccess(
      "Request sent. You’ll receive a confirmation once approved.",
    );
    setStep(6);

    // ✅ Write to shared list so ViewRequest.js can see it
    upsertRequest({
      id: newReq.id,
      type: "MEET",
      status: "Pending",
      sessionType: newReq.sessionType,
      reason: newReq.reason,
      date: newReq.date,
      time: formatTime12(newReq.time),
      counselorName: newReq.counselorName || "Any counselor",
      notes: newReq.notes || "",
      createdAt: new Date(newReq.createdAt).toISOString(),
      completedAt: "",
    });

    refreshPendingLock();
  };

  const tapClass = "active:scale-[0.98] transition-transform";
  const rootClass =
    "w-full min-h-[70vh] flex items-center justify-center px-4 pt-8 " +
    (pillUnlocked && termsAccepted ? "pb-24" : "pb-8");
  const displayReq = currentRequest || null;
  const isOverlayOpen = showTerms || showCancelConfirm;

  return (
    <div className={rootClass}>
      {pillUnlocked && termsAccepted && !isOverlayOpen ? (
        <FloatingMessagesPill
          accent={LOGIN_PRIMARY}
          unread={totalUnread}
          onClick={openMessagesFlow}
          hidden={openMessages || isOverlayOpen}
          pop={pillPop}
        />
      ) : null}

      <MessagesDrawer
        open={openMessages}
        onClose={() => setOpenMessages(false)}
        threads={threads}
        onSendMessage={handleSendMessage}
        onEndChat={handleEndChat}
        onRefreshThreads={handleRefreshThreads}
        userIdentity={userIdentity}
        title="Messages"
      />

      <div className="w-full max-w-3xl">
        <div className="relative overflow-hidden rounded-[26px] bg-[#F7F8FA] shadow-[0_18px_60px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 h-11 w-11 rounded-full bg-white/80 hover:bg-white transition flex items-center justify-center"
          >
            <span
              className="text-2xl leading-none"
              style={{ color: TEXT_MAIN }}
            >
              ×
            </span>
          </button>

          {showTerms ? (
            <TermsModal
              accent={LOGIN_PRIMARY}
              onAccept={() => {
                setTermsAccepted(true);
                setShowTerms(false);
              }}
              onClose={() => setShowTerms(false)}
            />
          ) : null}

          {showCancelConfirm ? (
            <ConfirmCancelModal
              accent={LOGIN_PRIMARY}
              onClose={() => setShowCancelConfirm(false)}
              onConfirm={() => {
                setShowCancelConfirm(false);

                if (displayReq?.id) {
                  // ✅ cancel legacy currentRequest + shared list entry
                  patchRequest(displayReq.id, {
                    status: "Canceled",
                    canceledAt: new Date().toISOString(),
                  });
                }

                setCurrentRequest((prev) =>
                  prev
                    ? {
                        ...prev,
                        status: "Canceled",
                        canceledAt: Date.now(),
                        updatedAt: Date.now(),
                      }
                    : prev,
                );
                setMeetSuccess("Request canceled.");
                setStep(6);
                refreshPendingLock();
              }}
            />
          ) : null}

          {step >= 1 && step <= 5 ? (
            <ProgressHeader
              accent={LOGIN_PRIMARY}
              title={`Step ${step} of ${5}`}
              subtitle={
                step === 1
                  ? "Choose session type"
                  : step === 2
                    ? "Choose reason"
                    : step === 3
                      ? "Pick a date"
                      : step === 4
                        ? "Pick a time"
                        : "Confirm"
              }
              progress={progress}
              onBack={goBack}
            />
          ) : null}

          <div key={step} className="p-4 md:p-6 fade-left">
            {/* HOME */}
            {step === 0 ? (
              <div className="pb-2">
                <div className="text-center">
                  <h2
                    className="font-[Nunito] text-[30px] md:text-[40px] font-extrabold"
                    style={{ color: TEXT_MAIN }}
                  >
                    How can we support you today?
                  </h2>
                  <p
                    className="mt-2 font-[Lora] text-[15.5px] md:text-[16.5px] leading-relaxed"
                    style={{ color: TEXT_MUTED }}
                  >
                    Tap one option to begin. You’re in control.
                  </p>
                </div>

                <div className="mt-6 rounded-2xl bg-white px-5 py-4 border border-black/5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div
                        className="font-[Nunito] font-extrabold text-[16.5px]"
                        style={{ color: TEXT_MAIN }}
                      >
                        Review (PH time)
                      </div>
                      <div
                        className="mt-1 font-[Lora] text-[15px]"
                        style={{ color: TEXT_MUTED }}
                      >
                        {reviewInfo.ok
                          ? "Reviewed within 24 hours (working hours)."
                          : "Queued when review is closed."}
                      </div>
                      <div
                        className="mt-2 font-[Lora] text-[14.5px]"
                        style={{ color: TEXT_SOFT }}
                      >
                        {reviewInfo.next}
                      </div>
                    </div>

                    <span
                      className="px-3 py-1 rounded-full text-[13px] font-[Nunito] font-extrabold"
                      style={{
                        backgroundColor: reviewInfo.ok
                          ? `${LOGIN_PRIMARY}66`
                          : "rgba(0,0,0,0.06)",
                        color: TEXT_MAIN,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {reviewInfo.ok ? "Open" : "Closed"}
                    </span>
                  </div>

                  <div
                    className="mt-3 grid gap-1 text-[14px] font-[Lora]"
                    style={{ color: TEXT_SOFT }}
                  >
                    <div>• No service on holidays</div>
                    <div>• No service on weekends</div>
                    <div>• Outside 8:00 AM – 5:00 PM: queued</div>
                    <div>• 1-hour slots • 12:00 PM lunch break</div>
                  </div>
                </div>

                {pendingLocked ? (
                  <div className="mt-6 rounded-2xl bg-white px-5 py-4 border border-black/5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div
                          className="font-[Nunito] font-extrabold text-[16.5px]"
                          style={{ color: TEXT_MAIN }}
                        >
                          You already have a pending request
                        </div>
                        <div
                          className="mt-1 font-[Lora] text-[15px]"
                          style={{ color: TEXT_MUTED }}
                        >
                          Please cancel it first before booking a new session.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(6)}
                        className={miniBtn}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <BigChoiceCard
                    accent={LOGIN_PRIMARY}
                    title="Ask a Question"
                    subtitle="Chat with a counselor (opens messages)"
                    icon={<QuestionIcon accent={LOGIN_PRIMARY} />}
                    disabled={!termsAccepted}
                    onClick={() => requireTermsOr(openMessagesFlow)}
                  />

                  <BigChoiceCard
                    accent={LOGIN_PRIMARY}
                    title="Book a Session"
                    subtitle={
                      pendingLocked
                        ? "Disabled while a request is pending"
                        : "Duolingo-style step-by-step booking"
                    }
                    icon={<CalendarIcon accent={LOGIN_PRIMARY} />}
                    disabled={!termsAccepted || pendingLocked}
                    onClick={() =>
                      requireTermsOr(() => {
                        if (pendingLocked) {
                          setMeetSuccess(
                            "You already have a pending request. Cancel it first before booking a new one.",
                          );
                          setStep(6);
                          return;
                        }
                        setStep(1);
                      })
                    }
                  />
                </div>

                <div className="mt-6 rounded-2xl bg-white px-5 py-4 border border-black/5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div
                        className="font-[Nunito] font-extrabold text-[16.5px]"
                        style={{ color: TEXT_MAIN }}
                      >
                        Terms
                      </div>
                      <div
                        className="mt-1 font-[Lora] text-[15px]"
                        style={{ color: TEXT_MUTED }}
                      >
                        Required before continuing.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className={miniBtn}
                    >
                      View
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <OutlinedToggle
                      accent={LOGIN_PRIMARY}
                      checked={termsAccepted}
                      onChange={(v) => setTermsAccepted(v)}
                    />
                    <div
                      className="text-[15.5px] font-[Nunito] font-extrabold"
                      style={{ color: TEXT_MAIN }}
                    >
                      I accept the Terms
                    </div>
                  </div>

                  {!termsAccepted ? (
                    <div
                      className="mt-2 text-[13.5px] font-[Lora]"
                      style={{ color: TEXT_SOFT }}
                    >
                      Turn this on to open Ask / Book.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* STEP 1 */}
            {step === 1 ? (
              <LessonCard
                title="How would you like to meet?"
                subtitle="Pick one. You can change later."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectCard
                    active={meet.sessionType === "Online"}
                    title="Online"
                    subtitle="Link via email"
                    accent={LOGIN_PRIMARY}
                    onClick={() => {
                      clearMeetFeedback();
                      setMeet((p) => ({ ...p, sessionType: "Online" }));
                    }}
                  />
                  <SelectCard
                    active={meet.sessionType === "In-person"}
                    title="In-person"
                    subtitle="On campus"
                    accent={LOGIN_PRIMARY}
                    onClick={() => {
                      clearMeetFeedback();
                      setMeet((p) => ({ ...p, sessionType: "In-person" }));
                    }}
                  />
                </div>

                <BottomNav
                  accent={LOGIN_PRIMARY}
                  leftLabel="Back"
                  rightLabel="Continue"
                  onLeft={goBack}
                  onRight={goNext}
                  rightDisabled={!canContinue || pendingLocked}
                />
              </LessonCard>
            ) : null}

            {/* STEP 2 */}
            {step === 2 ? (
              <LessonCard
                title="What’s this about?"
                subtitle="Choose one reason."
              >
                <ChipGrid
                  items={REASONS}
                  value={meet.reason}
                  onChange={(v) => {
                    clearMeetFeedback();
                    setMeet((p) => ({ ...p, reason: v }));
                  }}
                  accent={LOGIN_PRIMARY}
                />

                <BottomNav
                  accent={LOGIN_PRIMARY}
                  leftLabel="Back"
                  rightLabel="Continue"
                  onLeft={goBack}
                  onRight={goNext}
                  rightDisabled={!canContinue || pendingLocked}
                />
              </LessonCard>
            ) : null}

            {/* STEP 3 */}
            {step === 3 ? (
              <LessonCard
                title="Pick a date"
                subtitle="Weekdays only. Holidays are blocked."
              >
                <div className="rounded-2xl bg-white p-4 border border-black/5">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="font-[Nunito] font-extrabold text-[16px]"
                      style={{ color: TEXT_MAIN }}
                    >
                      Date
                    </div>
                    <DayChip
                      ok={dayState.ok}
                      label={dayState.label}
                      accent={LOGIN_PRIMARY}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-start">
                    <input
                      type="date"
                      className={inputClass}
                      min={safeMinDateISO()}
                      value={meet.date}
                      onChange={(e) => onDateChange(e.target.value)}
                    />

                    <div
                      className="text-[14.5px] font-[Lora] leading-relaxed"
                      style={{ color: TEXT_MUTED }}
                    >
                      <div>• No weekends</div>
                      <div>• No holidays</div>
                      <div>• 8:00 AM – 5:00 PM</div>
                      <div>• 1-hour slots (12:00 PM lunch break)</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={[pillBtn, tapClass].join(" ")}
                      onClick={() => {
                        clearMeetFeedback();
                        const next = findNextWorkingDay(safeMinDateISO());
                        onDateChange(next);
                      }}
                    >
                      Next available date
                    </button>

                    {meet.date ? (
                      <div
                        className="text-[13.5px] font-[Lora]"
                        style={{ color: TEXT_SOFT }}
                      >
                        Selected:{" "}
                        <span style={{ color: TEXT_MAIN, fontWeight: 700 }}>
                          {isoToNice(meet.date)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <BottomNav
                  accent={LOGIN_PRIMARY}
                  leftLabel="Back"
                  rightLabel="Continue"
                  onLeft={goBack}
                  onRight={goNext}
                  rightDisabled={!canContinue || pendingLocked}
                />
              </LessonCard>
            ) : null}

            {/* STEP 4 */}
            {step === 4 ? (
              <LessonCard
                title="Pick a time"
                subtitle="Tap a time slot to continue."
              >
                <div className="rounded-2xl bg-white p-4 border border-black/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div
                        className="font-[Nunito] font-extrabold text-[16px]"
                        style={{ color: TEXT_MAIN }}
                      >
                        Counselors (optional)
                      </div>
                      <div
                        className="text-[14px] font-[Lora] mt-1"
                        style={{ color: TEXT_SOFT }}
                      >
                        Choose one to filter times, or leave as “Any counselor”.
                      </div>
                    </div>

                    <button
                      type="button"
                      className={[pillBtn, tapClass].join(" ")}
                      onClick={() => {
                        clearMeetFeedback();
                        setMeet((p) => ({ ...p, counselorId: "", time: "" }));
                      }}
                    >
                      Any counselor
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {counselorsComputed.map((c) => {
                      const disabled =
                        !meet.date ||
                        !dayState.ok ||
                        c._status === "On Leave" ||
                        c._status === "Fully Booked";
                      const active = meet.counselorId === c.id;

                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            clearMeetFeedback();
                            setMeet((p) => ({
                              ...p,
                              counselorId: active ? "" : c.id,
                              time: "",
                            }));
                          }}
                          className={[
                            "w-full text-left rounded-2xl px-4 py-3 transition border",
                            "bg-white hover:bg-[#FBFBFC]",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            active ? "border-black/15" : "border-black/5",
                            tapClass,
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div
                                className="font-[Nunito] font-extrabold text-[15.5px]"
                                style={{ color: TEXT_MAIN }}
                              >
                                {c.name}
                              </div>
                              <div
                                className="text-[13.5px] font-[Lora]"
                                style={{ color: TEXT_MUTED }}
                              >
                                ID: {c.id}
                              </div>
                              {meet.date && dayState.ok ? (
                                <div
                                  className="text-[13px] font-[Lora] mt-1"
                                  style={{ color: TEXT_SOFT }}
                                >
                                  Open: {Math.max(0, c._openCount)}
                                </div>
                              ) : null}
                            </div>
                            <StatusPill
                              status={c._status}
                              accent={LOGIN_PRIMARY}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white p-4 border border-black/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div
                        className="font-[Nunito] font-extrabold text-[16px]"
                        style={{ color: TEXT_MAIN }}
                      >
                        Time slots
                      </div>
                      <div
                        className="text-[14px] font-[Lora] mt-1"
                        style={{ color: TEXT_MUTED }}
                      >
                        {meet.counselorId
                          ? "Filtered by selected counselor."
                          : "Showing any available counselor."}
                      </div>
                    </div>

                    <div
                      className="text-[13.5px] font-[Nunito] font-extrabold"
                      style={{ color: TEXT_SOFT }}
                    >
                      {meet.date ? isoToNice(meet.date) : "Select date first"}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {SCHOOL_SLOTS.map((t) => {
                      const slot = slotAvailability[t];
                      const enabled = !!slot?.enabled;
                      const active = meet.time === t;

                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={!enabled}
                          onClick={() => {
                            clearMeetFeedback();
                            setMeet((p) => ({ ...p, time: t }));
                          }}
                          title={
                            !enabled
                              ? slot?.reason || "Not available"
                              : "Available"
                          }
                          className={[
                            "h-10 rounded-xl text-[14px] font-[Nunito] font-extrabold transition border",
                            enabled
                              ? "bg-white hover:bg-[#FBFBFC] border-black/5"
                              : "bg-black/5 border-black/0 opacity-40 cursor-not-allowed",
                            tapClass,
                          ].join(" ")}
                          style={
                            active
                              ? {
                                  backgroundColor: LOGIN_PRIMARY,
                                  color: TEXT_MAIN,
                                  borderColor: "rgba(0,0,0,0.10)",
                                }
                              : { color: TEXT_MAIN }
                          }
                        >
                          {formatTime12(t)}
                        </button>
                      );
                    })}
                  </div>

                  {meet.time ? (
                    <div
                      className="mt-3 text-[14px] font-[Lora]"
                      style={{ color: TEXT_SOFT }}
                    >
                      Selected time:{" "}
                      <span style={{ color: TEXT_MAIN, fontWeight: 700 }}>
                        {formatTime12(meet.time)}
                      </span>
                    </div>
                  ) : null}
                </div>

                <BottomNav
                  accent={LOGIN_PRIMARY}
                  leftLabel="Back"
                  rightLabel="Continue"
                  onLeft={goBack}
                  onRight={goNext}
                  rightDisabled={!canContinue || pendingLocked}
                />
              </LessonCard>
            ) : null}

            {/* STEP 5 */}
            {step === 5 ? (
              <LessonCard
                title="Confirm your request"
                subtitle="Optional notes help counselors prepare."
              >
                <div className="rounded-2xl bg-white p-4 border border-black/5">
                  <div
                    className="font-[Nunito] font-extrabold text-[16px]"
                    style={{ color: TEXT_MAIN }}
                  >
                    Your selection
                  </div>
                  <div
                    className="mt-2 font-[Lora] text-[15px]"
                    style={{ color: TEXT_MUTED }}
                  >
                    {meetSummary}
                  </div>

                  <div className="mt-4">
                    <label
                      className="block mb-2 font-[Nunito] font-extrabold text-[16px]"
                      style={{ color: TEXT_MAIN }}
                    >
                      Notes (optional)
                    </label>
                    <textarea
                      rows={5}
                      className={textareaClass}
                      value={meet.notes}
                      onChange={(e) => {
                        clearMeetFeedback();
                        setMeet((p) => ({ ...p, notes: e.target.value }));
                      }}
                      placeholder="Add details…"
                    />
                  </div>

                  <div
                    className="mt-4 rounded-2xl p-4"
                    style={{ backgroundColor: `${LOGIN_PRIMARY}22` }}
                  >
                    <div
                      className="font-[Nunito] font-extrabold text-[15px]"
                      style={{ color: TEXT_MAIN }}
                    >
                      Ready?
                    </div>
                    <div
                      className="mt-1 font-[Lora] text-[14.5px]"
                      style={{ color: TEXT_MUTED }}
                    >
                      Tap “Send request” and we’ll confirm once approved.
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    className={[ghostBtn, tapClass].join(" ")}
                  >
                    ← Back
                  </button>

                  <button
                    type="button"
                    onClick={submitMeet}
                    disabled={pendingLocked}
                    className={[
                      primaryBtn,
                      tapClass,
                      pendingLocked ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                    style={{ backgroundColor: LOGIN_PRIMARY }}
                  >
                    Send request
                  </button>
                </div>

                <div
                  className="mt-3 text-[12.5px] font-[Lora] text-right"
                  style={{ color: TEXT_SOFT }}
                >
                  You’ll receive a confirmation once approved.
                </div>
              </LessonCard>
            ) : null}

            {/* SUCCESS */}
            {step === 6 ? (
              <div className="py-4">
                <div className="rounded-[26px] bg-white p-6 border border-black/5 relative overflow-hidden">
                  <div
                    className="absolute -top-10 -right-10 h-40 w-40 rounded-full"
                    style={{ backgroundColor: `${LOGIN_PRIMARY}55` }}
                  />
                  <div
                    className="absolute -bottom-16 -left-16 h-44 w-44 rounded-full"
                    style={{ backgroundColor: "rgba(0,0,0,0.04)" }}
                  />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div
                          className="font-[Nunito] text-[28px] md:text-[34px] font-extrabold"
                          style={{ color: TEXT_MAIN }}
                        >
                          {displayReq?.status === "Canceled"
                            ? "Request canceled ✅"
                            : "Request sent "}
                        </div>
                        <div
                          className="mt-2 font-[Lora] text-[15.5px]"
                          style={{ color: TEXT_MUTED }}
                        >
                          {meetSuccess ||
                            "You’ll receive a confirmation once approved."}
                        </div>
                      </div>
                      <div className="hidden md:block">
                        <Badge text="Nice work!" accent={LOGIN_PRIMARY} />
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl p-4 border border-black/10 bg-white">
                      <div
                        className="font-[Nunito] font-extrabold text-[16px]"
                        style={{ color: TEXT_MAIN }}
                      >
                        Summary
                      </div>

                      <div
                        className="mt-2 font-[Lora] text-[15px]"
                        style={{ color: TEXT_MUTED }}
                      >
                        {displayReq?.sessionType || meet.sessionType || "—"} •{" "}
                        {displayReq?.reason || meet.reason || "—"} •{" "}
                        {displayReq?.date
                          ? isoToNice(displayReq.date)
                          : meet.date
                            ? isoToNice(meet.date)
                            : "—"}{" "}
                        •{" "}
                        {displayReq?.time || meet.time
                          ? formatTime12(displayReq?.time || meet.time)
                          : "—"}
                      </div>

                      {displayReq?.counselorName ? (
                        <div
                          className="mt-2 text-[14px] font-[Lora]"
                          style={{ color: TEXT_SOFT }}
                        >
                          Counselor: {displayReq.counselorName} (
                          {displayReq.counselorId})
                        </div>
                      ) : null}

                      {displayReq?.status ? (
                        <div
                          className="mt-2 text-[14px] font-[Lora]"
                          style={{ color: TEXT_SOFT }}
                        >
                          Status:{" "}
                          <span style={{ color: TEXT_MAIN, fontWeight: 700 }}>
                            {displayReq.status}
                          </span>
                        </div>
                      ) : null}

                      {displayReq?.notes?.trim() || meet.notes?.trim() ? (
                        <div
                          className="mt-2 text-[14px] font-[Lora]"
                          style={{ color: TEXT_SOFT }}
                        >
                          Notes: {displayReq?.notes || meet.notes}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={openMessagesFlow}
                          className={[primaryBtn, tapClass].join(" ")}
                          style={{ backgroundColor: LOGIN_PRIMARY }}
                        >
                          Message counselor
                        </button>

                        <button
                          type="button"
                          disabled={
                            !currentRequest ||
                            currentRequest.status !== "Pending"
                          }
                          onClick={() => setShowCancelConfirm(true)}
                          className={[
                            ghostBtn,
                            tapClass,
                            !currentRequest ||
                            currentRequest.status !== "Pending"
                              ? "opacity-60 cursor-not-allowed"
                              : "",
                          ].join(" ")}
                        >
                          Cancel request
                        </button>

                        <button
                          type="button"
                          onClick={() => setStep(0)}
                          className={[ghostBtn, tapClass].join(" ")}
                        >
                          Return home
                        </button>
                      </div>
                    </div>

                    <div
                      className="mt-3 text-[12.5px] font-[Lora]"
                      style={{ color: TEXT_SOFT }}
                    >
                      For emergencies, use the hotline.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {step >= 1 && step <= 5 && meetError ? (
              <div
                className="mt-4 rounded-2xl bg-white px-4 py-3 text-[14.5px] font-[Lora] border border-black/5"
                style={{ color: ERROR_TEXT }}
              >
                {meetError}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== CLASSES ===================== */
const inputClass =
  "w-full h-12 px-4 rounded-xl bg-white hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-black/10 font-[Nunito] text-[15.5px] text-[#141414] border border-black/5";
const textareaClass =
  "w-full px-4 py-3 rounded-xl bg-white hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-black/10 font-[Nunito] text-[15.5px] text-[#141414] resize-none border border-black/5";

const primaryBtn =
  "h-12 px-7 rounded-xl hover:brightness-95 transition font-[Nunito] text-[15.5px] font-extrabold text-[#141414]";
const ghostBtn =
  "h-12 px-6 rounded-xl bg-white hover:bg-[#FBFBFC] transition font-[Nunito] text-[15.5px] font-bold text-[#141414] border border-black/5";

const miniBtn =
  "h-9 px-4 rounded-xl bg-white hover:bg-[#FBFBFC] transition font-[Nunito] text-[14px] font-extrabold text-[#141414] border border-black/5";

const pillBtn =
  "h-10 px-4 rounded-full bg-white hover:bg-[#FBFBFC] transition font-[Nunito] text-[13.5px] font-extrabold text-[#141414] border border-black/5";

/* ===================== UI COMPONENTS ===================== */
function ProgressHeader({ title, subtitle, progress, accent, onBack }) {
  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-left w-full">
          <div
            className="font-[Nunito] font-extrabold text-[14px]"
            style={{ color: TEXT_MAIN }}
          >
            {title}
          </div>
          <div className="font-[Lora] text-[13px]" style={{ color: TEXT_SOFT }}>
            {subtitle}
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 rounded-full bg-white/80 hover:bg-white transition flex items-center justify-center"
          aria-label="Back"
        >
          <span style={{ color: TEXT_MAIN, fontSize: 18 }}>←</span>
        </button>
      </div>

      <div className="mt-3 h-3 rounded-full bg-black/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${progress}%`, backgroundColor: accent }}
        />
      </div>
    </div>
  );
}

function LessonCard({ title, subtitle, children }) {
  return (
    <div className="mt-1">
      <div className="text-center px-2">
        <h2
          className="font-[Nunito] text-[26px] md:text-[34px] font-extrabold"
          style={{ color: TEXT_MAIN }}
        >
          {title}
        </h2>
        <p
          className="mt-2 font-[Lora] text-[15px] md:text-[16px] leading-relaxed"
          style={{ color: TEXT_MUTED }}
        >
          {subtitle}
        </p>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function BottomNav({
  leftLabel,
  rightLabel,
  onLeft,
  onRight,
  rightDisabled,
  accent,
}) {
  const tapClass = "active:scale-[0.98] transition-transform";
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onLeft}
        className={[ghostBtn, tapClass].join(" ")}
      >
        ← {leftLabel}
      </button>

      <button
        type="button"
        onClick={onRight}
        disabled={rightDisabled}
        className={[
          primaryBtn,
          tapClass,
          rightDisabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:brightness-95",
        ].join(" ")}
        style={{ backgroundColor: accent }}
      >
        {rightLabel} →
      </button>
    </div>
  );
}

function BigChoiceCard({ title, subtitle, icon, accent, onClick, disabled }) {
  const tapClass = "active:scale-[0.985] transition-transform";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full text-left rounded-[22px] p-5 bg-white border border-black/5 shadow-[0_10px_30px_rgba(0,0,0,0.06)]",
        "hover:shadow-[0_14px_40px_rgba(0,0,0,0.08)]",
        disabled ? "opacity-55 cursor-not-allowed" : "",
        tapClass,
      ].join(" ")}
      title={
        disabled ? "Accept Terms / resolve pending request to continue" : ""
      }
    >
      <div className="flex items-start gap-4">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}33` }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div
            className="font-[Nunito] text-[18px] md:text-[19px] font-extrabold"
            style={{ color: TEXT_MAIN }}
          >
            {title}
          </div>
          <div
            className="mt-1 font-[Lora] text-[15px] leading-relaxed"
            style={{ color: TEXT_MUTED }}
          >
            {subtitle}
          </div>
        </div>
        <div className="ml-auto" style={{ color: TEXT_SOFT }}>
          <ArrowRightIcon />
        </div>
      </div>
    </button>
  );
}

function SelectCard({ active, title, subtitle, onClick, accent }) {
  const tapClass = "active:scale-[0.985] transition-transform";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl p-4 text-left border bg-white hover:bg-[#FBFBFC] transition",
        active ? "border-black/15" : "border-black/5",
        tapClass,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className="font-[Nunito] font-extrabold text-[16px]"
            style={{ color: TEXT_MAIN }}
          >
            {title}
          </div>
          <div
            className="font-[Lora] text-[13.5px]"
            style={{ color: TEXT_MUTED }}
          >
            {subtitle}
          </div>
        </div>

        <span
          className="h-6 w-6 rounded-full border flex items-center justify-center"
          style={{
            borderColor: active ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.10)",
          }}
        >
          {active ? (
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: accent }}
            />
          ) : null}
        </span>
      </div>
    </button>
  );
}

function ChipGrid({ items, value, onChange, accent }) {
  const tapClass = "active:scale-[0.985] transition-transform";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((it) => {
        const active = value === it;
        return (
          <button
            key={it}
            type="button"
            onClick={() => onChange(it)}
            className={[
              "rounded-2xl px-4 py-3 text-left border transition",
              active
                ? "bg-white border-black/15"
                : "bg-white hover:bg-[#FBFBFC] border-black/5",
              tapClass,
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3">
              <div
                className="font-[Nunito] font-extrabold text-[15.5px]"
                style={{ color: TEXT_MAIN }}
              >
                {it}
              </div>
              {active ? (
                <span
                  className="px-3 py-1 rounded-full text-[12px] font-[Nunito] font-extrabold"
                  style={{ backgroundColor: `${accent}66`, color: TEXT_MAIN }}
                >
                  Selected
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Badge({ text, accent }) {
  return (
    <span
      className="px-4 py-2 rounded-full text-[13px] font-[Nunito] font-extrabold"
      style={{ backgroundColor: `${accent}66`, color: TEXT_MAIN }}
    >
      {text}
    </span>
  );
}

function DayChip({ ok, label, accent }) {
  const bg = ok ? `${accent}55` : "rgba(0,0,0,0.05)";
  const color = ok ? TEXT_MAIN : "rgba(20,20,20,0.78)";
  return (
    <span
      className="px-3 py-1 rounded-full text-[13.5px] font-[Nunito] font-extrabold"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  );
}

function StatusPill({ status, accent }) {
  const bg = status === "Available" ? `${accent}55` : "rgba(0,0,0,0.05)";
  const color = status === "Available" ? TEXT_MAIN : "rgba(20,20,20,0.75)";
  return (
    <span
      className="px-3 py-1 rounded-full text-[13px] font-[Nunito] font-extrabold"
      style={{ backgroundColor: bg, color }}
    >
      {status}
    </span>
  );
}

function OutlinedToggle({ checked, onChange, accent }) {
  const offBg = "rgba(255,255,255,0.95)";
  const offBorder = "rgba(20,20,20,0.28)";

  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-12 h-7 rounded-full transition flex items-center"
      style={{
        backgroundColor: checked ? accent : offBg,
        border: `1.5px solid ${checked ? "rgba(0,0,0,0.10)" : offBorder}`,
      }}
      aria-pressed={checked}
    >
      <span
        className="h-5 w-5 rounded-full shadow-sm transition"
        style={{
          backgroundColor: "#fff",
          transform: checked ? "translateX(22px)" : "translateX(2px)",
        }}
      />
    </button>
  );
}

/* ===================== TERMS MODAL ===================== */
function TermsModal({ accent, onAccept, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl rounded-[22px] bg-white shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-5 border-b border-black/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div
                className="font-[Nunito] text-[22px] md:text-[24px] font-extrabold"
                style={{ color: TEXT_MAIN }}
              >
                Terms & Data Collection
              </div>
              <div
                className="mt-1 font-[Lora] text-[14.5px] md:text-[15px]"
                style={{ color: TEXT_MUTED }}
              >
                Please read before continuing.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-full bg-black/5 hover:bg-black/10 transition flex items-center justify-center"
              aria-label="Close"
            >
              <span
                className="text-2xl leading-none"
                style={{ color: TEXT_MAIN }}
              >
                ×
              </span>
            </button>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-auto">
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: `${accent}22` }}
          >
            <div
              className="font-[Nunito] font-extrabold text-[16px]"
              style={{ color: TEXT_MAIN }}
            >
              What we collect
            </div>
            <div
              className="mt-2 grid gap-2 text-[15px] font-[Lora]"
              style={{ color: TEXT_MUTED }}
            >
              <div>• Message content you submit (chat messages, notes)</div>
              <div>
                • Scheduling details (date, time, session type, selected
                counselor)
              </div>
              <div>
                • Account identifiers (if not anonymous): name, email, student
                number
              </div>
              <div>• Basic technical logs for security (e.g., timestamps)</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl p-4 border border-black/10">
            <div
              className="font-[Nunito] font-extrabold text-[16px]"
              style={{ color: TEXT_MAIN }}
            >
              Why we collect it
            </div>
            <div
              className="mt-2 grid gap-2 text-[15px] font-[Lora]"
              style={{ color: TEXT_MUTED }}
            >
              <div>• To route your concern to authorized counselors</div>
              <div>• To schedule and manage appointments</div>
              <div>• To maintain safety, prevent misuse, and audit access</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl p-4 border border-black/10">
            <div
              className="font-[Nunito] font-extrabold text-[16px]"
              style={{ color: TEXT_MAIN }}
            >
              Who can access it
            </div>
            <div
              className="mt-2 grid gap-2 text-[15px] font-[Lora]"
              style={{ color: TEXT_MUTED }}
            >
              <div>• Authorized guidance counselors and system admins</div>
              <div>• Access is limited to student-support purposes only</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl p-4 border border-black/10">
            <div
              className="font-[Nunito] font-extrabold text-[16px]"
              style={{ color: TEXT_MAIN }}
            >
              Important notes
            </div>
            <div
              className="mt-2 grid gap-2 text-[15px] font-[Lora]"
              style={{ color: TEXT_MUTED }}
            >
              <div>• Not an emergency service</div>
              <div>
                • For emergencies, use the hotline or local emergency services
              </div>
              <div>
                • Reviewed only on working days, 8:00 AM – 5:00 PM (PH time)
              </div>
            </div>
          </div>

          <div
            className="mt-4 text-[13.5px] font-[Lora]"
            style={{ color: TEXT_SOFT }}
          >
            By tapping “Accept”, you agree to these terms and allow processing
            of your submitted information for counseling support.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-black/10 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <button
            type="button"
            onClick={onAccept}
            className="h-11 px-7 rounded-xl hover:brightness-95 transition font-[Nunito] text-[15.5px] font-extrabold text-[#141414]"
            style={{ backgroundColor: accent }}
          >
            Accept
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-11 px-6 rounded-xl bg-black/5 hover:bg-black/10 transition font-[Nunito] font-extrabold text-[#141414]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== CANCEL CONFIRM MODAL ===================== */
function ConfirmCancelModal({ accent, onClose, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-[18px] bg-white shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 py-4 border-b border-black/10">
          <div
            className="font-[Nunito] text-[18px] font-extrabold"
            style={{ color: TEXT_MAIN }}
          >
            Cancel this request?
          </div>
          <div
            className="mt-1 font-[Lora] text-[14px]"
            style={{ color: TEXT_MUTED }}
          >
            This will mark your request as canceled.
          </div>
        </div>

        <div className="px-5 py-4 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-black/5 hover:bg-black/10 transition font-[Nunito] font-extrabold text-[#141414]"
          >
            Keep
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="h-10 px-4 rounded-xl hover:brightness-95 transition font-[Nunito] font-extrabold text-[#141414]"
            style={{ backgroundColor: accent }}
          >
            Yes, cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== ICONS ===================== */
function QuestionIcon({ accent }) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" fill={accent} opacity="0.9" />
      <path
        d="M20.5 19.2c.4-2.3 2.2-3.9 4.9-3.9 2.8 0 5 1.7 5 4.4 0 2.4-1.5 3.6-3.3 4.6-1.4.8-1.8 1.3-1.8 2.7v.6"
        stroke={TEXT_MAIN}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="23.9" cy="34.2" r="1.6" fill={TEXT_MAIN} />
    </svg>
  );
}

function CalendarIcon({ accent }) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="10"
        y="14"
        width="28"
        height="24"
        rx="6"
        fill="#fff"
        stroke={TEXT_MAIN}
        strokeWidth="1.6"
      />
      <rect
        x="10"
        y="14"
        width="28"
        height="7"
        rx="6"
        fill={accent}
        opacity="0.9"
      />
      <path
        d="M16 12v6M32 12v6"
        stroke={TEXT_MAIN}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 26h6M26 26h6M16 32h6M26 32h6"
        stroke={TEXT_MAIN}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 7l5 5-5 5"
        stroke={TEXT_MAIN}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}
// ...
