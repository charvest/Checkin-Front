// src/pages/CounselorDashboard/Sections/Availability.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../../api/apiFetch";

const TEXT_MAIN = "#0f172a";
const TEXT_MUTED = "#64748b";
const BRAND = "#B9FF66";

function Badge({ tone = "slate", children }) {
  const bg =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : tone === "red"
      ? "bg-rose-100 text-rose-800"
      : "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-[Nunito] font-extrabold ${bg}`}>
      {children}
    </span>
  );
}

function Button({ variant = "outline", size = "sm", className = "", ...props }) {
  const base = "inline-flex items-center justify-center font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed";
  const sizing = size === "sm" ? "h-9 px-3 rounded-xl text-xs" : "h-11 px-4 rounded-2xl text-sm";

  const solid = "bg-slate-900 text-white hover:opacity-90";
  const outline = "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50";
  const soft = "bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100";

  const style = variant === "soft" ? soft : variant === "solid" ? solid : outline;
  return <button className={[base, sizing, style, className].join(" ")} {...props} />;
}

function SegmentedPills({ value, options, onChange, className = "" }) {
  return (
    <div className={["inline-flex w-full p-1 rounded-xl bg-white border border-slate-200", className].join(" ")}>
      {options.map((opt) => {
        const active = String(opt.value) === String(value);
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(opt.value)}
            className={[
              "flex-1 h-9 rounded-lg text-[12px] font-[Nunito] font-extrabold transition",
              active ? "bg-slate-900 text-white" : "bg-transparent text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}


function clampPage(page, totalPages) {
  if (totalPages <= 1) return 1;
  return Math.min(Math.max(1, page), totalPages);
}

function PaginationBar({ page, totalPages, onPage }) {
  if (totalPages < 2) return null;

  const go = (p) => onPage(Math.min(totalPages, Math.max(1, p)));

  const getPages = () => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const half = Math.floor(maxButtons / 2);
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

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function useIsMobileSm() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!isBrowser()) return undefined;
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(!!mq.matches);
    onChange();
    try {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    } catch {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, []);

  return isMobile;
}

// Match MeetRequests modal behavior (no background scroll + restore scroll position)
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

function isoLocal(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt || "");
  }
}

// "Date of leave" display helpers (Asia/Manila)
// - Full day: show date(s) only
// - Custom hours: show date + time range
function toPHDateISOFromDT(dt) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // YYYY-MM-DD
  } catch {
    return "";
  }
}

function prettyPHDateFromISO(iso) {
  if (!iso) return "—";
  try {
    return new Date(`${iso}T12:00:00+08:00`).toLocaleDateString("en-US", { timeZone: "Asia/Manila" });
  } catch {
    return iso;
  }
}

function prettyPHDateFromDT(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleDateString("en-US", { timeZone: "Asia/Manila" });
  } catch {
    return String(dt);
  }
}

function prettyPHTimeFromDT(dt) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleTimeString("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(dt);
  }
}

function addDaysISO(iso, deltaDays) {
  if (!iso) return "";
  try {
    const d = new Date(`${iso}T12:00:00+08:00`);
    d.setUTCDate(d.getUTCDate() + Number(deltaDays || 0));
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  } catch {
    return iso;
  }
}

function isMidnightPH(dt) {
  if (!dt) return false;
  try {
    const t = new Date(dt).toLocaleTimeString("en-US", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return t === "00:00";
  } catch {
    return false;
  }
}

function leaveDateLabel(item) {
  if (!item?.startAt) return "—";

  const allDay = Boolean(item?.allDay) || (isMidnightPH(item?.startAt) && isMidnightPH(item?.endAt));

  if (allDay) {
    const startISO = toPHDateISOFromDT(item?.startAt);
    const endExISO = toPHDateISOFromDT(item?.endAt);
    if (!startISO) return "—";
    let endInclISO = endExISO ? addDaysISO(endExISO, -1) : startISO;
    if (!endInclISO || endInclISO < startISO) endInclISO = startISO;

    if (endInclISO === startISO) return prettyPHDateFromISO(startISO);
    return `${prettyPHDateFromISO(startISO)} – ${prettyPHDateFromISO(endInclISO)}`;
  }

  const sDate = prettyPHDateFromDT(item?.startAt);
  const eDate = prettyPHDateFromDT(item?.endAt);
  const sTime = prettyPHTimeFromDT(item?.startAt);
  const eTime = prettyPHTimeFromDT(item?.endAt);

  if (toPHDateISOFromDT(item?.startAt) === toPHDateISOFromDT(item?.endAt)) {
    return `${sDate} (${sTime}–${eTime})`;
  }
  return `${sDate} ${sTime} – ${eDate} ${eTime}`;
}

/* ===================== MeetRequests-style Modal UI ===================== */
function MRBadge({ children, className = "" }) {
  return (
    <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold bg-slate-50 text-slate-700 border-slate-200", className].join(" ")}>
      {children}
    </span>
  );
}

function MRButton({ variant = "solid", size = "md", className = "", ...props }) {
  const base = "inline-flex items-center justify-center font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed";
  const sizing = size === "sm" ? "h-9 px-3 rounded-xl text-xs" : "h-11 px-4 rounded-2xl text-sm";
  const solid = "bg-slate-800 text-white hover:bg-slate-900";
  const soft = "bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100";
  const outline = "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50";
  const style = variant === "soft" ? soft : variant === "outline" ? outline : solid;
  return <button className={[base, sizing, style, className].join(" ")} {...props} />;
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
      className={["fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center", "p-0 sm:p-4", zClass].join(" ")}
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

function SheetGrabber({ dragHandleProps }) {
  return (
    <div {...dragHandleProps} className="sm:hidden flex flex-col items-center gap-2 pt-3 pb-2 select-none" style={{ touchAction: "none" }}>
      <div className="h-1.5 w-12 rounded-full bg-slate-200" />
    </div>
  );
}

function useSheetDragClose({ enabled, onClose }) {
  const isMobile = useIsMobileSm();
  const active = enabled && isMobile;

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const ref = useRef({ pointerId: null, startY: 0, startTime: 0, lastY: 0, lastTime: 0 });

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

  const sheetStyle = active
    ? { transform: `translateY(${dragY}px)`, transition: dragging ? "none" : "transform 180ms ease-out", willChange: "transform" }
    : undefined;

  return {
    sheetStyle,
    dragHandleProps: active ? { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish } : {},
  };
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

export default function Availability() {
  const PAGE_SIZE = 6;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(1);

  const [msg, setMsg] = useState({ tone: "", text: "" });

  // Cancellation request UI (counselor)
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelErr, setCancelErr] = useState("");

  // Request form
  const [date, setDate] = useState("");
  const [multiDays, setMultiDays] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [type, setType] = useState("Leave");
  const [note, setNote] = useState("");

  // Prevent selecting past dates (Asia/Manila)
  const todayISO = useMemo(() => {
    try {
      return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    } catch {
      // Fallback: local ISO date
      return new Date().toISOString().slice(0, 10);
    }
  }, []);

  const endMinISO = useMemo(() => {
    if (!multiDays) return todayISO;
    const d = String(date || "").trim();
    const isISO = /^\d{4}-\d{2}-\d{2}$/.test(d);
    if (isISO && d > todayISO) return d;
    return todayISO;
  }, [multiDays, date, todayISO]);

  // Block selecting past dates and weekend endpoints (Asia/Manila calendar day)
  const handleStartDateChange = (val) => {
    setMsg({ tone: "", text: "" });
    if (!val) {
      setDate("");
      return;
    }
    if (String(val) < String(todayISO)) {
      setMsg({ tone: "red", text: "You can’t select past dates. Please choose today or a future date." });
      return;
    }
    if (isWeekendPH(String(val))) {
      setMsg({ tone: "red", text: "Weekends are not selectable. Please pick a weekday (Mon–Fri)." });
      return;
    }
    setDate(String(val));
  };

  const handleEndDateChange = (val) => {
    setMsg({ tone: "", text: "" });
    if (!val) {
      setEndDate("");
      return;
    }
    const v = String(val);
    if (v < String(todayISO)) {
      setMsg({ tone: "red", text: "You can’t select past dates. Please choose today or a future date." });
      return;
    }
    if (isWeekendPH(v)) {
      setMsg({ tone: "red", text: "Weekends are not selectable. Please pick a weekday (Mon–Fri)." });
      return;
    }
    setEndDate(v);
  };


  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await apiFetch("/api/counseling/blocks/mine");
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
    } catch (e) {
      setErr(e?.message || "Failed to load availability blocks.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sortedItems = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => new Date(b?.startAt || 0).getTime() - new Date(a?.startAt || 0).getTime());
  }, [items]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE)), [sortedItems.length]);
  const safePage = useMemo(() => clampPage(page, totalPages), [page, totalPages]);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  // Reset to first page when the list changes significantly
  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sortedItems.slice(start, end);
  }, [sortedItems, safePage]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return items.find((x) => String(x?._id || x?.id || "") === String(selectedId)) || null;
  }, [items, selectedId]);

  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  useEffect(() => {
    // Reset cancel UI when changing selected
    setCancelReason("");
    setCancelErr("");
    setCancelBusy(false);
  }, [selectedId]);

  const pendingCount = useMemo(() => items.filter((x) => String(x.status) === "Pending").length, [items]);

  function notePreview(v, max = 90) {
    const s = String(v || "").trim();
    if (!s) return "—";
    if (s.length <= max) return s;
    return s.slice(0, max).trimEnd() + "…";
  }

  function rangeShort(b) {
    const s = isoLocal(b?.startAt);
    const e = isoLocal(b?.endAt);
    return `${s} → ${e}`;
  }


  const MAX_DAYS_PER_REQUEST = 5;

  function phDateObj(iso) {
    // Pin to Asia/Manila calendar day by using +08:00 offset.
    try {
      return new Date(`${iso}T12:00:00+08:00`);
    } catch {
      return new Date("invalid");
    }
  }

  function isWeekendPH(iso) {
    const d = phDateObj(iso);
    if (Number.isNaN(d.getTime())) return false;
    const dow = d.getUTCDay(); // Sunday=0 ... Saturday=6 (PH day because pinned offset)
    return dow === 0 || dow === 6;
  }

  function enumerateRangeDates(startISO, endISO) {
    const start = phDateObj(startISO);
    const end = phDateObj(endISO);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    if (end.getTime() < start.getTime()) return [];
    const out = [];
    const cur = new Date(start);
    let guard = 0;
    while (cur.getTime() <= end.getTime() && guard < 370) {
      out.push(cur.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })); // YYYY-MM-DD
      cur.setUTCDate(cur.getUTCDate() + 1);
      guard += 1;
    }
    return out;
  }

  const selection = useMemo(() => {
    const start = String(date || "").trim();
    if (!multiDays) {
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(start);
      const weekend = ok && isWeekendPH(start);
      return {
        mode: "single",
        start,
        end: "",
        dates: ok ? [start] : [],
        weekdays: ok && !weekend ? [start] : [],
        skippedWeekends: weekend ? [start] : [],
        invalid: start && !ok,
        rangeInvalid: false,
      };
    }

    const end = String(endDate || "").trim();
    const okStart = /^\d{4}-\d{2}-\d{2}$/.test(start);
    const okEnd = /^\d{4}-\d{2}-\d{2}$/.test(end);

    if (!okStart || !okEnd) {
      return {
        mode: "range",
        start,
        end,
        dates: [],
        weekdays: [],
        skippedWeekends: [],
        invalid: (start && !okStart) || (end && !okEnd),
        rangeInvalid: false,
      };
    }

    const datesAll = enumerateRangeDates(start, end);
    if (!datesAll.length) {
      return {
        mode: "range",
        start,
        end,
        dates: [],
        weekdays: [],
        skippedWeekends: [],
        invalid: false,
        rangeInvalid: true,
      };
    }

    const skippedWeekends = datesAll.filter((d) => isWeekendPH(d));
    const weekdays = datesAll.filter((d) => !isWeekendPH(d));

    return {
      mode: "range",
      start,
      end,
      dates: datesAll,
      weekdays,
      skippedWeekends,
      invalid: false,
      rangeInvalid: false,
    };
  }, [multiDays, date, endDate]);

  useEffect(() => {
    // Keep end date stable to avoid layout shift and confusing validation.
    // Single-day mode: endDate mirrors date (disabled in UI).
    if (!multiDays) {
      if (date && endDate !== date) setEndDate(date);
      if (!date && endDate) setEndDate("");
      return;
    }

    // Range mode: default endDate to start date if empty.
    if (date && !endDate) setEndDate(date);
  }, [multiDays, date, endDate]);


    const submit = async () => {
    setMsg({ tone: "", text: "" });
    setErr("");

    const weekdaysCount = selection.weekdays.length;

    if (!selection.start) {
      setMsg({ tone: "red", text: "Please choose a date." });
      return;
    }
    if (selection.invalid) {
      setMsg({ tone: "red", text: "Invalid date format. Please use YYYY-MM-DD." });
      return;
    }

    // Block past dates (Asia/Manila calendar day)
    const hasPast = Array.isArray(selection.dates) && selection.dates.some((d) => typeof d === "string" && d && d < todayISO);
    if (hasPast) {
      setMsg({ tone: "red", text: "You can’t request leave for past dates. Please choose today or a future date." });
      return;
    }
    if (multiDays) {
      if (!selection.end) {
        setMsg({ tone: "red", text: "Please choose an end date." });
        return;
      }
      if (selection.rangeInvalid) {
        setMsg({ tone: "red", text: "Invalid date range. End date must be on or after the start date." });
        return;
      }
    }

    if (!weekdaysCount) {
      setMsg({ tone: "red", text: "Weekends are skipped. Please include at least one weekday." });
      return;
    }

    if (weekdaysCount > MAX_DAYS_PER_REQUEST) {
      setMsg({ tone: "red", text: `You can only request up to ${MAX_DAYS_PER_REQUEST} weekday(s) per submission.` });
      return;
    }

    const cleanNote = String(note || "").trim();
    if (weekdaysCount >= 3 && !cleanNote) {
      setMsg({ tone: "red", text: "Please provide a note/reason when requesting 3 or more days." });
      return;
    }

    if (!allDay && (!startTime || !endTime)) {
      setMsg({ tone: "red", text: "Please set start and end time." });
      return;
    }

    const basePayload = {
      allDay: !!allDay,
      startTime: allDay ? "00:00" : startTime,
      endTime: allDay ? "00:00" : endTime,
      type,
      note: cleanNote,
    };

    const payload = multiDays
      ? { startDate: selection.start, endDate: selection.end, ...basePayload }
      : { date: selection.start, ...basePayload };

    try {
      const data = await apiFetch("/api/counseling/blocks/request", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdCount = Array.isArray(data?.items) ? data.items.length : 1;
      const skipped = Array.isArray(selection.skippedWeekends) ? selection.skippedWeekends.length : 0;

      setMsg({
        tone: "green",
        text: `Request submitted for ${createdCount} day(s). Waiting for admin approval.${skipped ? " (Weekends were skipped.)" : ""}`,
      });

      setDate("");
      setEndDate("");
      setMultiDays(false);
      setAllDay(true);
      setStartTime("08:00");
      setEndTime("17:00");
      setType("Leave");
      setNote("");
      await load();
    } catch (e) {
      setErr(e?.message || "Failed to submit request.");
    }
  };

  const requestCancel = async () => {
    if (!selected) return;
    const id = String(selected?._id || selected?.id || "");
    if (!id) return;

    setCancelErr("");
    setMsg({ tone: "", text: "" });

    setCancelBusy(true);
    try {
      await apiFetch(`/api/counseling/blocks/${id}/cancel-request`, {
        method: "PATCH",
        body: JSON.stringify({ reason: String(cancelReason || "").trim() }),
      });

      setMsg({ tone: "green", text: "Cancellation requested. Waiting for admin decision." });
      setCancelReason("");
      await load();
    } catch (e) {
      setCancelErr(e?.message || "Failed to request cancellation.");
    } finally {
      setCancelBusy(false);
    }
  };

  const modalOpen = !!selected;
  const closeDetails = useCallback(() => setSelectedId(null), []);
  const drag = useSheetDragClose({ enabled: true, onClose: closeDetails });

  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      <style>{`
        .avail-scroll{
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        .avail-list-pad{ padding-bottom: 84px; }
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
      `}</style>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[18px] sm:text-[20px] font-[Nunito] font-extrabold" style={{ color: TEXT_MAIN }}>
              Availability
            </div>
            <div className="mt-1 text-[13.5px] font-[Lora]" style={{ color: TEXT_MUTED }}>
              View your approved blocks and request leave or unavailability. Admin approves requests.
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pendingCount ? <Badge tone="amber">{pendingCount} pending</Badge> : <Badge>Up to date</Badge>}
            <span className="inline-flex items-center w-2 h-2 rounded-full" style={{ background: BRAND }} />
          </div>
        </div>

        {msg?.text ? (
          <div
            className={`mt-4 rounded-xl px-3 py-3 text-[13px] font-[Nunito] font-bold ${
              msg.tone === "green"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {msg.text}
          </div>
        ) : null}

        {err ? (
          <div className="mt-4 rounded-xl px-3 py-3 text-[13px] font-[Nunito] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            {err}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
  {/* WHEN */}
  <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[13px] font-[Nunito] font-extrabold text-slate-700">When</div>
      <div className="flex items-center gap-2">
        <Badge>{selection.weekdays.length} weekday(s)</Badge>
        {selection.skippedWeekends.length ? <Badge tone="amber">{selection.skippedWeekends.length} weekend(s) skipped</Badge> : null}
      </div>
    </div>

    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <div className="text-[12px] font-[Nunito] font-extrabold text-slate-600">Start date</div>
        <input
          type="date"
          min={todayISO}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] font-[Nunito] font-bold outline-none focus:ring-2 focus:ring-slate-300"
          value={date}
          onChange={(e) => handleStartDateChange(e.target.value)}
        />
      </div>

      <div>
        <div className="text-[12px] font-[Nunito] font-extrabold text-slate-600">End date</div>
        <input
          type="date"
          disabled={!multiDays}
          min={endMinISO}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] font-[Nunito] font-bold outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          value={endDate}
          onChange={(e) => handleEndDateChange(e.target.value)}
        />
        {!multiDays ? (
          <div className="mt-1 text-[11px] font-[Nunito] font-bold text-slate-500">
            End date follows start date. Choose <span className="font-black">Date range</span> to enable.
          </div>
        ) : null}
      </div>
    </div>

    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <div className="text-[12px] font-[Nunito] font-extrabold text-slate-600">Date span</div>
        <div className="mt-2">
          <SegmentedPills
            value={multiDays ? "range" : "single"}
            onChange={(v) => setMultiDays(String(v) === "range")}
            options={[
              { value: "single", label: "Single day" },
              { value: "range", label: "Date range" },
            ]}
          />
        </div>
        <div className="mt-1 text-[11px] font-[Nunito] font-bold text-slate-500">
          {multiDays ? "Request will be expanded per weekday." : "Creates a single-day request."}
        </div>
      </div>

      <div>
        <div className="text-[12px] font-[Nunito] font-extrabold text-slate-600">Duration</div>
        <div className="mt-2">
          <SegmentedPills
            value={allDay ? "full" : "custom"}
            onChange={(v) => setAllDay(String(v) === "full")}
            options={[
              { value: "full", label: "Full day" },
              { value: "custom", label: "Custom hours" },
            ]}
          />
        </div>
        <div className="mt-1 text-[11px] font-[Nunito] font-bold text-slate-500">
          {allDay ? "Time inputs are optional and will be ignored." : "Time range will be applied to the request."}
        </div>
      </div>
    </div>

  </div>

  {/* DETAILS */}
  <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="text-[13px] font-[Nunito] font-extrabold text-slate-700">Details</div>

    <div className="mt-3">
      <div className="text-[12px] font-[Nunito] font-extrabold text-slate-600">Type</div>
      <select
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] font-[Nunito] font-bold outline-none focus:ring-2 focus:ring-slate-300"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="Leave">Leave</option>
        <option value="Unavailable">Unavailable</option>
        <option value="Event">Event</option>
      </select>
    </div>

    <div className="mt-3">
      <div className="text-[12px] font-[Nunito] font-extrabold text-slate-600">Time range</div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[12px] font-[Nunito] font-extrabold text-slate-600">Start</div>
          <input
            type="time"
            disabled={allDay}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] font-[Nunito] font-bold outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

        <div>
          <div className="text-[12px] font-[Nunito] font-extrabold text-slate-600">End</div>
          <input
            type="time"
            disabled={allDay}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[14px] font-[Nunito] font-bold outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      {allDay ? (
        <div className="mt-2 text-[11px] font-[Nunito] font-bold text-slate-500">
          Full day selected — time inputs are disabled.
        </div>
      ) : null}
    </div>

    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-[12px] font-[Nunito] font-extrabold text-slate-600">Summary</div>
      <div className="mt-1 text-[12px] font-[Nunito] font-bold text-slate-700">
        {multiDays ? "Date range" : "Single day"} • {allDay ? "Full day" : `${startTime}–${endTime}`} • {type}
      </div>
    </div>
  </div>
</div>

        <div className="mt-4">
          <div className="text-[13px] font-[Nunito] font-extrabold text-slate-700">{selection.weekdays.length >= 3 ? "Note (required for 3+ weekdays)" : "Note (optional)"}</div>
          <textarea
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] font-[Nunito] font-bold outline-none focus:ring-2 focus:ring-slate-300"
            value={note}
            onChange={(e) => setNote(e.target.value)}
           placeholder="Add a short reason (helps admin review faster)" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[13px] font-[Nunito] font-extrabold hover:opacity-90 disabled:opacity-60"
            onClick={submit}
            disabled={loading}
          >
            Submit request
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-[13px] font-[Nunito] font-extrabold hover:bg-slate-50 disabled:opacity-60"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 flex-1 min-h-0 overflow-hidden">
        <div className="text-[15px] font-[Nunito] font-extrabold" style={{ color: TEXT_MAIN }}>
          My blocks
        </div>
        <div className="mt-1 text-[13px] font-[Lora]" style={{ color: TEXT_MUTED }}>
          Approved blocks affect student availability. Pending blocks are waiting for admin approval.
        </div>

        <div className="mt-4 avail-scroll no-scrollbar pr-1">
          {loading ? (
            <div className="text-[13px] font-[Nunito] font-bold text-slate-600">Loading…</div>
          ) : sortedItems.length === 0 ? (
            <div className="text-[13px] font-[Nunito] font-bold text-slate-600">No blocks yet.</div>
          ) : (
            <>
              <div className="avail-list-pad space-y-3">
                {pageItems.map((b) => {
                  const id = String(b?._id || b?.id || "");
                  const status = String(b?.status || "Pending");
                  const cancelReq = !!b?.cancelRequestedAt && status !== "Cancelled";

                  const tone =
                    status === "Approved" ? "green" : status === "Rejected" || status === "Cancelled" ? "red" : "amber";

                  return (
                    <button
                      key={id || Math.random()}
                      type="button"
                      onClick={() => setSelectedId(id)}
                      className="w-full text-left rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 px-4 py-4 sm:px-6 sm:py-5 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[14px] sm:text-[15px] font-[Nunito] font-extrabold text-slate-900 truncate">
                              {String(b?.type || "Unavailable")}
                            </span>
                            <span className="text-slate-400 font-black">•</span>
                            <span className="text-[13px] sm:text-[14px] font-[Nunito] font-extrabold text-slate-600 truncate">
                              {rangeShort(b)}
                            </span>
                          </div>
                          <div className="mt-2 text-[12.5px] font-[Nunito] font-bold text-slate-600 break-words">
                            {notePreview(b?.note)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {cancelReq ? <Badge tone="amber">Cancel requested</Badge> : null}
                          <Badge tone={tone}>{status}</Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pagination-sticky">
                <PaginationBar page={safePage} totalPages={totalPages} onPage={(p) => setPage(p)} />
              </div>
            </>
          )}
        </div>
      </div>

      <ModalShell open={modalOpen} onClose={closeDetails}>
        {selected ? (
          (() => {
            const status = String(selected?.status || "Pending");
            const tone = status === "Approved" ? "green" : status === "Rejected" || status === "Cancelled" ? "red" : "amber";
            const cancelPending = !!selected?.cancelRequestedAt && status !== "Cancelled";
            const cancelRejected = !!selected?.cancelRejectedAt && !selected?.cancelRequestedAt && status !== "Cancelled";
            const cancelled = status === "Cancelled";

            const canRequestCancel = !cancelled && ["Pending", "Approved"].includes(status) && !cancelPending;
            const title = "Block details";
            const subtitle = leaveDateLabel(selected);

            const infoItems = [
              { label: "Type", value: String(selected?.type || "Unavailable") },
              { label: "Status", value: status },
              { label: "Date of leave", value: subtitle },
              { label: "Submitted", value: isoLocal(selected?.createdAt || selected?.updatedAt) },
              { label: "Last updated", value: isoLocal(selected?.updatedAt || selected?.createdAt) },
            ];

            const statusBadge =
              tone === "green"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : tone === "red"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-amber-200 bg-amber-50 text-amber-900";

            return (
              <ModalCard sheet className="sm:max-w-[880px]">
                <SheetGrabber dragHandleProps={drag.dragHandleProps} />

                <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-white">
                  <div className="space-y-2">
                    <div className="text-base sm:text-lg font-black text-slate-900 truncate">{title}</div>
                    <div className="text-sm font-bold text-slate-600 truncate">{subtitle}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <MRBadge className={statusBadge}>{status}</MRBadge>
                      {cancelPending ? <MRBadge className="border-amber-200 bg-amber-50 text-amber-900">Cancel requested</MRBadge> : null}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 bg-slate-50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card title="Note" className="lg:col-span-2">
                      <div className="notes-scroll text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">
                        {String(selected?.note || "").trim() || "—"}
                      </div>
                    </Card>

                    <Card title="Info">
                      <KVGrid items={infoItems} />
                    </Card>

                    {status === "Rejected" ? (
                      <Card title="Rejection">
                        <div className="text-[12.5px] font-bold text-slate-600">Rejected: {isoLocal(selected?.rejectedAt)}</div>
                        {String(selected?.rejectionReason || "").trim() ? (
                          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[12.5px] font-bold text-rose-900 whitespace-pre-wrap break-words">
                            {String(selected?.rejectionReason || "").trim()}
                          </div>
                        ) : (
                          <div className="mt-2 text-[12.5px] font-bold text-slate-600">No rejection reason provided.</div>
                        )}
                      </Card>
                    ) : null}

                    <Card title="Cancellation" className="lg:col-span-1">
                      {cancelled ? (
                        <div className="text-sm font-semibold text-slate-800">
                          This block was <span className="font-black">cancelled</span> by Admin.
                          <div className="mt-2 text-[12.5px] font-bold text-slate-600">Approved: {isoLocal(selected?.cancelApprovedAt)}</div>
                          {String(selected?.cancelReason || "").trim() ? (
                            <div className="mt-2 text-[12.5px] font-bold text-slate-700 whitespace-pre-wrap break-words">Reason: {String(selected?.cancelReason || "").trim()}</div>
                          ) : null}
                        </div>
                      ) : cancelPending ? (
                        <div>
                          <div className="text-sm font-black text-slate-800">Cancel requested</div>
                          <div className="mt-1 text-[12.5px] font-bold text-slate-600">Requested: {isoLocal(selected?.cancelRequestedAt)}</div>
                          {String(selected?.cancelReason || "").trim() ? (
                            <div className="mt-2 text-[12.5px] font-bold text-slate-700 whitespace-pre-wrap break-words">Reason: {String(selected?.cancelReason || "").trim()}</div>
                          ) : null}
                          <div className="mt-2 text-[12.5px] font-bold text-slate-500">Waiting for admin decision.</div>
                        </div>
                      ) : (
                        <>
                          {cancelRejected ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3">
                              <div className="text-sm font-black text-rose-900">Cancellation rejected</div>
                              <div className="mt-1 text-[12.5px] font-bold text-rose-800">Rejected: {isoLocal(selected?.cancelRejectedAt)}</div>
                              {String(selected?.cancelRejectionReason || "").trim() ? (
                                <div className="mt-2 text-[12.5px] font-bold text-rose-900 whitespace-pre-wrap break-words">Reason: {String(selected?.cancelRejectionReason || "").trim()}</div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="text-[12.5px] font-bold text-slate-600">No cancellation request yet.</div>
                          )}

                          <div className="mt-3">
                            <div className="text-xs font-bold text-slate-500">Reason (optional)</div>
                            <textarea
                              rows={3}
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              placeholder="Why do you want to cancel this block?"
                            />
                            {cancelErr ? (
                              <div className="mt-2 rounded-2xl px-3 py-3 text-sm font-semibold bg-rose-50 text-rose-800 border border-rose-200">{cancelErr}</div>
                            ) : null}
                            <div className="mt-2 text-xs font-bold text-slate-500">Admin will review the cancellation request.</div>
                          </div>
                        </>
                      )}
                    </Card>
                  </div>
                </div>

                <div className="shrink-0 px-4 sm:px-6 py-4 border-t border-slate-200 bg-white">
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <MRButton variant="soft" className="w-full sm:w-auto order-3 sm:order-1" onClick={closeDetails}>
                      Close
                    </MRButton>
                    <MRButton
                      variant="soft"
                      className="w-full sm:w-auto order-2 sm:order-2"
                      onClick={() => setCancelReason("")}
                      disabled={cancelBusy || cancelled || cancelPending}
                      title={cancelPending || cancelled ? "No changes allowed while cancellation is pending / already cancelled." : ""}
                    >
                      Clear reason
                    </MRButton>
                    <MRButton
                      className="w-full sm:w-auto order-1 sm:order-3"
                      onClick={requestCancel}
                      disabled={!canRequestCancel || cancelBusy}
                      title={!canRequestCancel ? "Only Pending/Approved blocks can be cancelled." : ""}
                    >
                      {cancelRejected ? "Request cancellation again" : "Request cancellation"}
                    </MRButton>
                  </div>
                </div>
              </ModalCard>
            );
          })()
        ) : null}
      </ModalShell>
    </div>
  );
}
