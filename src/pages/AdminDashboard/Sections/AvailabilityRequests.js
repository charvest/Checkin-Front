// File: src/pages/AdminDashboard/Sections/AvailabilityRequests.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../../../api/apiFetch";

const BRAND = "#B9FF66";
const TEXT_MAIN = "#0f172a";
const TEXT_MUTED = "#64748b";

function Badge({ tone = "slate", children }) {
  const cls =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : tone === "red"
      ? "bg-rose-100 text-rose-800"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-[Nunito] font-extrabold ${cls}`}>
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

function clampPage(page, totalPages) {
  if (totalPages <= 1) return 1;
  return Math.min(Math.max(1, page), totalPages);
}

function PaginationBar({ page, totalPages, onPage }) {
  if (totalPages < 1) return null;

  const go = (p) => onPage(Math.min(totalPages, Math.max(1, p)));

  const getPages = () => {
    const maxButtons = 5;

    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

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
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
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

function rangeLabel(item) {
  const s = item?.startAt ? new Date(item.startAt).toLocaleString() : "—";
  const e = item?.endAt ? new Date(item.endAt).toLocaleString() : "—";
  return `${s} — ${e}`;
}

/* ===================== MeetRequests-style Modal UI (for details sheet) ===================== */
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


function ConfirmRejectModal({
  open,
  title = "Confirm action",
  subtitle = "",
  noteTitle = "Note",
  noteText = "—",
  reasonLabel = "Reason (optional)",
  reasonPlaceholder = "Write a short reason…",
  reasonValue = "",
  onReasonChange,
  confirmText = "Confirm",
  cancelText = "Cancel",
  busy = false,
  error = "",
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

  if (!open || !isBrowser()) return null;

  const card = (
    <div
      className={[
        "pointer-events-auto bg-white shadow-2xl border border-slate-200",
        "w-full sm:w-[560px]",
        isMobile ? "rounded-t-3xl" : "rounded-2xl",
        "overflow-hidden",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-4 sm:px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-semibold text-slate-900">{title}</div>
            {subtitle ? <div className="mt-1 text-sm font-medium text-slate-600 break-words">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="shrink-0 h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold text-slate-500">{noteTitle}</div>
          <div className="mt-2 text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words max-h-[240px] overflow-auto no-scrollbar">
            {String(noteText || "").trim() || "—"}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-bold text-slate-500">{reasonLabel}</div>
          <textarea
            rows={4}
            maxLength={600}
            value={reasonValue}
            onChange={(e) => onReasonChange?.(e.target.value)}
            placeholder={reasonPlaceholder}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100 resize-none"
          />
          <div className="mt-2 text-[11px] font-bold text-slate-500">Optional, but helpful for transparency.</div>
        </div>

        {error ? <div className="mt-3 text-sm font-extrabold text-rose-700">{error}</div> : null}

        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="order-2 sm:order-1 h-11 px-4 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="order-1 sm:order-2 h-11 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-60 bg-slate-900 text-white hover:opacity-90"
          >
            {busy ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[10020]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onCancel} />
      <div className={["absolute inset-0 flex justify-center pointer-events-none", isMobile ? "items-end p-0" : "items-center p-6"].join(" ")}>
        {card}
      </div>
    </div>,
    document.body
  );
}


function ConflictPreviewModal({ open, busy = false, data = null, error = "", onCancel, onConfirm }) {
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

  if (!open || !isBrowser()) return null;

  const conflicts = Array.isArray(data?.conflicts) ? data.conflicts : [];
  const summary = data?.summary || {};

  const card = (
    <div
      className={[
        "pointer-events-auto bg-white shadow-2xl border border-slate-200",
        "w-full sm:w-[720px]",
        isMobile ? "rounded-t-3xl" : "rounded-2xl",
        "overflow-hidden",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label="Leave conflicts detected"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-4 sm:px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-semibold text-slate-900">Leave conflicts detected</div>
            <div className="mt-1 text-sm font-medium text-slate-600 break-words">
              Approving this leave will overlap existing approved or rescheduled counseling sessions.
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="shrink-0 h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold text-slate-500">Date affected</div>
            <div className="mt-1 text-sm font-extrabold text-slate-800">{summary.leaveDate || "—"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold text-slate-500">Leave time</div>
            <div className="mt-1 text-sm font-extrabold text-slate-800">{summary.leaveTimeRange || "—"}</div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-bold text-amber-700">Affected appointments</div>
            <div className="mt-1 text-sm font-extrabold text-amber-900">{conflicts.length}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-extrabold text-slate-800">
            Conflicting bookings
          </div>
          <div className="max-h-[280px] overflow-auto">
            {conflicts.length ? conflicts.map((row) => (
              <div key={row.id} className="grid grid-cols-[90px_1fr] sm:grid-cols-[110px_1.4fr_120px_120px] gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 text-sm">
                <div className="font-extrabold text-slate-800">{row.time || "—"}</div>
                <div>
                  <div className="font-extrabold text-slate-800 break-words">{row.studentName || "Student"}</div>
                  <div className="text-xs font-bold text-slate-500 break-words">{row.reason || "—"}</div>
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-700">{row.status || "—"}</div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-700">{row.sessionType || "—"}</div>
              </div>
            )) : <div className="px-4 py-5 text-sm font-bold text-slate-500">No conflicts found.</div>}
          </div>
        </div>

        {error ? <div className="mt-3 text-sm font-extrabold text-rose-700">{error}</div> : null}
        <div className="mt-3 text-[12px] font-bold text-slate-500">Only conflicting bookings are shown here to keep the decision quick and readable.</div>

        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="order-2 sm:order-1 h-11 px-4 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 transition-all">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="order-1 sm:order-2 h-11 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-60 bg-slate-900 text-white hover:opacity-90">
            {busy ? "Please wait..." : "Approve anyway"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[10030]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onCancel} />
      <div className={["absolute inset-0 flex justify-center pointer-events-none", isMobile ? "items-end p-0" : "items-center p-6"].join(" ")}>
        {card}
      </div>
    </div>,
    document.body
  );
}

export default function AvailabilityRequests() {
  const PAGE_SIZE = 6;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState({ tone: "", text: "" });

    const [statusFilter, setStatusFilter] = useState("Pending");
  const [items, setItems] = useState([]);

  const [counselorsMap, setCounselorsMap] = useState(() => new Map());
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState(null);

  // Reject original request (Admin)
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState("");

  // Reject cancellation request (Admin)
  const [cancelRejectConfirmOpen, setCancelRejectConfirmOpen] = useState(false);
  const [cancelRejectReason, setCancelRejectReason] = useState("");
  const [cancelRejectBusy, setCancelRejectBusy] = useState(false);
  const [cancelRejectError, setCancelRejectError] = useState("");
  const [approveConflictOpen, setApproveConflictOpen] = useState(false);
  const [approveConflictData, setApproveConflictData] = useState(null);
  const [approveConflictBusy, setApproveConflictBusy] = useState(false);
  const [approveConflictError, setApproveConflictError] = useState("");
  const [page, setPage] = useState(1);

  const loadCounselors = useCallback(async () => {
    try {
      let list = [];
      try {
        const dataUsers = await apiFetch("/api/users/counselors");
        list = Array.isArray(dataUsers?.items) ? dataUsers.items : Array.isArray(dataUsers) ? dataUsers : [];
      } catch {
        const dataCounseling = await apiFetch("/api/counseling/counselors");
        list = Array.isArray(dataCounseling?.items) ? dataCounseling.items : [];
      }

      const m = new Map();
      for (const c of list) {
        const id = String(c?._id || c?.id || "");
        if (!id) continue;
        const name = String(
          c?.fullName ||
            c?.name ||
            [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() ||
            "Counselor"
        );
        m.set(id, {
          id,
          name,
          role: String(c?.role || ""),
          email: String(c?.email || ""),
          counselorId: String(c?.counselorId || c?.counselorCode || ""),
        });
      }
      setCounselorsMap(m);
    } catch {
      setCounselorsMap(new Map());
    }
  }, []);

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    setErr("");
    setMsg({ tone: "", text: "" });

    try {
      const params = new URLSearchParams();

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      const data = await apiFetch(`/api/counseling/admin/blocks?${params.toString()}`);
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
    } catch (e) {
      setErr(e?.message || "Failed to load availability requests.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadCounselors();
  }, [loadCounselors]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return items;

    return items.filter((it) => {
      const cid = String(it?.counselorId || "");
      const c = counselorsMap.get(cid);
      const name = String(c?.name || "");
      const code = String(c?.counselorId || c?.counselorCode || "");
      const type = String(it?.type || "");
      const note = String(it?.note || "");
      return (
        cid.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q) ||
        note.toLowerCase().includes(q)
      );
});
  }, [items, search, counselorsMap]);

  const sortedFiltered = useMemo(() => {
    return filtered
      .slice()
      .sort(
        (a, b) =>
          new Date(b?.createdAt || b?.updatedAt || 0).getTime() -
          new Date(a?.createdAt || a?.updatedAt || 0).getTime()
      );
  }, [filtered]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE)), [sortedFiltered.length]);
  const safePage = useMemo(() => clampPage(page, totalPages), [page, totalPages]);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return sortedFiltered.slice(start, end);
  }, [sortedFiltered, safePage]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const id = String(selectedId);
    return sortedFiltered.find((x) => String(x?._id || x?.id || "") === id) || null;
  }, [sortedFiltered, selectedId]);

  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null);
      setRejectConfirmOpen(false);
      setRejectReason("");
      setRejectBusy(false);
      setRejectError("");
      setCancelRejectConfirmOpen(false);
      setCancelRejectReason("");
      setCancelRejectBusy(false);
      setCancelRejectError("");
      setApproveConflictOpen(false);
      setApproveConflictData(null);
      setApproveConflictBusy(false);
      setApproveConflictError("");
}
  }, [selectedId, selected]);

  const approve = async (id, force = false) => {
    if (!id) return;
    setErr("");
    setMsg({ tone: "", text: "" });
    try {
      await apiFetch(`/api/counseling/admin/blocks/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify(force ? { force: true } : {}),
      });
      setMsg({ tone: "green", text: "Request approved." });
      setRejectConfirmOpen(false);
      setRejectReason("");
      setApproveConflictOpen(false);
      setApproveConflictData(null);
      await loadBlocks();
    } catch (e) {
      setErr(e?.message || "Failed to approve request.");
      throw e;
    }
  };

  const previewApprove = async (id) => {
    if (!id) return;
    setErr("");
    setMsg({ tone: "", text: "" });
    setApproveConflictError("");
    try {
      const data = await apiFetch(`/api/counseling/admin/blocks/${id}/approve-preview`);
      if (data?.hasConflicts) {
        setApproveConflictData(data);
        setApproveConflictOpen(true);
        return;
      }
      await approve(id, false);
    } catch (e) {
      setErr(e?.message || "Failed to check leave conflicts.");
    }
  };

  const confirmReject = async (id) => {
    if (!id) return;

    const reason = String(rejectReason || "").trim();
    setRejectBusy(true);
    setRejectError("");
    setErr("");
    setMsg({ tone: "", text: "" });

    try {
      await apiFetch(`/api/counseling/admin/blocks/${id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason: reason || "Rejected" }),
      });

      setMsg({ tone: "green", text: "Request rejected." });
      setRejectConfirmOpen(false);
      setRejectReason("");
      await loadBlocks();
    } catch (e) {
      const msg = e?.message || "Failed to reject request.";
      setRejectError(msg);
      setErr(msg);
    } finally {
      setRejectBusy(false);
    }
  };


  const approveCancel = async (id) => {
    if (!id) return;
    setErr("");
    setMsg({ tone: "", text: "" });
    try {
      await apiFetch(`/api/counseling/admin/blocks/${id}/cancel/approve`, { method: "PATCH" });
      setMsg({ tone: "green", text: "Cancellation approved." });
      setCancelRejectConfirmOpen(false);
      setCancelRejectReason("");
      await loadBlocks();
    } catch (e) {
      setErr(e?.message || "Failed to approve cancellation.");
    }
  };

  const confirmRejectCancel = async (id) => {
    if (!id) return;

    const reason = String(cancelRejectReason || "").trim();
    setCancelRejectBusy(true);
    setCancelRejectError("");
    setErr("");
    setMsg({ tone: "", text: "" });

    try {
      await apiFetch(`/api/counseling/admin/blocks/${id}/cancel/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason: reason || "Rejected" }),
      });

      setMsg({ tone: "green", text: "Cancellation rejected." });
      setCancelRejectConfirmOpen(false);
      setCancelRejectReason("");
      await loadBlocks();
    } catch (e) {
      const msg = e?.message || "Failed to reject cancellation.";
      setCancelRejectError(msg);
      setErr(msg);
    } finally {
      setCancelRejectBusy(false);
    }
  };


  function notePreview(v, max = 90) {
    const s = String(v || "").trim();
    if (!s) return "—";
    if (s.length <= max) return s;
    return s.slice(0, max).trimEnd() + "…";
  }

  const modalOpen = !!selected;
  const closeDetails = useCallback(() => {
    setSelectedId(null);
    setRejectConfirmOpen(false);
    setRejectReason("");
    setCancelRejectConfirmOpen(false);
    setCancelRejectReason("");
  }, []);
  const drag = useSheetDragClose({ enabled: true, onClose: closeDetails });

  const modalTitle = useMemo(() => {
    if (!selected) return "Request details";
    const cid = String(selected?.counselorId || "");
    const c = counselorsMap.get(cid);
    const counselorLabel = c?.name ? c.name : cid || "Counselor";
    return `${counselorLabel} • ${String(selected?.type || "Unavailable")}`;
  }, [selected, counselorsMap]);

  const modalSubtitle = selected ? leaveDateLabel(selected) : "";

  const filters = useMemo(
    () => [
      { key: "Pending", label: "Pending" },
      { key: "Approved", label: "Approved" },
      { key: "Rejected", label: "Rejected" },
      { key: "Cancelled", label: "Cancelled" },
            { key: "", label: "All" },
    ],
    []
  );

  const showingFrom = sortedFiltered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(sortedFiltered.length, safePage * PAGE_SIZE);

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-4">
      <style>{`
        .ar-scroll{
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        .ar-list-pad{ padding-bottom: 84px; }
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
      <ConfirmRejectModal
        open={rejectConfirmOpen && !!selected}
        title="Reject request"
        subtitle={selected ? `${modalTitle} • ${modalSubtitle}` : ""}
        noteTitle="Request note"
        noteText={String(selected?.note || "").trim() || "—"}
        reasonLabel="Rejection reason (optional)"
        reasonPlaceholder="Why are you rejecting this request?"
        reasonValue={rejectReason}
        onReasonChange={setRejectReason}
        confirmText="Confirm reject"
        busy={rejectBusy}
        error={rejectError}
        onCancel={() => {
          if (rejectBusy) return;
          setRejectConfirmOpen(false);
          setRejectError("");
        }}
        onConfirm={() => confirmReject(String(selected?._id || selected?.id || ""))}
      />

      <ConfirmRejectModal
        open={cancelRejectConfirmOpen && !!selected}
        title="Reject cancellation request"
        subtitle={selected ? `${modalTitle} • ${modalSubtitle}` : ""}
        noteTitle="Cancellation details"
        noteText={
          `Counselor reason:\n${String(selected?.cancelReason || "").trim() || "—"}\n\nRequest note:\n${String(selected?.note || "").trim() || "—"}`
        }
        reasonLabel="Rejection reason (optional)"
        reasonPlaceholder="Why are you rejecting this cancellation request?"
        reasonValue={cancelRejectReason}
        onReasonChange={setCancelRejectReason}
        confirmText="Confirm reject"
        busy={cancelRejectBusy}
        error={cancelRejectError}
        onCancel={() => {
          if (cancelRejectBusy) return;
          setCancelRejectConfirmOpen(false);
          setCancelRejectError("");
        }}
        onConfirm={() => confirmRejectCancel(String(selected?._id || selected?.id || ""))}
      />


      <ConflictPreviewModal
        open={approveConflictOpen}
        busy={approveConflictBusy}
        data={approveConflictData}
        error={approveConflictError}
        onCancel={() => {
          if (approveConflictBusy) return;
          setApproveConflictOpen(false);
          setApproveConflictError("");
        }}
        onConfirm={async () => {
          const id = String(selected?._id || selected?.id || approveConflictData?.block?.id || "");
          if (!id) return;
          setApproveConflictBusy(true);
          setApproveConflictError("");
          try {
            await approve(id, true);
          } catch (e) {
            setApproveConflictError(e?.message || "Failed to approve request.");
          } finally {
            setApproveConflictBusy(false);
          }
        }}
      />

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[18px] sm:text-[20px] font-[Nunito] font-extrabold" style={{ color: TEXT_MAIN }}>
              Availability Requests
            </div>
            <div className="mt-1 text-[13.5px] font-[Lora]" style={{ color: TEXT_MUTED }}>
              Review counselor leave and unavailability requests. Approve, reject, or process cancellation requests.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge>{sortedFiltered.length} result(s)</Badge>
            <span className="inline-flex items-center w-2 h-2 rounded-full" style={{ background: BRAND }} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          {filters.map((f) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={[
                  "px-3 py-2 rounded-xl text-[13px] font-[Nunito] font-extrabold transition",
                  active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-800 hover:bg-slate-50",
                ].join(" ")}
              >
                {f.label}
              </button>
            );
          })}

          <div className="flex-1 min-w-[220px]" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search counselor / note / type…"
            className="w-full sm:w-[320px] rounded-xl border border-slate-200 px-3 py-2 text-[13.5px] font-[Nunito] font-bold outline-none focus:ring-2 focus:ring-slate-300"
          />
          <button
            type="button"
            onClick={loadBlocks}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-[13px] font-[Nunito] font-extrabold hover:bg-slate-50"
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 text-[13px] font-[Nunito] font-bold text-slate-600">
          Showing <span className="font-black">{showingFrom}</span>–<span className="font-black">{showingTo}</span> of{" "}
          <span className="font-black">{sortedFiltered.length}</span>
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
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 flex-1 min-h-0 overflow-hidden">
        <div className="text-[15px] font-[Nunito] font-extrabold" style={{ color: TEXT_MAIN }}>
          Requests
        </div>
        <div className="mt-1 text-[13px] font-[Lora]" style={{ color: TEXT_MUTED }}>
          Click an item to review. Cancellation requests appear as a badge on the request.
        </div>

        <div className="mt-4 ar-scroll no-scrollbar pr-1">
          {loading ? (
            <div className="text-[13px] font-[Nunito] font-bold text-slate-600">Loading…</div>
          ) : sortedFiltered.length === 0 ? (
            <div className="text-[13px] font-[Nunito] font-bold text-slate-600">No requests found.</div>
          ) : (
            <>
              <div className="ar-list-pad space-y-3">
                {pageItems.map((it) => {
                  const id = String(it?._id || it?.id || "");
                  const cid = String(it?.counselorId || "");
                  const c = counselorsMap.get(cid);
                  const counselorLabel = c?.name ? `${c.name}` : cid || "—";

                  const status = String(it?.status || "Pending");
                  const tone = status === "Approved" ? "green" : status === "Rejected" || status === "Cancelled" ? "red" : "amber";

                  const cancelReq = !!it?.cancelRequestedAt && status !== "Cancelled";
                  const daysCount = Number(it?.daysCount || 0);

                  return (
                    <button
                      key={id || Math.random()}
                      type="button"
                      onClick={() => {
                        setSelectedId(id);
                        setRejectConfirmOpen(false);
      setRejectReason("");
      setRejectBusy(false);
      setRejectError("");
      setCancelRejectConfirmOpen(false);
      setCancelRejectReason("");
      setCancelRejectBusy(false);
      setCancelRejectError("");
}}
                      className="w-full text-left rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 px-4 py-4 sm:px-6 sm:py-5 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[14px] sm:text-[15px] font-[Nunito] font-extrabold text-slate-900 truncate">
                              {counselorLabel}
                            </span>
                            <span className="text-slate-400 font-black">•</span>
                            <span className="text-[13px] sm:text-[14px] font-[Nunito] font-extrabold text-slate-600 truncate">
                              {String(it?.type || "Unavailable")}
                            </span>
                          </div>
                          <div className="mt-1 text-[12.5px] font-[Nunito] font-bold text-slate-600 truncate">{rangeLabel(it)}</div>
                          <div className="mt-2 text-[12.5px] font-[Nunito] font-bold text-slate-600 break-words">{notePreview(it?.note)}</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {cancelReq ? <Badge tone="amber">Cancel requested</Badge> : null}
                          {daysCount > 1 ? <Badge>{daysCount} days</Badge> : null}
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
            const id = String(selected?._id || selected?.id || "");
            const cid = String(selected?.counselorId || "");
            const c = counselorsMap.get(cid);
            const counselorLabel = c?.name ? `${c.name}` : cid || "—";

            const status = String(selected?.status || "Pending");
            const cancelPending = !!selected?.cancelRequestedAt && status !== "Cancelled";
            const cancelled = status === "Cancelled";
            const tone = status === "Approved" ? "green" : status === "Rejected" || status === "Cancelled" ? "red" : "amber";

            // Only allow approving/rejecting the original request when it is Pending AND no cancellation is pending.
            const canAct = status === "Pending" && !cancelPending;
            const canActCancel = cancelPending && !cancelled;

            const statusBadge =
              tone === "green"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : tone === "red"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-amber-200 bg-amber-50 text-amber-900";

            const infoItems = [
              { label: "Counselor", value: counselorLabel },
              { label: "Counselor ID", value: (c?.counselorId || "") || "—" },
              { label: "Type", value: String(selected?.type || "Unavailable") },
              { label: "Date of leave", value: modalSubtitle || "—" },
              { label: "Submitted", value: isoLocal(selected?.createdAt || selected?.updatedAt) },
              { label: "Last updated", value: isoLocal(selected?.updatedAt || selected?.createdAt) },
            ];

            return (
              <ModalCard sheet className="sm:max-w-[920px]" style={drag.sheetStyle}>
                <SheetGrabber dragHandleProps={drag.dragHandleProps} />

                <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-white">
                  <div className="space-y-2">
                    <div className="text-base sm:text-lg font-black text-slate-900 truncate">{modalTitle}</div>
                    <div className="text-sm font-bold text-slate-600 truncate">{modalSubtitle}</div>
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

                    <Card title="Cancellation">
                      {cancelled ? (
                        <div className="text-sm font-semibold text-slate-800">
                          Cancelled.
                          <div className="mt-2 text-[12.5px] font-bold text-slate-600">Approved: {isoLocal(selected?.cancelApprovedAt)}</div>
                          {String(selected?.cancelReason || "").trim() ? (
                            <div className="mt-2 text-[12.5px] font-bold text-slate-700 whitespace-pre-wrap break-words">Counselor reason: {String(selected?.cancelReason || "").trim()}</div>
                          ) : null}
                        </div>
                      ) : cancelPending ? (
                        <div>
                          <div className="text-sm font-black text-slate-800">Cancellation requested</div>
                          <div className="mt-1 text-[12.5px] font-bold text-slate-600">Requested: {isoLocal(selected?.cancelRequestedAt)}</div>
                          {String(selected?.cancelReason || "").trim() ? (
                            <div className="mt-2 text-[12.5px] font-bold text-slate-700 whitespace-pre-wrap break-words">Counselor reason: {String(selected?.cancelReason || "").trim()}</div>
                          ) : null}
                          <div className="mt-2 text-[12.5px] font-bold text-slate-500">Waiting for admin decision.</div>
                        </div>
                      ) : (
                        <div className="text-[12.5px] font-bold text-slate-600">No cancellation request.</div>
                      )}
                    </Card>
                  </div>
                </div>

                <div className="shrink-0 px-4 sm:px-6 py-4 border-t border-slate-200 bg-white">
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <MRButton variant="soft" className="w-full sm:w-auto order-3 sm:order-1" onClick={closeDetails}>
                      Close
                    </MRButton>

                    {canActCancel ? (
                      <>
                        <MRButton
                          variant="soft"
                          className="w-full sm:w-auto order-2 sm:order-2"
                          onClick={() => {
                            setCancelRejectError("");
                            setCancelRejectReason("");
                            setCancelRejectConfirmOpen(true);
                          }}
                          disabled={loading}
                        >
                          Reject cancellation
                        </MRButton>
                        <MRButton className="w-full sm:w-auto order-1 sm:order-3" onClick={() => approveCancel(id)} disabled={loading}>
                          Approve cancellation
                        </MRButton>
                      </>
                    ) : null}

                    {canAct ? (
                      <>
                        <MRButton
                          variant="soft"
                          className="w-full sm:w-auto order-2 sm:order-2"
                          onClick={() => {
                            setRejectError("");
                            setRejectReason("");
                            setRejectConfirmOpen(true);
                          }}
                          disabled={loading}
                        >
                          Reject
                        </MRButton>
                        <MRButton className="w-full sm:w-auto order-1 sm:order-3" onClick={() => previewApprove(id)} disabled={loading}>
                          Approve
                        </MRButton>
                      </>
                    ) : null}
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
