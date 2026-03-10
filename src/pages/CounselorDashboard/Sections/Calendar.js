// src/pages/CounselorDashboard/Sections/Calendar.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../../api/apiFetch";
/**
 * CounselorDashboard - Calendar / Schedule
 * Connected to Meet Requests (backend)
 * - Responsive on all device sizes (xs → 4k)
 * - Uses native date input icon (no duplicate calendar icon)
 * - Mobile pagination is compact (Prev | x/y | Next)
 * - Desktop pagination uses 5-page window
 * - Details: centered modal on desktop, fullscreen on mobile
 *
 * Rules:
 * - Calendar shows ONLY Approved & Rescheduled meet requests
 * - Counselor scope is enforced by backend (logged-in counselor)
 */

/* ===================== STORAGE / SYNC ===================== */
const CALENDAR_SELECTED_DATE_KEY = "counselor_dashboard:calendar_selected_date:v1";
const MEET_REQUESTS_UPDATED_EVENT = "counselor_dashboard:meet_requests_updated";

/* ===================== RULES ===================== */
const WORK_START = "08:00";
const WORK_END = "17:00";
const LUNCH_BLOCK = "12:00"; // not allowed
const PAGE_SIZE = 3;

const STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DISAPPROVED: "Disapproved",
  CANCELED: "Cancelled",
  RESCHEDULED: "Rescheduled",
};

const ALLOWED_CALENDAR_STATUSES = new Set([STATUS.APPROVED, STATUS.RESCHEDULED]);

/* ===================== STORAGE HELPERS ===================== */
function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function safeJSONParse(v, fallback) {
  try {
    return JSON.parse(v) ?? fallback;
  } catch {
    return fallback;
  }
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

/* ===================== HELPERS ===================== */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function formatDateLong(iso) {
  if (!isISODate(iso)) return iso || "—";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return iso || "—";
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function minFromHHMM(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function formatTime12(hhmm) {
  const [h0, m] = String(hhmm || "00:00").split(":").map(Number);
  const suffix = h0 >= 12 ? "PM" : "AM";
  const h = h0 % 12 === 0 ? 12 : h0 % 12;
  return `${h}:${pad2(m)} ${suffix}`;
}

function formatRange(start, end) {
  return `${formatTime12(start)} – ${formatTime12(end)}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function isWithinWorkHours(startHHMM, endHHMM) {
  const s = minFromHHMM(startHHMM);
  const e = minFromHHMM(endHHMM);
  return s >= minFromHHMM(WORK_START) && e <= minFromHHMM(WORK_END) && e > s;
}

function isLunchSlot(startHHMM) {
  return startHHMM === LUNCH_BLOCK;
}

function safeText(v) {
  if (v == null) return "";
  return String(v);
}

function buildHaystack(item) {
  return [
    item.studentName,
    item.studentId,
    item.reason,
    item.course,
    item.mode,
    item.status,
    item.date,
    item.start,
    item.end,
    item.id,
  ]
    .map(safeText)
    .join(" ")
    .toLowerCase();
}

function isPastSession(dateISO, endHHMM) {
  if (!isISODate(dateISO) || !endHHMM) return false;
  const [y, m, d] = dateISO.split("-").map(Number);
  const endMin = minFromHHMM(endHHMM);
  const dt = new Date(y, m - 1, d, Math.floor(endMin / 60), endMin % 60, 0, 0);
  return dt.getTime() < Date.now();
}

/**
 * Pagination window of 5 pages
 */
function buildPageWindow5(currentPage, totalPages) {
  const total = Math.max(1, Number(totalPages) || 1);
  const p = clamp(Number(currentPage) || 1, 1, total);
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const start = clamp(p - 4, 1, total - 4);
  return [start, start + 1, start + 2, start + 3, start + 4];
}

function coerceArray(v) {
  return Array.isArray(v) ? v : [];
}

/* MeetRequests time is "08:00 AM" etc */
function parseTime12ToHHMM(timeStr) {
  const s = String(timeStr || "").trim();
  if (!s) return "";
  if (/^\d{2}:\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return "";
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const ap = String(m[3]).toUpperCase();

  if (hh === 12) hh = 0;
  if (ap === "PM") hh += 12;

  return `${pad2(hh)}:${pad2(mm)}`;
}

function addMinutesHHMM(hhmm, deltaMin) {
  const base = minFromHHMM(hhmm);
  return toHHMM(base + deltaMin);
}

/**
 * Bridge: MeetRequests (storage) -> Calendar sessions
 * Only Approved & Rescheduled requests are included.
 */
function mapMeetRequestsToSessions(requests) {
  const list = coerceArray(requests);

  return list
    .filter((r) => {
      const st = String(r?.status || "").trim();
      return ALLOWED_CALENDAR_STATUSES.has(st);
    })
    .map((r) => {
      const date = String(r?.date || "").trim();
      const start = parseTime12ToHHMM(r?.time);
      const end = start ? addMinutesHHMM(start, 60) : "";

      const sessionType = String(r?.sessionType || r?.mode || "").toLowerCase();
      const mode = sessionType.includes("online") ? "Online" : "Face-to-Face";

      const studentObj =
        r?.userId && typeof r.userId === "object"
          ? r.userId
          : r?.studentId && typeof r.studentId === "object"
          ? r.studentId
          : r?.student && typeof r.student === "object"
          ? r.student
          : null;

      const studentName = studentObj
        ? [studentObj.firstName, studentObj.lastName].filter(Boolean).join(" ") || studentObj.fullName || studentObj.name || ""
        : "";

      const studentId = studentObj ? String(studentObj.studentNumber || studentObj.studentId || studentObj.schoolId || studentObj.idNumber || studentObj.email || "").trim() : "";
      const course = studentObj ? String(studentObj.course || studentObj.courses || studentObj.program || "").trim() : "";

      const meetingLink =
        mode === "Online"
          ? String(r?.meetingLink || r?.meetingUrl || r?.onlineMeetingLink || r?.meetLink || "").trim()
          : "";

      const done = !!r?.completedAt || String(r?.status || "").toLowerCase().includes("completed");

      return {
        id: String(r?.id || r?._id || "").trim(),
        status: String(r?.status || "").trim(),
        date,
        start,
        end,
        mode,
        studentName,
        studentId,
        course,
        reason: String(r?.reason || r?.topic || "").trim(),
        studentNotes: String(r?.notes || r?.message || ""),
        meetingLink,
        done,
      };
    })
    .filter((x) => x.id && isISODate(x.date) && x.start && x.end);
}

/* ===================== HOOKS ===================== */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);

    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    setMatches(mql.matches);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return undefined;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) document.body.style.paddingRight = `${scrollBarWidth}px`;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [locked]);
}

/* ===================== UI PIECES ===================== */
function ModePill({ mode }) {
  const online = mode === "Online";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1",
        "text-[11px] font-extrabold whitespace-nowrap",
        online ? "bg-emerald-50 text-emerald-800 border-emerald-100" : "bg-slate-50 text-slate-800 border-slate-200",
      ].join(" ")}
    >
      {online ? "Online" : "Face-to-Face"}
    </span>
  );
}

function StatusPill({ status }) {
  const s = String(status || "");
  const cls =
    s === STATUS.APPROVED
      ? "bg-emerald-50 text-emerald-900 border-emerald-100"
      : s === STATUS.RESCHEDULED
      ? "bg-blue-50 text-blue-900 border-blue-100"
      : "bg-amber-50 text-amber-900 border-amber-100";

  return (
    <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap", cls].join(" ")}>
      {s || "—"}
    </span>
  );
}

function DetailsRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 break-words sm:text-right" style={{ overflowWrap: "anywhere" }}>
        {value || "—"}
      </div>
    </div>
  );
}

/* ===================== MODAL (CENTERED DESKTOP, FULLSCREEN MOBILE) ===================== */
function ResponsiveModal({ title, onClose, children, fullScreenOnMobile = true }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 cc-fade-in">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={[
            "relative bg-white border border-slate-200 shadow-2xl cc-fade-up",
            "flex flex-col overflow-hidden",
            fullScreenOnMobile
              ? "h-[100dvh] w-[100vw] rounded-none sm:h-auto sm:w-full sm:max-w-3xl sm:rounded-2xl"
              : "w-full max-w-3xl rounded-2xl",
            "sm:max-h-[calc(100dvh-2rem)]",
          ].join(" ")}
          style={{ paddingTop: fullScreenOnMobile ? "env(safe-area-inset-top, 0px)" : undefined }}
        >
          <div className="shrink-0 bg-white/95 backdrop-blur border-b border-slate-200">
            <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-extrabold text-slate-900 truncate">{title}</div>
                <div className="text-sm text-slate-500">Press Esc or click outside to close</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-extrabold bg-white hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>

          <div
            className="flex-1 px-4 sm:px-6 py-5 overflow-y-auto"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== DETAILS CONTENT ===================== */
function DetailsContent({ item }) {
  const when = `${formatDateLong(item.date)} • ${formatRange(item.start, item.end)}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900">{item.reason}</div>
          <div className="mt-1 text-sm font-semibold text-slate-600">{when}</div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <StatusPill status={item.status} />
            <ModePill mode={item.mode} />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
          <DetailsRow label="Name" value={item.studentName} />
          <DetailsRow label="Student ID" value={item.studentId} />
          <DetailsRow label="Course" value={item.course} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="text-sm font-extrabold text-slate-900">Student Notes</div>
          <div
            className="mt-2 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed"
            style={{ maxHeight: 220, overflowY: "auto", overflowWrap: "anywhere", wordBreak: "break-word" }}
          >
            {item.studentNotes || "—"}
          </div>
        </div>

        {item.mode === "Online" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-sm font-extrabold text-slate-700">Google Meet Link</div>
            <div className="mt-1 text-sm text-slate-600" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {item.meetingLink || "—"}
            </div>
            {item.meetingLink ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={item.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="cc-focus cc-clickable inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Open link
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-sm font-extrabold text-slate-700">Scheduled</div>
            <div className="mt-1 text-sm text-slate-600">Face-to-Face session (no online link).</div>
          </div>
        )}

        <div className="text-xs font-semibold text-slate-400">Session ID: #{item.id}</div>
      </div>
    </div>
  );
}

/* ===================== MAIN ===================== */
export default function Calendar() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = lsGet(CALENDAR_SELECTED_DATE_KEY, "");
    return isISODate(saved) ? saved : todayISO();
  });

  const [view, setView] = useState("active"); // "active" | "history"
  const [search, setSearch] = useState("");

  const [meetRequests, setMeetRequests] = useState([]);


  const fetchMeetRequests = useCallback(async () => {
    try {
      const data = await apiFetch("/api/counseling/requests?type=MEET");
      const items = Array.isArray(data?.items) ? data.items : [];
      setMeetRequests(items);
    } catch {
      setMeetRequests([]);
    }
  }, []);

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);


  useEffect(() => {
    const reload = () => {
      fetchMeetRequests();
      const savedDate = lsGet(CALENDAR_SELECTED_DATE_KEY, "");
      if (isISODate(savedDate)) setSelectedDate((prev) => (prev === savedDate ? prev : savedDate));
    };

    reload();

    const onStorage = (e) => {
      if (!e?.key) return;
      if (e.key === CALENDAR_SELECTED_DATE_KEY) reload();
    };

    const onCustom = () => reload();

    if (isBrowser()) {
      window.addEventListener("storage", onStorage);
      window.addEventListener(MEET_REQUESTS_UPDATED_EVENT, onCustom);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(MEET_REQUESTS_UPDATED_EVENT, onCustom);
      };
    }

    return undefined;
  }, [fetchMeetRequests]);

  const [selectedId, setSelectedId] = useState(null);
  const detailsOpen = !!selectedId;
  useBodyScrollLock(detailsOpen);

  const [page, setPage] = useState(1);
  const prevPageRef = useRef(1);
  const [pageAnim, setPageAnim] = useState("");

  const rawSessions = useMemo(() => mapMeetRequestsToSessions(meetRequests), [meetRequests]);

  const cleaned = useMemo(() => {
    return rawSessions
      .filter((s) => {
        if (!s?.studentName || !s?.studentId) return false;
        if (!isISODate(s.date)) return false;
        if (!s.start || !s.end) return false;
        if (!isWithinWorkHours(s.start, s.end)) return false;
        if (isLunchSlot(s.start)) return false;

        const dur = minFromHHMM(s.end) - minFromHHMM(s.start);
        if (dur !== 60) return false;

        if (s.mode !== "Online" && s.mode !== "Face-to-Face") return false;
        return true;
      })
      .map((s) => ({ ...s, _hay: buildHaystack(s) }));
  }, [rawSessions]);

  const effective = useMemo(
    () =>
      cleaned.map((s) => ({
        ...s,
        _effectiveDone: s.done || isPastSession(s.date, s.end),
      })),
    [cleaned, nowTick]
  );

  const currentListAll = useMemo(() => {
    const base = effective.filter((s) => (view === "history" ? s._effectiveDone : !s._effectiveDone));

    const dayList = base
      .filter((s) => s.date === selectedDate)
      .sort((a, b) => minFromHHMM(a.start) - minFromHHMM(b.start));

    const q = search.trim().toLowerCase();
    if (!q) return dayList;
    return dayList.filter((s) => (s._hay || "").includes(q));
  }, [effective, view, selectedDate, search]);

  useEffect(() => setPage(1), [selectedDate, view, search]);

  const totalPages = Math.max(1, Math.ceil(currentListAll.length / PAGE_SIZE));
  const safePage = clamp(page, 1, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(currentListAll.length, startIdx + PAGE_SIZE);
  const currentPageItems = currentListAll.slice(startIdx, startIdx + PAGE_SIZE);

  useEffect(() => {
    if (prevPageRef.current === safePage) return;
    const dir = safePage > prevPageRef.current ? "in-right" : "in-left";
    prevPageRef.current = safePage;
    setPageAnim(dir);
    const t = setTimeout(() => setPageAnim(""), 220);
    return () => clearTimeout(t);
  }, [safePage]);

  const pageWindow = useMemo(() => buildPageWindow5(safePage, totalPages), [safePage, totalPages]);

  const selected = useMemo(() => {
    const pool = effective.filter((s) => (view === "history" ? s._effectiveDone : !s._effectiveDone));
    return pool.find((x) => x.id === selectedId) || null;
  }, [effective, view, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (!selected) setSelectedId(null);
  }, [selected, selectedId]);

  const openDetails = useCallback((item) => setSelectedId(item.id), []);
  const closeDetails = useCallback(() => setSelectedId(null), []);

  const historyActive = view === "history";
  const hasSessions = rawSessions.length > 0;

  return (
    <div className="space-y-4 w-full px-3 sm:px-0 max-w-none">
      <GlobalStyles />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900">Calendar / Schedule</h2>
            <p className="mt-1 text-sm sm:text-base font-medium text-slate-600">
              {historyActive ? "History" : "Sessions"} • Approved/Rescheduled only • 8:00 AM – 5:00 PM • 1 hour • 12:00 NN unavailable
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedDate(next);
              if (isISODate(next)) lsSet(CALENDAR_SELECTED_DATE_KEY, next);
            }}
            className={[
              "h-11 w-full sm:w-auto rounded-xl border border-slate-200 bg-white",
              "px-3 text-sm font-semibold text-slate-800",
              "outline-none focus:outline-none focus:ring-0",
            ].join(" ")}
            aria-label="Select date"
          />

          <button
            type="button"
            onClick={() => setView((v) => (v === "history" ? "active" : "history"))}
            className={[
              "h-11 w-full sm:w-auto px-5 rounded-xl text-sm font-extrabold border transition",
              historyActive ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800" : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            History
          </button>
        </div>

        <div className="mt-4">
          <div className="relative w-full">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, student ID, reason, course, status…"
              className={[
                "w-full h-11 rounded-xl border border-slate-200 bg-white px-3 pr-10",
                "text-sm sm:text-base font-medium text-slate-900",
                "outline-none focus:outline-none focus:ring-0",
              ].join(" ")}
              aria-label="Search sessions"
              autoComplete="off"
              inputMode="search"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 px-2 py-1 rounded-lg"
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>

          <div className="mt-2 text-sm font-medium text-slate-600">
            {currentListAll.length ? (
              <>
                Showing <span className="text-slate-900">{startIdx + 1}</span>–<span className="text-slate-900">{endIdx}</span> of{" "}
                <span className="text-slate-900">{currentListAll.length}</span>
              </>
            ) : (
              "No sessions found."
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="text-sm font-extrabold text-slate-700">
            {historyActive ? "History on " : "Sessions on "}
            <span className="text-slate-500 font-black">{formatDateLong(selectedDate)}</span>
          </div>
        </div>

        <div className="p-4">
          {currentListAll.length === 0 ? (
            <div className="text-sm font-semibold text-slate-500">
              {!hasSessions
                ? "No Approved/Rescheduled meet requests yet."
                : historyActive
                ? "No history sessions for this date."
                : "No sessions scheduled for this date."}
            </div>
          ) : (
            <div className={["space-y-3", pageAnim === "in-right" ? "cc-page-in-right" : "", pageAnim === "in-left" ? "cc-page-in-left" : ""].join(" ")}>
              {currentPageItems.map((s) => {
                const title = `${s.reason} • ${formatRange(s.start, s.end)}`;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openDetails(s)}
                    className={[
                      "w-full text-left rounded-2xl border border-slate-200 bg-white p-4 transition",
                      "hover:bg-slate-50 hover:border-slate-300",
                      "cc-focus cc-clickable",
                    ].join(" ")}
                    aria-label={`Open session ${s.id}`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
                      <div className="min-w-0">
                        <div className="text-sm sm:text-base font-extrabold text-slate-900">
                          <span className="break-words">{title}</span>
                        </div>

                        <div className="mt-1 text-xs sm:text-sm font-semibold text-slate-600 flex flex-wrap gap-x-2 gap-y-1">
                          <span className="font-extrabold text-slate-700">{s.studentName}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold break-words">{s.course}</span>
                        </div>
                      </div>

                      <div className="justify-self-start sm:justify-self-end flex flex-row sm:flex-col items-center sm:items-end gap-2">
                        <StatusPill status={s.status} />
                        <ModePill mode={s.mode} />
                        <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap">#{s.id}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {currentListAll.length > 0 && totalPages > 1 ? (
            <div className="mt-5 flex flex-col items-center gap-2">
              {isMobile ? (
                <div className="flex w-full items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                    disabled={safePage <= 1}
                    className="cc-focus cc-clickable px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Prev
                  </button>

                  <div className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 whitespace-nowrap">
                    {safePage} / {totalPages}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                    disabled={safePage >= totalPages}
                    className="cc-focus cc-clickable px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
                      disabled={safePage <= 1}
                      className="cc-focus cc-clickable px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Prev
                    </button>

                    {pageWindow.map((x) => (
                      <button
                        key={`p-${x}`}
                        type="button"
                        onClick={() => setPage(x)}
                        className={[
                          "cc-focus cc-clickable px-3 py-2 rounded-xl border text-sm font-extrabold",
                          x === safePage ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                        aria-current={x === safePage ? "page" : undefined}
                      >
                        {x}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
                      disabled={safePage >= totalPages}
                      className="cc-focus cc-clickable px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>

                  <div className="text-xs font-semibold text-slate-500">
                    Page <span className="text-slate-900 font-extrabold">{safePage}</span> /{" "}
                    <span className="text-slate-900 font-extrabold">{totalPages}</span>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {selected ? (
        <ResponsiveModal title="Session details" onClose={closeDetails} fullScreenOnMobile>
          <DetailsContent item={selected} />
        </ResponsiveModal>
      ) : null}
    </div>
  );
}

/* ===================== GLOBAL STYLES ===================== */
function GlobalStyles() {
  return <style>{STYLE}</style>;
}

const STYLE = `
  .cc-focus:focus-visible{
    outline: none;
    box-shadow: 0 0 0 4px rgba(15,23,42,0.08);
  }
  @media (prefers-reduced-motion: reduce){
    * { animation: none !important; transition: none !important; }
  }
  @keyframes ccFadeRight { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes ccFadeLeft  { from { opacity: 0; transform: translateX(-10px);} to { opacity: 1; transform: translateX(0); } }
  .cc-page-in-right{ animation: ccFadeRight 220ms ease-out; }
  .cc-page-in-left{ animation: ccFadeLeft 220ms ease-out; }
  @keyframes ccFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ccFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .cc-fade-in { animation: ccFadeIn 180ms ease-out; }
  .cc-fade-up { animation: ccFadeUp 220ms ease-out; }
  .cc-clickable:active { transform: scale(0.99); }
  .cc-clickable { transition: transform 140ms ease, background-color 140ms ease, box-shadow 140ms ease; }
`;
