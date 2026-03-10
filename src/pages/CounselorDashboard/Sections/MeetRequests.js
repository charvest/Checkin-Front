// src/pages/CounselorDashboard/Sections/MeetRequests.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../../../api/apiFetch";

/* ===================== STORAGE ===================== */
const STORAGE_KEY = "student_dashboard:meet_requests:v2";
const SETTINGS_KEY = "student_dashboard:account_settings:v1";

const CALENDAR_SELECTED_DATE_KEY = "counselor_dashboard:calendar_selected_date:v1";
const MEET_REQUESTS_UPDATED_EVENT = "counselor_dashboard:meet_requests_updated";

function isISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function syncCalendarSelectedDate(dateISO) {
  if (!isBrowser()) return;
  if (!isISODate(dateISO)) return;
  lsSet(CALENDAR_SELECTED_DATE_KEY, dateISO);
}

function dispatchMeetRequestsUpdated() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(MEET_REQUESTS_UPDATED_EVENT));
}

function safeJSONParse(v, fallback) {
  try {
    return JSON.parse(v) ?? fallback;
  } catch {
    return fallback;
  }
}

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function lsGet(key, fallback) {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw != null ? safeJSONParse(raw, fallback) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/* ===================== OPTIONS ===================== */
const COURSE_OPTIONS = [
  "Bachelor of Science in Nursing",
  "Bachelor of Elementary Education (SPED)",
  "Bachelor of Physical Education",
  "Bachelor of Secondary Education",
  "Bachelor of Science in Business Administration (BSBA)",
  "Bachelor of Science in Accounting Information System",
  "Bachelor of Science in Information Technology",
  "Bachelor of Science in Computer Science",
  "Bachelor of Science in Hospitality Management (BSHM)",
  "Bachelor of Science in Tourism Management (BSTM)",
  "Bachelor of Science in Criminology",
  "Bachelor of Arts in English Language",
  "Bachelor of Arts in Psychology",
  "Bachelor of Arts in Political Science",
];

const REASON_OPTIONS = [
  "Academic Stress",
  "Depression",
  "Self-esteem",
  "Other",
  "Anxiety/Overthinking",
  "Family/Relationship",
  "Grief/Loss",
];

const STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DISAPPROVED: "Disapproved",
  CANCELED: "Canceled",
  RESCHEDULED: "Rescheduled",
};

const SORT = {
  NEWEST: "Newest",
  OLDEST: "Oldest",
  DATE_ASC: "Date (Soonest)",
  DATE_DESC: "Date (Latest)",
};

const MODES = ["Online", "In-person"];
const SAMPLE_TIMES = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"];

/* ===================== OFFICE LOCATIONS ===================== */
const OFFICE_LOCATIONS = {
  "Main Campus": "Guidance Office, Admin Building (2nd Floor)",
  "Annex Campus": "Guidance Office, Annex Building (1st Floor)",
};

// ✅ App is single-campus (static UI label)
const STATIC_CAMPUS_LABEL = "Arellano University Andres Bonifacio Campus";

function getOfficeMeta(counselorCampus, studentCampus) {
  const campus = String(counselorCampus || studentCampus || "Main Campus");
  const office = OFFICE_LOCATIONS[campus] || "Guidance Office";
  return { campus, office };
}

const BASE_COUNSELORS = [
  { counselorId: "C-001", name: "Counselor A", campus: "Main Campus", courses: COURSE_OPTIONS[6] },
  { counselorId: "C-002", name: "Counselor B", campus: "Main Campus", courses: COURSE_OPTIONS[7] },
];

/* ===================== HELPERS ===================== */
function coerceArray(v) {
  return Array.isArray(v) ? v : [];
}

function getCounselorDirectoryFromSettings(settings, baseCounselors) {
  const base = coerceArray(baseCounselors);
  if (!settings || typeof settings !== "object") return base;

  const rawList = [...coerceArray(settings.counselors), ...coerceArray(settings.counselorDirectory), ...coerceArray(settings.counselorList)];
  const byId = new Map(base.map((c) => [c.counselorId, { ...c }]));

  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const id = item.counselorId || item.id;
    if (!id) continue;
    const prev = byId.get(id) || { counselorId: id };
    byId.set(id, { ...prev, ...item, counselorId: id, name: item.name ?? prev.name });
  }

  if (settings.counselorNameMap && typeof settings.counselorNameMap === "object") {
    for (const [id, name] of Object.entries(settings.counselorNameMap)) {
      if (!id) continue;
      const prev = byId.get(id) || { counselorId: id };
      byId.set(id, { ...prev, counselorId: id, name: String(name || prev.name || "") });
    }
  }

  return Array.from(byId.values());
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ✅ Normalize backend timestamps (ISO strings like 2026-02-26T03:06:33.725Z)
// into a readable local format: "Feb 26, 2026 • 03:06 AM"
function formatBackendDateTime(value) {
  if (!value) return "—";

  // If it's already a nice string (e.g., "2026-02-26 03:06 AM"), keep it.
  const raw = String(value).trim();
  if (!raw) return "—";
  if (/\b(AM|PM)\b/i.test(raw) && raw.includes("-") && raw.includes(":")) {
    return raw.replace(/\b(am|pm)\b/gi, (x) => x.toUpperCase());
  }

  // Try parsing ISO / RFC / epoch
  let d = null;
  if (typeof value === "number") {
    d = new Date(value);
  } else {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  if (!d || Number.isNaN(d.getTime())) return raw; // fallback to original

  const datePart = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);

  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);

  return `${datePart} • ${timePart}`;
}

function parseDateKey(dateStr) {
  const s = String(dateStr || "").trim();
  if (!s) return 0;
  const [y, m, d] = s.split("-").map((x) => Number(x));
  if (!y || !m || !d) return 0;
  const t = Date.UTC(y, m - 1, d);
  return Number.isFinite(t) ? t : 0;
}

function compareCreatedAt(a, b) {
  const A = String(a.createdAt || "");
  const B = String(b.createdAt || "");
  return A < B ? -1 : A > B ? 1 : 0;
}

function clampPage(page, totalPages) {
  if (totalPages <= 1) return 1;
  return Math.min(Math.max(1, page), totalPages);
}

async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // ignore
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function normalizeCounselor(counselor, counselorDirectory) {
  const id = counselor?.counselorId || counselor?.id || "";
  if (!id) return counselor || null;
  const match = counselorDirectory.find((c) => c.counselorId === id);
  if (!match) return counselor || null;
  return {
    counselorId: match.counselorId,
    name: match.name || counselor?.name || "Counselor",
    campus: match.campus || counselor?.campus || "—",
    courses: match.courses || counselor?.courses || "—",
  };
}

/* ===================== REAL NAME NORMALIZATION ===================== */
const FIRST_NAMES = [
  "Andrea",
  "Bianca",
  "Carlo",
  "Daniel",
  "Elijah",
  "Faith",
  "Gabriel",
  "Hannah",
  "Ivan",
  "Jasmine",
  "Kyle",
  "Lianne",
  "Marco",
  "Nina",
  "Oscar",
  "Paolo",
  "Rafael",
  "Sofia",
  "Tristan",
  "Vanessa",
  "William",
  "Xandra",
  "Yasmin",
  "Zachary",
  "Alyssa",
  "Brandon",
  "Catherine",
  "Daryl",
  "Erika",
  "Frances",
  "Gianna",
  "Harold",
  "Isabel",
  "Joshua",
  "Katrina",
  "Lorenzo",
  "Mikaela",
  "Nathan",
  "Patricia",
  "Reinard",
  "Therese",
];

const LAST_NAMES = [
  "Santos",
  "Reyes",
  "Cruz",
  "Garcia",
  "Mendoza",
  "Torres",
  "Flores",
  "Ramos",
  "Gonzales",
  "Aquino",
  "Navarro",
  "Dela Cruz",
  "Castillo",
  "Villanueva",
  "Domingo",
  "Francisco",
  "Salazar",
  "Miranda",
  "Pascual",
  "Del Rosario",
  "Bautista",
  "Rivera",
  "Perez",
  "Valdez",
  "Aguilar",
  "Serrano",
  "Morales",
  "Fernandez",
  "Vargas",
  "Lopez",
];

function isPlaceholderName(name) {
  const s = String(name || "").trim();
  if (!s) return true;
  return /^student(\s+full\s+name)?\s+\d+$/i.test(s);
}

function stableHash(str) {
  const s = String(str || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function stableNameFromStudentId(studentId, fallbackSeed = 0) {
  const seed = stableHash(studentId || String(fallbackSeed));
  const fn = FIRST_NAMES[seed % FIRST_NAMES.length];
  const ln = LAST_NAMES[(seed * 7) % LAST_NAMES.length];
  return `${fn} ${ln}`;
}

function normalizeStudent(student, idx) {
  if (!student || typeof student !== "object") return student;
  const name = String(student.name || "").trim();
  if (!name || isPlaceholderName(name)) {
    const nextName = stableNameFromStudentId(student.studentId, idx);
    return { ...student, name: nextName };
  }
  return student;
}

function normalizeRequestsWithCounselors(list, counselorDirectory) {
  if (!Array.isArray(list)) return [];
  return list.map((r, idx) => ({
    ...r,
    counselor: normalizeCounselor(r.counselor, counselorDirectory),
    student: normalizeStudent(r.student, idx),
  }));
}


/* ===================== BACKEND BRIDGE ===================== */
function normalizeStatusFromApi(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s.includes("cancel")) return STATUS.CANCELED;
  if (s.includes("resched")) return STATUS.RESCHEDULED;
  if (s.includes("disapprove")) return STATUS.DISAPPROVED;
  if (s.includes("approve")) return STATUS.APPROVED;
  return STATUS.PENDING;
}

function time24To12(time24) {
  const m = String(time24 || "").trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return String(time24 || "").trim();
  let hh = Number(m[1]);
  const mm = m[2];
  const ap = hh >= 12 ? "PM" : "AM";
  let hh12 = hh % 12;
  if (hh12 === 0) hh12 = 12;
  return `${String(hh12).padStart(2, "0")}:${mm} ${ap}`;
}

function time12To24(time12) {
  const s = String(time12 || "").trim();
  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(s)) return s;

  const mins = parseTimeToMinutes(s);
  if (mins == null) return "";
  const hh = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function counselorNameFromDir(counselorId, counselorDirectory) {
  const id = String(counselorId || "").trim();
  if (!id) return "";
  const hit = Array.isArray(counselorDirectory)
    ? counselorDirectory.find((c) => String(c?.counselorId || "") === id)
    : null;
  return String(hit?.name || "").trim();
}

function normalizeApiMeetRequest(raw, counselorDirectory) {
  if (!raw) return null;

  const id = String(raw.id || raw._id || "").trim();
  if (!id) return null;

  const status = normalizeStatusFromApi(raw.status);

  const sessionType = String(raw.sessionType || "").trim();
  const mode = sessionType || String(raw.mode || "").trim() || "Online";

  const date = String(raw.date || "").trim();
  const time24 = String(raw.time || "").trim();
  const time = time24To12(time24);

  const user = raw.userId && typeof raw.userId === "object" ? raw.userId : null;
  const student = {
    name: String(user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "").trim(),
    email: String(user?.email || "").trim(),
    studentId: String(user?.studentNumber || "").trim(),
    courses: String(user?.course || "").trim(),
    campus: String(user?.campus || "").trim(),
  };

  const cObj = raw.counselorId && typeof raw.counselorId === "object" ? raw.counselorId : null;
  const counselorId = String(cObj?._id || raw.counselorId || "").trim();
  const counselor = {
    counselorId,
    name: String(cObj?.fullName || counselorNameFromDir(counselorId, counselorDirectory) || "").trim(),
    campus: String(cObj?.campus || "").trim(),
  };

  return {
    id,
    status,
    disapprovalReason: String(raw.disapprovalReason || "").trim(),
    date,
    time,
    mode,
    reason: String(raw.reason || "").trim(),
    notes: String(raw.notes || "").trim(),
    meetLink: String(raw.meetingLink || raw.meetLink || "").trim(),
    location: String(raw.location || "").trim(),
    createdAt: raw.createdAt || "",
    updatedAt: raw.updatedAt || "",
    student,
    counselor,
  };
}

/* ===================== TIME (2 HOURS RULE) ===================== */
function parseTimeToMinutes(timeStr) {
  const s = String(timeStr || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const ap = String(m[3]).toUpperCase();
  if (hh === 12) hh = 0;
  if (ap === "PM") hh += 12;
  return hh * 60 + mm;
}

function toSessionStartMs(dateStr, timeStr) {
  const [y, mo, d] = String(dateStr || "")
    .split("-")
    .map((x) => Number(x));
  const minutes = parseTimeToMinutes(timeStr);
  if (!y || !mo || !d || minutes == null) return null;
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return new Date(y, mo - 1, d, hh, mm, 0, 0).getTime();
}

function isTwoHoursBeforeSession(dateStr, timeStr) {
  const startMs = toSessionStartMs(dateStr, timeStr);
  if (!startMs) return true;
  return Date.now() <= startMs - 2 * 60 * 60 * 1000;
}

/* ===================== EMAIL (GMAIL COMPOSE) ===================== */
function buildRescheduleEmailContent({
  studentName,
  oldDate,
  oldTime,
  oldMode,
  newDate,
  newTime,
  newMode,
  counselorName,
  counselorCampus,
  studentCampus,
}) {
  const name = String(studentName || "").trim() || "Student";
  const subject = "Rescheduled Counseling Appointment";

  const { campus, office } = getOfficeMeta(counselorCampus, studentCampus);
  const isF2F = String(newMode || "").toLowerCase().includes("in-person");

  const lines = [
    `Hi ${name},`,
    "I hope you’re doing well.",
    "",
    "This is to confirm that your counseling appointment has been rescheduled.",
    "",
    "New appointment",
    `• Date: ${newDate}`,
    `• Time: ${newTime}`,
    `• Mode: ${isF2F ? "Face-to-Face (In-person)" : "Online"}`,
  ];

  if (isF2F) {
    lines.push(`• Campus: ${campus}`, `• Office: ${office}`, "• Please arrive 5–10 minutes early.");
  } else {
    lines.push("• Tip: Please ensure you have a stable internet connection.");
  }

  lines.push(
    "",
    "Previous appointment",
    `• Date: ${oldDate}`,
    `• Time: ${oldTime}`,
    `• Mode: ${String(oldMode || "").toLowerCase().includes("in-person") ? "Face-to-Face (In-person)" : oldMode}`,
    "",
    "If this schedule doesn’t work for you, please reply to this email so we can arrange another available time.",
    "",
    "Thank you,",
    counselorName ? `${counselorName}` : "Guidance Counselor",
    "Guidance & Counseling Office"
  );

  return { subject, body: lines.join("\n") };
}


function buildApprovalEmailContent({
  studentName,
  date,
  time,
  mode,
  meetLink,
  counselorName,
  counselorCampus,
  studentCampus,
  reason,
}) {
  const name = String(studentName || "").trim() || "Student";
  const subject = "Approved Counseling Appointment";

  const isF2F = String(mode || "").toLowerCase().includes("in-person");
  const lines = [
    `Hi ${name},`,
    "I hope you’re doing well.",
    "",
    "Your counseling appointment has been approved. Please see the details below:",
    "",
    "Appointment details",
    `• Date: ${date || "—"}`,
    `• Time: ${time || "—"}`,
    `• Mode: ${isF2F ? "Face-to-Face (In-person)" : "Online"}`,
  ];

  if (reason) lines.push(`• Reason: ${reason}`);

  if (isF2F) {
    const { campus, office } = getOfficeMeta(counselorCampus, studentCampus);
    lines.push(`• Campus: ${campus}`, `• Office: ${office}`, "• Please arrive 5–10 minutes early.");
  } else {
    const link = String(meetLink || "").trim();
    lines.push("");
    lines.push("Google Meet link");
    lines.push(`• ${link || "Link will be provided shortly."}`);
    lines.push("", "• Tip: Please ensure you have a stable internet connection.");
  }

  lines.push(
    "",
    "If you have any questions or need to adjust your schedule, please reply to this email as soon as possible.",
    "",
    "Thank you,",
    counselorName ? `${counselorName}` : "Guidance Counselor",
    "Guidance & Counseling Office"
  );

  return { subject, body: lines.join("\n") };
}

function buildGmailComposeUrl({ to, subject, body }) {
  const email = String(to || "").trim();
  if (!email) return "";
  const qs = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: email,
    su: subject || "",
    body: body || "",
    tf: "1",
  });
  return `https://mail.google.com/mail/?${qs.toString()}`;
}

function buildMailtoUrl({ to, subject, body }) {
  const email = String(to || "").trim();
  if (!email) return "";
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
}

function openGmailComposeOrMailto({ to, subject, body }) {
  const gmailUrl = buildGmailComposeUrl({ to, subject, body });
  const mailtoUrl = buildMailtoUrl({ to, subject, body });
  if (!isBrowser()) return;

  if (gmailUrl) {
    const win = window.open(gmailUrl, "_blank", "noopener,noreferrer");
    if (win) return;
  }
  if (mailtoUrl) window.location.href = mailtoUrl;
}

/* ===================== MOBILE SHEET UTIL ===================== */
function useIsMobileSm() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!isBrowser()) return;
    const mql = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(!!mql.matches);
    update();
    if (mql.addEventListener) mql.addEventListener("change", update);
    else mql.addListener(update);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", update);
      else mql.removeListener(update);
    };
  }, []);

  return isMobile;
}

function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked || !isBrowser()) return;

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };

    html.style.overscrollBehavior = "none";
    html.style.overflow = "hidden";

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;

      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;

      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

function useSheetDragClose({ enabled, onClose }) {
  const isMobile = useIsMobileSm();
  const active = enabled && isMobile;

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const ref = useRef({
    pointerId: null,
    startY: 0,
    startTime: 0,
    lastY: 0,
    lastTime: 0,
  });

  const thresholdPx = 120;
  const velocityPxPerSec = 900;

  const reset = () => {
    setDragging(false);
    setDragY(0);
    ref.current.pointerId = null;
  };

  const onPointerDown = (e) => {
    if (!active) return;
    if (typeof e.button === "number" && e.button !== 0) return;

    ref.current.pointerId = e.pointerId;
    ref.current.startY = e.clientY;
    ref.current.lastY = e.clientY;
    ref.current.startTime = performance.now();
    ref.current.lastTime = ref.current.startTime;

    setDragging(true);
    setDragY(0);

    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerMove = (e) => {
    if (!active) return;
    if (!dragging) return;
    if (ref.current.pointerId !== e.pointerId) return;

    const dy = Math.max(0, e.clientY - ref.current.startY);
    setDragY(dy);

    ref.current.lastY = e.clientY;
    ref.current.lastTime = performance.now();
  };

  const finish = (e) => {
    if (!active) return;
    if (!dragging) return;
    if (ref.current.pointerId !== e.pointerId) return;

    const totalDy = Math.max(0, e.clientY - ref.current.startY);
    const dt = Math.max(1, ref.current.lastTime - ref.current.startTime);
    const v = (totalDy / dt) * 1000;

    const shouldClose = totalDy >= thresholdPx || v >= velocityPxPerSec;

    if (shouldClose) {
      reset();
      onClose?.();
      return;
    }

    reset();
  };

  const onPointerUp = (e) => finish(e);
  const onPointerCancel = (e) => finish(e);

  const sheetStyle = active
    ? {
        transform: `translateY(${dragY}px)`,
        transition: dragging ? "none" : "transform 180ms ease-out",
        willChange: "transform",
      }
    : undefined;

  return {
    sheetStyle,
    dragHandleProps: active
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel,
        }
      : {},
  };
}

/* ===================== AUTO GOOGLE MEET (FRONTEND HOOK) ===================== */
/**
 * You need a backend route that creates a Calendar event with conferenceData and returns:
 *   { meetLink: "https://meet.google.com/..." }
 */
async function createGoogleMeetLinkViaApi({ date, time, studentEmail, counselorName, reason }) {
  const res = await fetch("/api/google-meet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date,
      time,
      studentEmail,
      counselorName,
      reason,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Meet API failed");
  }

  const data = await res.json();
  const meetLink = String(data?.meetLink || "").trim();
  if (!meetLink) throw new Error("Meet link missing");
  return meetLink;
}

/* ===================== SAMPLE DATA ===================== */
function longNotes(i) {
  return (
    `Notes #${i}\n\n` +
    "I have been feeling overwhelmed lately with deadlines, expectations, and my own thoughts. ".repeat(10) +
    "\n\n" +
    "Sometimes it affects my sleep and appetite. I also struggle to focus during classes and feel anxious before exams. ".repeat(8) +
    "\n\n" +
    "I would like guidance and coping strategies. Thank you."
  );
}

function makeStudent(i) {
  const courses = COURSE_OPTIONS[i % COURSE_OPTIONS.length];
  const studentId = `2023-${String(88000 + i).padStart(6, "0")}`;
  return {
    studentId,
    name: stableNameFromStudentId(studentId, i),
    email: `student${i}@gmail.com`,
    campus: i % 2 === 0 ? "Main Campus" : "Annex Campus",
    courses,
  };
}

function makeReq({ id, status, createdAt, date, time, mode, reason, notes, counselor, student, meetLink, canceledAt, cancelNote }) {
  return {
    id,
    status,
    createdAt,
    updatedAt: createdAt,
    date,
    time,
    mode,
    reason,
    notes,
    meetLink: meetLink || "",
    canceledAt: canceledAt || "",
    cancelNote: cancelNote || "",
    student,
    counselor,
  };
}

const MOCK_MEET_REQUESTS = (() => {
  const base = [];
  const c1 = BASE_COUNSELORS[0];
  const c2 = BASE_COUNSELORS[1];

  const dates = ["2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06", "2026-02-07", "2026-02-10", "2026-02-11", "2026-02-12", "2026-02-13", "2026-02-14"];
  let n = 1;

  for (let i = 0; i < 5; i += 1) {
    base.push(
      makeReq({
        id: `MEET-4${String(100 + n).slice(1)}`,
        status: STATUS.PENDING,
        createdAt: `2026-01-${String(10 + i).padStart(2, "0")} 09:0${i}`,
        date: dates[i],
        time: SAMPLE_TIMES[i % SAMPLE_TIMES.length],
        mode: i % 2 === 0 ? "Online" : "In-person",
        reason: REASON_OPTIONS[i % REASON_OPTIONS.length],
        notes: longNotes(i + 1),
        counselor: i % 2 === 0 ? c1 : c2,
        student: makeStudent(++n),
      })
    );
  }

  for (let i = 0; i < 5; i += 1) {
    base.push(
      makeReq({
        id: `MEET-4${String(100 + n).slice(1)}`,
        status: STATUS.APPROVED,
        createdAt: `2026-01-${String(15 + i).padStart(2, "0")} 10:1${i}`,
        date: dates[(i + 2) % dates.length],
        time: SAMPLE_TIMES[(i + 3) % SAMPLE_TIMES.length],
        mode: i % 2 === 0 ? "Online" : "In-person",
        reason: REASON_OPTIONS[(i + 2) % REASON_OPTIONS.length],
        notes: longNotes(i + 10),
        counselor: i % 2 === 0 ? c1 : c2,
        student: makeStudent(++n),
        meetLink: i % 2 === 0 ? `https://meet.google.com/sample-${i}-link` : "",
      })
    );
  }

  for (let i = 0; i < 5; i += 1) {
    base.push(
      makeReq({
        id: `MEET-4${String(100 + n).slice(1)}`,
        status: STATUS.DISAPPROVED,
        createdAt: `2026-01-${String(20 + i).padStart(2, "0")} 11:2${i}`,
        date: dates[(i + 4) % dates.length],
        time: SAMPLE_TIMES[(i + 5) % SAMPLE_TIMES.length],
        mode: i % 2 === 0 ? "Online" : "In-person",
        reason: REASON_OPTIONS[(i + 4) % REASON_OPTIONS.length],
        notes: longNotes(i + 20),
        counselor: i % 2 === 0 ? c1 : c2,
        student: makeStudent(++n),
      })
    );
  }

  for (let i = 0; i < 5; i += 1) {
    const createdAt = `2026-01-${String(25 + i).padStart(2, "0")} 08:3${i}`;
    const canceledAt = `2026-01-${String(25 + i).padStart(2, "0")} 12:0${i}`;
    base.push(
      makeReq({
        id: `MEET-4${String(100 + n).slice(1)}`,
        status: STATUS.CANCELED,
        createdAt,
        date: dates[(i + 6) % dates.length],
        time: SAMPLE_TIMES[(i + 6) % SAMPLE_TIMES.length],
        mode: i % 2 === 0 ? "Online" : "In-person",
        reason: REASON_OPTIONS[(i + 6) % REASON_OPTIONS.length],
        notes: longNotes(i + 30),
        counselor: i % 2 === 0 ? c1 : c2,
        student: makeStudent(++n),
        canceledAt,
        cancelNote: "Canceled due to schedule conflict.",
      })
    );
  }

  return base.slice(0, 20);
})();

/* ===================== UI PRIMITIVES ===================== */
function Badge({ children, className = "" }) {
  return (
    <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold bg-slate-50 text-slate-700 border-slate-200", className].join(" ")}>
      {children}
    </span>
  );
}

function Button({ variant = "solid", size = "md", className = "", ...props }) {
  const base = "inline-flex items-center justify-center font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed";
  const sizing = size === "sm" ? "h-9 px-3 rounded-xl text-xs" : "h-11 px-4 rounded-2xl text-sm";

  const solid = "bg-slate-800 text-white hover:bg-slate-900";
  const soft = "bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100";
  const outline = "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50";

  const style = variant === "soft" ? soft : variant === "outline" ? outline : solid;
  return <button className={[base, sizing, style, className].join(" ")} {...props} />;
}

function Notice({ tone = "slate", message, onClose }) {
  if (!message) return null;

  const toneMap = {
    slate: "border-slate-200 bg-white text-slate-800",
    green: "border-emerald-100 bg-emerald-50 text-emerald-900",
    red: "border-red-100 bg-red-50 text-red-900",
    amber: "border-amber-100 bg-amber-50 text-amber-900",
    blue: "border-blue-100 bg-blue-50 text-blue-900",
  };

  return (
    <div className={["rounded-2xl border px-4 py-3 shadow-sm", toneMap[tone] || toneMap.slate].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-extrabold">{message}</div>
        <Button size="sm" variant="soft" onClick={onClose}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}


function ModalShell({ open, onClose, children, zClass = "z-[9999]" }) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={[
        "fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center",
        "p-0 sm:p-4",
        zClass,
      ].join(" ")}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{ overscrollBehavior: "none" }}
    >
      {children}
    </div>
  );
}

function ModalCard({ className = "", children, sheet = false, style }) {
  return (
    <div
      style={style}
      className={[
        "w-full overflow-hidden bg-white border border-slate-200 shadow-2xl flex flex-col",
        sheet ? "rounded-t-3xl rounded-b-none sm:rounded-3xl" : "rounded-2xl sm:rounded-3xl",
        sheet ? "h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90dvh]" : "max-h-[92dvh] sm:max-h-[90dvh]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}


function ConfirmActionModal({
  open,
  busy,
  title = "Are you sure?",
  description = "Please confirm you want to apply this action.",
  summaryLines = [],
  confirmText = "Continue",
  cancelText = "Cancel",
  reasonRequired = false,
  reasonLabel = "Counselor reason",
  reasonPlaceholder = "Write the reason for disapproval…",
  reasonHint = "This will be shown to the student under “Counselor reason”.",
  reasonValue = "",
  onReasonChange,
  error,
  onCancel,
  onConfirm,
}) {
  const isMobile = useIsMobileSm();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const card = (
    <div
      className={[
        "pointer-events-auto bg-white shadow-2xl border border-slate-200",
        "w-full sm:w-[560px]",
        "rounded-2xl overflow-hidden",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-4 sm:px-6 py-5">
        <div className="text-base sm:text-lg font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm font-medium text-slate-600">{description}</div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          {Array.isArray(summaryLines) && summaryLines.length ? (
            <ul className="list-disc pl-5 space-y-1 text-sm font-medium text-slate-700">
              {summaryLines.map((line, i) => (
                <li key={i} className="break-words">{line}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm font-medium text-slate-700">No details available.</div>
          )}
        </div>

        {reasonRequired ? (
          <div className="mt-4">
            <div className="text-xs font-bold text-slate-500">{reasonLabel}</div>
            <textarea
              value={reasonValue}
              onChange={(e) => onReasonChange?.(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder={reasonPlaceholder}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100 resize-none"
            />
            <div className="mt-2 text-[11px] font-bold text-slate-500">{reasonHint}</div>
          </div>
        ) : null}

        {error ? <div className="mt-3 text-sm font-medium text-red-600">{error}</div> : null}

        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="order-2 sm:order-1 h-11 px-4 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 transition-all outline-none focus:outline-none focus:ring-0 touch-manipulation"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="order-1 sm:order-2 h-11 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-60 outline-none focus:outline-none focus:ring-0 touch-manipulation bg-slate-900 text-white hover:bg-slate-800"
          >
            {busy ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[10010]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onCancel} />
      <div className={["absolute inset-0 flex justify-center pointer-events-none", isMobile ? "items-end p-0" : "items-center p-6"].join(" ")}>
        {isMobile ? <div className="pointer-events-auto w-full max-w-[640px] rounded-t-3xl overflow-hidden">{card}</div> : card}
      </div>
    </div>,
    document.body
  );
}



function MeetLinkBeforeApproveModal({
  open,
  busy,
  requestSummaryLines = [],
  meetLink,
  emailTo,
  emailOpened,
  error,
  onMeetLinkChange,
  onOpenEmail,
  onCancel,
  onProceed,
}) {
  const isMobile = useIsMobileSm();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const card = (
    <div
      className={[
        "pointer-events-auto bg-white shadow-2xl border border-slate-200",
        "w-full sm:w-[600px]",
        "rounded-2xl overflow-hidden",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label="Send meeting link"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-4 sm:px-6 py-5">
        <div className="text-base sm:text-lg font-semibold text-slate-900">Send meeting link first</div>
        <div className="mt-1 text-sm font-medium text-slate-600">
          For <b>Online</b> sessions, please send the Google Meet link to the student before approving.
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          {Array.isArray(requestSummaryLines) && requestSummaryLines.length ? (
            <ul className="list-disc pl-5 space-y-1 text-sm font-medium text-slate-700">
              {requestSummaryLines.map((line, i) => (
                <li key={i} className="break-words">{line}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm font-medium text-slate-700">No details available.</div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-xs font-bold text-slate-500">Student email</div>
          <div className="text-sm font-extrabold text-slate-800 break-words">{emailTo || "—"}</div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-xs font-bold text-slate-500">Google Meet link</div>
          <input
            value={meetLink}
            onChange={(e) => onMeetLinkChange?.(e.target.value)}
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
            className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
          />
          <div className="text-[11px] font-bold text-slate-500">
            {emailOpened ? "✅ Email draft opened. Please send it, then continue." : "Open the email draft to send the link."}
          </div>
        </div>
        {error ? <div className="mt-3 text-sm font-medium text-red-600">{error}</div> : null}

        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="order-3 sm:order-1 h-11 px-4 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 transition-all outline-none focus:outline-none focus:ring-0 touch-manipulation"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onOpenEmail}
            disabled={busy}
            className="order-2 sm:order-2 h-11 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-60 outline-none focus:outline-none focus:ring-0 touch-manipulation bg-slate-50 text-slate-900 border border-slate-200 hover:bg-slate-100"
          >
            {busy ? "Please wait..." : "Open Email Draft"}
          </button>

          <button
            type="button"
            onClick={onProceed}
            disabled={busy}
            className="order-1 sm:order-3 h-11 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-60 outline-none focus:outline-none focus:ring-0 touch-manipulation bg-slate-900 text-white hover:bg-slate-800"
          >
            {busy ? "Please wait..." : "Proceed to Approve"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[10010]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onCancel} />
      <div className={["absolute inset-0 flex justify-center pointer-events-none", isMobile ? "items-end p-0" : "items-center p-6"].join(" ")}>
        {isMobile ? <div className="pointer-events-auto w-full max-w-[680px] rounded-t-3xl overflow-hidden">{card}</div> : card}
      </div>
    </div>,
    document.body
  );
}

function Card({ title, children, className = "" }) {
  return (
    <div className={["rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm", className].join(" ")}>
      <div className="text-sm font-black text-slate-800">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function KVGrid({ items }) {
  return (
    <dl className="space-y-3">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-3 items-start">
          <dt className="text-xs font-bold text-slate-500">{it.label}</dt>
          <dd className="text-sm font-extrabold text-slate-800 break-words sm:text-right">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
function PillTab({ tabKey, active, onClick, label, count }) {
  const dot = active ? "bg-white" : "bg-slate-400";

  return (
    <button
      type="button"
      data-tab-key={tabKey}
      onClick={onClick}
      className={[
        "shrink-0 snap-start",
        "px-3 sm:px-4 py-2 rounded-2xl border transition",
        "text-xs sm:text-sm font-extrabold",
        active ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-2">
        <span className={["inline-block h-2.5 w-2.5 rounded-full", dot].join(" ")} />
        {label}
        <span
          className={[
            "ml-1 px-2 py-0.5 rounded-full text-[11px] font-black border",
            active ? "border-white/30 bg-white/10" : "border-slate-200 bg-slate-50",
          ].join(" ")}
        >
          {count}
        </span>
      </span>
    </button>
  );
}

function PaginationBar({ page, totalPages, onPage }) {
  if (totalPages < 1) return null;

  const go = (p) => onPage(Math.min(totalPages, Math.max(1, p)));

  // show up to 5 page buttons on desktop, centered around current page
  const getPages = () => {
    const maxButtons = 5;

    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(maxButtons / 2); // 2
    let start = page - half;
    let end = page + half;

    if (start < 1) {
      start = 1;
      end = maxButtons;
    }
    if (end > totalPages) {
      end = totalPages;
      start = totalPages - maxButtons + 1;
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const pages = getPages();

  return (
    <>
      {/* ✅ MOBILE (keep your current style) */}
      <div className="sm:hidden flex items-center justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => go(page - 1)} disabled={page <= 1}>
          Prev
        </Button>

        <div className="px-4 h-9 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 inline-flex items-center">
          {page} / {totalPages}
        </div>

        <Button size="sm" variant="outline" onClick={() => go(page + 1)} disabled={page >= totalPages}>
          Next
        </Button>
      </div>

      {/* ✅ DESKTOP (like your screenshot) */}
      <div className="hidden sm:flex flex-col items-center gap-2">
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => go(page - 1)} disabled={page <= 1}>
            Prev
          </Button>

          {pages.map((p) => (
            <button
              key={p}
              onClick={() => go(p)}
              className={[
                "h-10 min-w-[40px] px-3 rounded-xl border text-sm font-extrabold transition",
                p === page
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {p}
            </button>
          ))}

          <Button size="sm" variant="outline" onClick={() => go(page + 1)} disabled={page >= totalPages}>
            Next
          </Button>
        </div>

        <div className="text-xs font-bold text-slate-600">
          Page <span className="font-black">{page}</span> / {totalPages}
        </div>
      </div>
    </>
  );
}


function SheetGrabber({ dragHandleProps }) {
  return (
    <div {...dragHandleProps} className="sm:hidden flex flex-col items-center gap-2 pt-3 pb-2 select-none" style={{ touchAction: "none" }}>
      <div className="h-1.5 w-12 rounded-full bg-slate-200" />
    </div>
  );
}

export default function CounselorMeetRequests() {
  const [notice, setNotice] = useState({ tone: "slate", message: "" });
  const toastTimerRef = useRef(null);


const [confirmOpen, setConfirmOpen] = useState(false);
const [confirmBusy, setConfirmBusy] = useState(false);
const [confirmError, setConfirmError] = useState("");
const [confirmMeta, setConfirmMeta] = useState({
  title: "Are you sure?",
  description: "Please confirm you want to apply this action.",
  summaryLines: [],
  confirmText: "Continue",
  requiresReason: false,
  reasonLabel: "Counselor reason",
  reasonPlaceholder: "Write the reason for disapproval…",
  reasonHint: "This will be shown to the student under “Counselor reason”.",
  action: null,
});

const [disapproveReasonDraft, setDisapproveReasonDraft] = useState("");
const disapproveReasonRef = useRef("");

const setDisapproveReason = (v) => {
  const next = String(v || "");
  setDisapproveReasonDraft(next);
  disapproveReasonRef.current = next;
};


const [meetLinkFlowOpen, setMeetLinkFlowOpen] = useState(false);
const [meetLinkFlowBusy, setMeetLinkFlowBusy] = useState(false);
const [meetLinkFlowError, setMeetLinkFlowError] = useState("");
const [meetLinkEmailOpened, setMeetLinkEmailOpened] = useState(false);

const openConfirm = useCallback((meta) => {
  setConfirmError("");
  setConfirmMeta((prev) => ({
    ...prev,
    ...(meta || {}),
    summaryLines: Array.isArray(meta?.summaryLines) ? meta.summaryLines : [],
    confirmText: meta?.confirmText || "Continue",
  }));
  setConfirmOpen(true);
}, []);

const closeConfirm = useCallback(() => {
  if (confirmBusy) return;
  setConfirmOpen(false);
  setConfirmError("");
  setDisapproveReason("");
  setConfirmMeta((prev) => ({ ...prev, action: null, requiresReason: false }));
}, [confirmBusy]);

const runConfirmed = useCallback(async () => {
  const fn = confirmMeta?.action;
  if (typeof fn !== "function") {
    closeConfirm();
    return;
  }
  if (confirmMeta?.requiresReason) {
    const reason = String(disapproveReasonRef.current || "").trim();
    if (!reason) {
      setConfirmError("Please enter the counselor reason for disapproval.");
      return;
    }
  }

  setConfirmBusy(true);
  setConfirmError("");
  try {
    await fn();
    setConfirmOpen(false);
  } catch (e) {
    setConfirmError(e?.message || "Action failed. Please try again.");
  } finally {
    setConfirmBusy(false);
  }
}, [confirmMeta, closeConfirm]);



  // ✅ add this
  const tabsRowRef = useRef(null);



  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const doToast = (tone, message, autoMs = 1700) => {
    setNotice({ tone, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setNotice({ tone: "slate", message: "" }), autoMs);
  };

  
const [counselorDirectory, setCounselorDirectory] = useState([]);

// ✅ Load counselor directory from backend (names for UI)
useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const data = await apiFetch("/api/counseling/counselors");
      const items = Array.isArray(data?.items) ? data.items : [];
      const dir = items
        .map((c) => ({
          counselorId: String(c?.id || c?._id || "").trim(),
          name: String(c?.name || c?.fullName || "").trim(),
        }))
        .filter((c) => c.counselorId);

      if (alive) setCounselorDirectory(dir);
    } catch {
      if (alive) setCounselorDirectory([]);
    }
  })();

  return () => {
    alive = false;
  };
}, []);

  const [requests, setRequests] = useState([]);

const fetchMeetRequests = async () => {
  try {
    const data = await apiFetch("/api/counseling/requests?type=MEET");
    const items = Array.isArray(data?.items) ? data.items : [];
    const normalized = items
      .map((x) => normalizeApiMeetRequest(x, counselorDirectory))
      .filter(Boolean);

    setRequests(normalizeRequestsWithCounselors(normalized, counselorDirectory));
  } catch (e) {
    doToast("red", e?.message || "Failed to load meet requests.");
    setRequests([]);
  }
};

useEffect(() => {
  fetchMeetRequests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  useEffect(() => {
    dispatchMeetRequestsUpdated(); // ✅ same-tab instant refresh
  }, [requests]);

useEffect(() => {
    setRequests((prev) => normalizeRequestsWithCounselors(prev, counselorDirectory));
  }, [counselorDirectory]);

  const [tab, setTab] = useState("All");

  // ✅ Reset tab strip scroll so Pending is not half-hidden when you open this section
  useEffect(() => {
    const row = tabsRowRef.current;
    if (!row) return;
    row.scrollTo({ left: 0, behavior: "auto" });
  }, []);

  // ✅ Keep active tab visible (center it nicely)
  useEffect(() => {
    const row = tabsRowRef.current;
    if (!row) return;

    const btn = row.querySelector(`[data-tab-key="${tab}"]`);
    if (!btn) return;

    requestAnimationFrame(() => {
      btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }, [tab]);

  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState(SORT.NEWEST);

  const [selectedId, setSelectedId] = useState(null);
  const [openReschedule, setOpenReschedule] = useState(false);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return requests.find((r) => r.id === selectedId) || null;
  }, [requests, selectedId]);

  useEffect(() => {
    if (!selected) setOpenReschedule(false);
  }, [selected]);

useEffect(() => {
  if (!selected) {
    setMeetLinkFlowOpen(false);
    setMeetLinkFlowError("");
    setMeetLinkEmailOpened(false);
  }
}, [selected]);


    const myRequests = useMemo(() => requests, [requests]);

  const counts = useMemo(() => {
    const count = (s) => myRequests.filter((x) => x.status === s).length;
    return {
      pending: count(STATUS.PENDING),
      approved: count(STATUS.APPROVED),
      disapproved: count(STATUS.DISAPPROVED),
      canceled: count(STATUS.CANCELED),
      rescheduled: count(STATUS.RESCHEDULED),
      all: myRequests.length,
    };
  }, [myRequests]);

  const tabs = useMemo(
    () => [
      { key: STATUS.PENDING, label: "Pending", count: counts.pending },
      { key: STATUS.APPROVED, label: "Approved", count: counts.approved },
      { key: STATUS.RESCHEDULED, label: "Rescheduled", count: counts.rescheduled },
      { key: STATUS.DISAPPROVED, label: "Disapproved", count: counts.disapproved },
      { key: STATUS.CANCELED, label: "Canceled", count: counts.canceled },
      { key: "All", label: "All", count: counts.all },
    ],
    [counts]
  );

  const filteredSorted = useMemo(() => {
    const byTab = tab === "All" ? myRequests : myRequests.filter((r) => r.status === tab);

    const needle = q.trim().toLowerCase();
    const filtered = !needle
      ? byTab
      : byTab.filter((r) => {
          const hay = (
            `${r.status} ${r.createdAt} ${r.updatedAt || ""} ${r.date} ${r.time} ${r.mode} ${r.reason} ` +
            `${r.student?.name || ""} ${r.student?.studentId || ""} ${r.student?.email || ""} ${r.student?.courses || ""} ${r.disapprovalReason || ""}`
          ).toLowerCase();
          return hay.includes(needle);
        });

    const sorted = filtered.slice();
    const cmpCreated = (a, b) => compareCreatedAt(a, b);

    if (sortBy === SORT.NEWEST) sorted.sort((a, b) => (cmpCreated(a, b) < 0 ? 1 : cmpCreated(a, b) > 0 ? -1 : 0));
    else if (sortBy === SORT.OLDEST) sorted.sort((a, b) => (cmpCreated(a, b) < 0 ? -1 : cmpCreated(a, b) > 0 ? 1 : 0));
    else if (sortBy === SORT.DATE_ASC) sorted.sort((a, b) => (parseDateKey(a.date) || 0) - (parseDateKey(b.date) || 0));
    else if (sortBy === SORT.DATE_DESC) sorted.sort((a, b) => (parseDateKey(b.date) || 0) - (parseDateKey(a.date) || 0));
    else sorted.sort((a, b) => (cmpCreated(a, b) < 0 ? 1 : cmpCreated(a, b) > 0 ? -1 : 0));

    return sorted;
  }, [myRequests, tab, q, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [tab, q, sortBy]);

  const pageSize = 2;
  const [page, setPage] = useState(1);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clampPage(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, safePage]);

  const showingFrom = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(safePage * pageSize, total);

  const [pageAnimKey, setPageAnimKey] = useState(0);
  useEffect(() => {
    setPageAnimKey((k) => k + 1);
  }, [safePage]);



const summarizeRequestBasics = (r) => {
  const name = r?.student?.name || "—";
  const sid = r?.student?.studentId || "—";
  const when = `${r?.date || "—"} • ${r?.time || "—"}`;
  const mode = r?.mode === "In-person" ? "Face-to-Face" : "Online";
  const reason = r?.reason || "—";
  return { name, sid, when, mode, reason };
};

const confirmApprove = (r) => {
  if (!r?.id) return;

  // ✅ Online flow: require sending meeting link before approving
  const isOnline = !String(r?.mode || "").toLowerCase().includes("in-person");
  if (isOnline) {
    openMeetLinkFlow(r);
    return;
  }

  const b = summarizeRequestBasics(r);
  openConfirm({
    title: "Are you sure?",
    description: "Please confirm you want to approve this counseling request.",
    summaryLines: [
      `Status: "${r.status}" → "${STATUS.APPROVED}"`,
      `Student: ${b.name} (${b.sid})`,
      `Schedule: ${b.when}`,
      `Mode: ${b.mode}`,
      `Reason: ${b.reason}`,
    ],
    confirmText: "Continue",
    action: async () => approveRequest(r),
  });
};

const confirmDisapprove = (r) => {
  if (!r?.id) return;
  const b = summarizeRequestBasics(r);
  setDisapproveReason("");
  openConfirm({
    title: "Are you sure?",
    description: "Please confirm you want to disapprove this counseling request.",
    summaryLines: [
      `Status: "${r.status}" → "${STATUS.DISAPPROVED}"`,
      `Student: ${b.name} (${b.sid})`,
      `Schedule: ${b.when}`,
      `Mode: ${b.mode}`,
      `Reason: ${b.reason}`,
    ],
    confirmText: "Continue",
    requiresReason: true,
    reasonLabel: "Counselor reason",
    reasonPlaceholder: "Write the reason for disapproval…",
    reasonHint: "This will be shown to the student under “Counselor reason”.",
    action: async () => disapproveRequest(r, disapproveReasonRef.current),
  });
};

const confirmReschedule = () => {
  if (!selected?.id) return;
  if (reschedError) {
    doToast("red", reschedError);
    return;
  }

  const b = summarizeRequestBasics(selected);
  const nextDate = String(reschedDateDraft || "").trim();
  const nextTime = String(reschedTimeDraft || "").trim();
  const nextMode = String(reschedModeDraft || "").trim();
  const nextModeLabel = String(nextMode || "").toLowerCase().includes("in-person") ? "Face-to-Face" : "Online";

  openConfirm({
    title: "Are you sure?",
    description: "Please confirm you want to reschedule this counseling appointment.",
    summaryLines: [
      `Status: "${selected.status}" → "${STATUS.RESCHEDULED}"`,
      `Student: ${b.name} (${b.sid})`,
      `From: ${selected.date} • ${selected.time} • ${b.mode}`,
      `To: ${nextDate} • ${nextTime} • ${nextModeLabel}`,
    ],
    confirmText: "Continue",
    action: async () => confirmRescheduleAndEmail(),
  });
};



const openMeetLinkFlow = (r) => {
  if (!r?.id) return;
  // ensure we're working with the same selected request
  setMeetLinkFlowError("");
  setMeetLinkEmailOpened(false);
  setMeetLinkFlowOpen(true);
  setMeetLinkDraft(String(r.meetLink || ""));
};

const closeMeetLinkFlow = () => {
  if (meetLinkFlowBusy) return;
  setMeetLinkFlowOpen(false);
  setMeetLinkFlowError("");
  setMeetLinkEmailOpened(false);
};

const openApprovalEmailDraft = () => {
  if (!selected?.id) return;
  const link = String(meetLinkDraft || "").trim();
  if (!link) {
    setMeetLinkFlowError("Please paste the Google Meet link first.");
    return;
  }
  if (!/^https?:\/\//i.test(link)) {
    setMeetLinkFlowError("Please enter a valid link (must start with http/https).");
    return;
  }

  const to = String(selected.student?.email || "").trim();
  if (!to) {
    setMeetLinkFlowError("Student email is missing.");
    return;
  }

  const { subject, body } = buildApprovalEmailContent({
    studentName: selected.student?.name,
    date: selected.date,
    time: selected.time,
    mode: selected.mode,
    meetLink: link,
    counselorName: selected.counselor?.name,
    counselorCampus: selected.counselor?.campus,
    studentCampus: selected.student?.campus,
    reason: selected.reason,
  });

  openGmailComposeOrMailto({ to, subject, body });
  setMeetLinkEmailOpened(true);
  setMeetLinkFlowError("");
};

const proceedApproveOnline = () => {
  if (!selected?.id) return;

  const link = String(meetLinkDraft || "").trim();
  if (!link) {
    setMeetLinkFlowError("Meet link is required for Online sessions.");
    return;
  }
  if (!meetLinkEmailOpened) {
    setMeetLinkFlowError("Please click “Open Email Draft” to send the meeting link first.");
    return;
  }

  // Close the link step, then show final confirmation
  setMeetLinkFlowOpen(false);
  setMeetLinkFlowError("");

  const b = summarizeRequestBasics(selected);
  openConfirm({
    title: "Are you sure?",
    description: "Please confirm the details are correct before approving.",
    summaryLines: [
      `Status: "${selected.status}" → "${STATUS.APPROVED}"`,
      `Student: ${b.name} (${b.sid})`,
      `Schedule: ${b.when}`,
      `Mode: ${b.mode}`,
      `Reason: ${b.reason}`,
      `Meeting link: ${link}`,
    ],
    confirmText: "Continue",
    action: async () => approveRequest(selected, { meetingLink: link }),
  });
};

const refreshAfterAction = async () => {
  await fetchMeetRequests();
  dispatchMeetRequestsUpdated();
};

const approveRequest = async (r, opts = {}) => {
  if (!r?.id) return;
  syncCalendarSelectedDate(r.date); // ✅ Calendar auto-select this date
  try {
    const payload = {};

    const isOnline = !String(r?.mode || "").toLowerCase().includes("in-person");
    if (isOnline) {
      const link = String(opts.meetingLink ?? meetLinkDraft ?? "").trim();
      if (link) payload.meetingLink = link;
    }

    await apiFetch(`/api/counseling/admin/requests/${r.id}/approve`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    await refreshAfterAction();
  } catch (e) {
    doToast("red", e?.message || "Approve failed");
  }
};

const disapproveRequest = async (r, reasonText) => {
  if (!r?.id) return;
  const reason = String(reasonText || "").trim();
  try {
    await apiFetch(`/api/counseling/admin/requests/${r.id}/disapprove`, {
      method: "PATCH",
      body: JSON.stringify({ reason: reason || "Disapproved." }),
    });
    await refreshAfterAction();
  } catch (e) {
    doToast("red", e?.message || "Disapprove failed");
  }
};

const setStatus = (r, status) => {
  if (!r?.id) return;
  if (status === STATUS.APPROVED) return approveRequest(r);
  if (status === STATUS.DISAPPROVED) return disapproveRequest(r);
};

function formatMinutesTo12h(totalMinutes) {
  let hh24 = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;

  const ap = hh24 >= 12 ? "PM" : "AM";
  let hh12 = hh24 % 12;
  if (hh12 === 0) hh12 = 12;

  return `${String(hh12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${ap}`;
}

function addMinutesToTime(timeStr, addMins = 60) {
  const start = parseTimeToMinutes(timeStr);
  if (start == null) return "";
  return formatMinutesTo12h(start + addMins);
}



  const [meetLinkDraft, setMeetLinkDraft] = useState("");
  const [reschedDateDraft, setReschedDateDraft] = useState("");
  const [reschedTimeDraft, setReschedTimeDraft] = useState(SAMPLE_TIMES[0]);
  const [reschedModeDraft, setReschedModeDraft] = useState(MODES[0]);

  useEffect(() => {
    if (!selected) return;
    setMeetLinkDraft(String(selected.meetLink || ""));
    setReschedDateDraft(String(selected.date || ""));
    setReschedTimeDraft(String(selected.time || SAMPLE_TIMES[0]));
    setReschedModeDraft(String(selected.mode || MODES[0]));
  }, [selected]);

    const canApproveDecline = selected?.status === STATUS.PENDING;
  const canReschedule = selected?.status !== STATUS.CANCELED && selected?.status !== STATUS.DISAPPROVED;
    const canEditMeetLink = selected?.mode === "Online" && (selected?.status === STATUS.APPROVED || selected?.status === STATUS.RESCHEDULED);

  // Office stays dynamic-ish (for legacy data), but campus label in UI is static.
  const officeMeta = useMemo(() => getOfficeMeta(selected?.counselor?.campus, selected?.student?.campus), [selected]);

  
  const newScheduleOk = useMemo(() => {
    const date = String(reschedDateDraft || "").trim();
    const time = String(reschedTimeDraft || "").trim();
    if (!date || !time) return false;
    const startMs = toSessionStartMs(date, time);
    if (!startMs) return false;
    return Date.now() <= startMs - 2 * 60 * 60 * 1000;
  }, [reschedDateDraft, reschedTimeDraft]);

    const reschedError = useMemo(() => {
    if (!selected) return "";
    if (!reschedDateDraft) return "Please choose a new date.";
    if (!reschedTimeDraft) return "Please choose a new time.";
    if (!newScheduleOk) return "Invalid new schedule: must be at least 2 hours from now.";
    return "";
  }, [selected, reschedDateDraft, reschedTimeDraft, newScheduleOk]);

  const saveMeetLink = async () => {
  if (!selected?.id) return;
  const link = String(meetLinkDraft || "").trim();
  try {
    await apiFetch(`/api/counseling/admin/requests/${selected.id}/meeting-details`, {
      method: "PATCH",
      body: JSON.stringify({ meetingLink: link }),
    });
    await refreshAfterAction();
  } catch (e) {
    doToast("red", e?.message || "Failed to save link");
  }
};

  const copyMeetLink = async (link) => {
    const ok = await copyText(link);
    if (!ok) doToast("red", "Copy failed");
  };

  const confirmRescheduleAndEmail = async () => {
  if (!selected?.id) return;
  if (reschedError) {
    doToast("red", reschedError);
    return;
  }

  const nextDate = String(reschedDateDraft || "").trim();
  const nextTime12 = String(reschedTimeDraft || "").trim();
  const nextTime = time12To24(nextTime12);
  const nextMode = String(reschedModeDraft || "").trim();

  if (!nextTime) {
    doToast("red", "Invalid time format.");
    return;
  }

  syncCalendarSelectedDate(nextDate); // ✅ Calendar auto-select new date

  const oldDate = selected.date;
  const oldTime = selected.time;
  const oldMode = selected.mode;
  try {
    await apiFetch(`/api/counseling/admin/requests/${selected.id}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify({
        date: nextDate,
        time: nextTime,
        sessionType: nextMode,
      }),
    });

    setOpenReschedule(false);
    await refreshAfterAction();
  } catch (e) {
    doToast("red", e?.message || "Reschedule failed");
    return;
  }

  const to = selected.student?.email;
  if (!String(to || "").trim()) return;

  const { subject, body } = buildRescheduleEmailContent({
    studentName: normalizeStudent(selected.student, 0)?.name,
    oldDate,
    oldTime,
    oldMode,
    newDate: nextDate,
    newTime: nextTime12,
    newMode: nextMode,
    counselorName: selected.counselor?.name,
    counselorCampus: selected.counselor?.campus,
    studentCampus: selected.student?.campus,
  });

  openGmailComposeOrMailto({ to, subject, body });
};

  const emptyHint = q.trim() ? "Try a different keyword." : tab !== "All" ? "No items in this tab." : "No requests yet.";

  const closeDetails = () => {
    setOpenReschedule(false);
    setSelectedId(null);
  };

  const sheetView = openReschedule ? "reschedule" : selected ? "details" : null;

  const drag = useSheetDragClose({
    enabled: true,
    onClose: sheetView === "reschedule" ? () => setOpenReschedule(false) : closeDetails,
  });


  return (
    <div className="h-full min-h-0 flex flex-col space-y-4">
      <Notice tone={notice.tone} message={notice.message} onClose={() => setNotice({ tone: "slate", message: "" })} />

      <ConfirmActionModal
        open={confirmOpen}
        busy={confirmBusy}
        title={confirmMeta.title}
        description={confirmMeta.description}
        summaryLines={confirmMeta.summaryLines}
        confirmText={confirmMeta.confirmText}
        reasonRequired={!!confirmMeta.requiresReason}
        reasonLabel={confirmMeta.reasonLabel}
        reasonPlaceholder={confirmMeta.reasonPlaceholder}
        reasonHint={confirmMeta.reasonHint}
        reasonValue={disapproveReasonDraft}
        onReasonChange={setDisapproveReason}
        error={confirmError}
        onCancel={closeConfirm}
        onConfirm={runConfirmed}
      />
<MeetLinkBeforeApproveModal
  open={meetLinkFlowOpen}
  busy={meetLinkFlowBusy}
  requestSummaryLines={[
    `Request: #${selected?.id || "—"}`,
    `Student: ${selected?.student?.name || "—"} (${selected?.student?.studentId || "—"})`,
    `Schedule: ${selected?.date || "—"} • ${selected?.time || "—"}`,
    `Reason: ${selected?.reason || "—"}`,
  ]}
  meetLink={meetLinkDraft}
  emailTo={String(selected?.student?.email || "").trim()}
  emailOpened={meetLinkEmailOpened}
  error={meetLinkFlowError}
  onMeetLinkChange={(v) => setMeetLinkDraft(v)}
  onOpenEmail={() => {
    setMeetLinkFlowBusy(true);
    try {
      openApprovalEmailDraft();
    } finally {
      setMeetLinkFlowBusy(false);
    }
  }}
  onCancel={closeMeetLinkFlow}
  onProceed={proceedApproveOnline}
/>



      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col">

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">Meet Requests</div>
         
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by student name, ID, course, date…"
                  className="w-full h-11 rounded-2xl border border-slate-200 bg-white pl-4 pr-20 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
                />
                {q ? (
                  <Button size="sm" variant="soft" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="w-full sm:w-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full sm:w-[220px] h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
              >
                {Object.values(SORT).map((v) => (
                  <option key={v} value={v}>
                    Sort: {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
  ref={tabsRowRef}
  className="mt-4 -mx-1 px-1 flex items-center gap-2 overflow-x-auto flex-nowrap tab-scroll snap-x snap-mandatory"
>
  {tabs.map((t) => (
    <PillTab
      key={t.key}
      tabKey={t.key}
      active={tab === t.key}
      onClick={() => setTab(t.key)}
      label={t.label}
      count={t.count}
    />
  ))}
</div>


          <div className="mt-4 text-sm font-semibold text-slate-600">
            Showing <span className="font-black">{showingFrom}</span>–<span className="font-black">{showingTo}</span> of{" "}
            <span className="font-black">{total}</span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col min-h-0">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-black text-slate-800">Requests</div>
          <div className="text-xs font-bold text-slate-500">Click an item to manage it.</div>
        </div>

        <div className="meet-scroll">
          {pageItems.length === 0 ? (
            <div className="p-6 sm:p-8">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="text-base font-black text-slate-900">No results</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">{emptyHint}</div>
              </div>
            </div>
          ) : (
            <>
<div key={pageAnimKey} className="page-enter-right p-4 sm:p-6 space-y-4">
  {pageItems.map((r) => (
   <button
  key={r.id}
  onClick={() => {
    setSelectedId(r.id);
    setOpenReschedule(false);
  }}
  className="w-full text-left rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 transition
             px-4 py-4 sm:px-6 sm:py-5"
>
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
    {/* LEFT */}
   <div className="min-w-0">
  <div className="flex items-center gap-2 min-w-0">
    <span className="text-sm sm:text-base font-black text-slate-900 truncate">
      {r.reason}
    </span>
    <span className="text-slate-400 font-black">•</span>
    <span className="text-sm sm:text-base font-black text-slate-600 shrink-0">
      {r.date}
    </span>
  </div>

  <div className="mt-1 text-xs sm:text-sm font-extrabold text-slate-700">
    {r.time} <span className="text-slate-400">•</span> {addMinutesToTime(r.time, 60)}
  </div>


      {/* Student */}
      <div className="mt-2 text-xs sm:text-sm font-bold text-slate-600">
        <div className="font-extrabold text-slate-800 break-words">
          {r.student?.name || "Full Name"}
        </div>
        <div className="mt-0.5 break-words">
          {r.student?.courses || "Course"}
        </div>
      </div>
    </div>

    {/* RIGHT / FOOT */}
    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-2">
      <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border border-emerald-200 bg-emerald-50 text-emerald-900">
        {r.status}
      </span>

      <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border border-slate-200 bg-slate-50 text-slate-700">
        {r.mode === "In-person" ? "Face-to-Face" : "Online"}
      </span>

      <div className="text-[11px] font-bold text-slate-400 sm:self-end">
        #{r.id}
      </div>
    </div>
  </div>
</button>

  ))}
</div>



              <div className="pagination-sticky">
                <PaginationBar page={safePage} totalPages={totalPages} onPage={(p) => setPage(p)} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* SINGLE FULLSCREEN SHEET */}
      <ModalShell
        open={!!sheetView}
        onClose={() => {
          if (sheetView === "reschedule") setOpenReschedule(false);
          else closeDetails();
        }}
        zClass="z-[9999]"
      >
        {sheetView === "details" && selected ? (
          <ModalCard sheet className="max-w-4xl sm:max-w-4xl" style={drag.sheetStyle}>
            <SheetGrabber dragHandleProps={drag.dragHandleProps} />

            <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
              <div className="text-base sm:text-lg font-black text-slate-900">Session details</div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Badge>{selected.status}</Badge>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 bg-slate-50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Notes" className="lg:col-span-2">
                  <div className="notes-scroll text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">{selected.notes || "—"}</div>
                </Card>

                <Card title="Info">
                  <KVGrid
                    items={[
                      { label: "Session type", value: selected.mode === "In-person" ? "Face-to-Face (In-person)" : "Online" },
                      { label: "Duration", value: "1 hour" },
                      { label: "Reason", value: selected.reason },
                      { label: "Appointment time", value: `${selected.date} • ${selected.time}` },
                      { label: "Counselor", value: selected.counselor?.name || "Counselor" },
                      { label: "Campus", value: STATIC_CAMPUS_LABEL },
                      {
                        label: "Online link",
                        value:
                          selected.mode !== "Online"
                            ? "Not required (Face-to-Face)."
                            : selected.status !== STATUS.APPROVED
                              ? "Available after approval."
                              : selected.meetLink
                                ? "Provided."
                                : "Not yet provided.",
                      },
                      { label: "Submitted", value: formatBackendDateTime(selected.createdAt) },
                      { label: "Last updated", value: formatBackendDateTime(selected.updatedAt || selected.createdAt) },
                    ]}
                  />
                </Card>

                <Card title="Student">
                  <KVGrid
                    items={[
                      { label: "Full name", value: selected.student?.name || "—" },
                      { label: "Student ID", value: selected.student?.studentId || "—" },
                      { label: "Email", value: selected.student?.email || "—" },
                      { label: "Campus", value: STATIC_CAMPUS_LABEL },
                      { label: "Course", value: selected.student?.courses || "—" },
                    ]}
                  />
                </Card>

                <Card title="Meet link" className="lg:col-span-2">
                  {selected.mode !== "Online" ? (
                    <div className="text-sm font-semibold text-slate-700">Face-to-Face request (no Meet link needed).</div>
                  ) : !canEditMeetLink ? (
                    <div className="text-sm font-semibold text-slate-700">For Online sessions, click Approve to send the Google Meet link first. After approval, you can still edit it here.</div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        value={meetLinkDraft}
                        onChange={(e) => setMeetLinkDraft(e.target.value)}
                        placeholder="https://meet.google.com/xxx-xxxx-xxx"
                        className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button onClick={saveMeetLink}>Save</Button>

                        {selected.meetLink ? (
                          <>
                            <Button variant="outline" onClick={() => copyMeetLink(selected.meetLink)}>
                              Copy
                            </Button>
                            <a href={selected.meetLink} target="_blank" rel="noreferrer">
                              <Button variant="outline" type="button">
                                Open
                              </Button>
                            </a>
                          </>
                        ) : (
                          <div className="text-xs font-bold text-slate-500">No link yet.</div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>

           <div className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
  <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
    {/* Primary actions */}
    {canApproveDecline ? (
      <>
        <Button
          className="w-full sm:w-auto sm:order-1"
          onClick={() => confirmApprove(selected)}
        >
          Approve
        </Button>

        {canReschedule ? (
          <Button
            className="w-full sm:w-auto sm:order-2"
            onClick={() => setOpenReschedule(true)}
          >
            Reschedule
          </Button>
        ) : null}

        <Button
          className="w-full sm:w-auto sm:order-3"
          onClick={() => confirmDisapprove(selected)}
        >
          Disapprove
        </Button>
      </>
    ) : canReschedule ? (
      <Button
        className="w-full sm:w-auto sm:order-1"
        onClick={() => setOpenReschedule(true)}
      >
        Reschedule
      </Button>
    ) : null}

    {/* Close always last */}
    <Button
      variant="soft"
      className="w-full sm:w-auto sm:order-4"
      onClick={closeDetails}
    >
      Close
    </Button>
  </div>
</div>

          </ModalCard>
        ) : null}

        {sheetView === "reschedule" ? (
          <ModalCard sheet className="max-w-lg sm:max-w-lg" style={drag.sheetStyle}>
            <SheetGrabber dragHandleProps={drag.dragHandleProps} />

            <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
              <div className="text-base font-black text-slate-900">Reschedule appointment</div>
              <div className="text-xs font-bold text-slate-500 mt-1">Must be at least 2 hours from now.</div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 space-y-3 bg-slate-50">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold text-slate-500">Student email</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900 break-words">{selected?.student?.email || "—"}</div>

                <div className="mt-3 text-xs font-bold text-slate-500">Current appointment</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900 break-words">
                  {selected?.date || "—"} • {selected?.time || "—"} • {selected?.mode === "In-person" ? "Face-to-Face" : selected?.mode || "—"}
                </div>

                <div className="mt-3 text-xs font-bold text-slate-500">Campus & office</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900 break-words">
                  {STATIC_CAMPUS_LABEL} • {officeMeta.office}
                </div>
              </div>

              {reschedError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-900">{reschedError}</div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-500">New date</div>
                  <input
                    value={reschedDateDraft}
                    onChange={(e) => setReschedDateDraft(e.target.value)}
                    type="date"
                    className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-500">New time</div>
                  <select
                    value={reschedTimeDraft}
                    onChange={(e) => setReschedTimeDraft(e.target.value)}
                    className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
                  >
                    {SAMPLE_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <div className="text-xs font-bold text-slate-500">Mode</div>
                  <select
                    value={reschedModeDraft}
                    onChange={(e) => setReschedModeDraft(e.target.value)}
                    className="w-full h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
                  >
                    {MODES.map((m) => (
                      <option key={m} value={m}>
                        {m === "In-person" ? "Face-to-Face (In-person)" : "Online"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="shrink-0 px-4 sm:px-6 py-4 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button variant="soft" className="w-full sm:w-auto order-2 sm:order-1" onClick={() => setOpenReschedule(false)}>
                  Back
                </Button>
                <Button className="w-full sm:w-auto order-1 sm:order-2" onClick={confirmReschedule} disabled={!!reschedError}>
                  Reschedule & Email Student
                </Button>
              </div>
            </div>
          </ModalCard>
        ) : null}
      </ModalShell>

      <style>{`
        .meet-scroll{
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        .meet-list-pad{ padding-bottom: 84px; }

        .pagination-sticky{
          position: sticky;
          bottom: 0;
          z-index: 5;
          border-top: 1px solid rgb(226 232 240);
          background: rgba(255,255,255,.92);
          backdrop-filter: blur(8px);
          padding: 10px 12px;
        }

        .notes-scroll{
          max-height: 260px;
          overflow: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          padding-right: 6px;
        }

        .tab-scroll{
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          scroll-padding-left: 8px;
          scroll-padding-right: 8px;
        }
        .tab-scroll::-webkit-scrollbar{ display: none; }

        .page-enter-right{
          animation: pageEnterRight .18s ease-out;
          will-change: transform, opacity;
        }
        @keyframes pageEnterRight{
          from { opacity: .65; transform: translateX(14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
