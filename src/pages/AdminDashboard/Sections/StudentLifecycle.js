// File: src/pages/AdminDashboard/Sections/StudentLifecycle.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const STATUS = {
  ACTIVE: "active",
  TERMINATED: "terminated",
};

const DESKTOP_PAGE_SIZE = 5;
const MOBILE_PAGE_SIZE = 3; // ✅ mobile shows 3 only

const COURSES = [
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

function normalize(text) {
  return (text || "").toString().trim().toLowerCase();
}

// ✅ Format exactly like: Aug 15,2024
function formatDateUS(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(d);

  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${month} ${day},${year}`.trim() || "—";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* =========================
   Fake API (replace later)
   ========================= */
const api = {
  async listStudents() {
    await sleep(150);
    return seedStudents();
  },
  async setStatus({ studentId, nextStatus, adminPassword }) {
    await sleep(180);
    if (adminPassword !== "admin123") throw new Error("Invalid admin password.");
    if (Math.random() < 0.02) throw new Error("Random API failure. Try again.");
    return { id: studentId, status: nextStatus, updatedAt: new Date().toISOString() };
  },
  async bulkSetStatus({ studentIds, nextStatus, adminPassword }) {
    await sleep(240);
    if (adminPassword !== "admin123") throw new Error("Invalid admin password.");
    if (Math.random() < 0.02) throw new Error("Random API failure. Try again.");
    const updatedAt = new Date().toISOString();
    return studentIds.map((id) => ({ id, status: nextStatus, updatedAt }));
  },
};

function seedStudents() {
  const now = new Date().toISOString();
  return [
    {
      id: "S-001",
      studentId: "2021-0001",
      name: "Alyssa Cruz",
      course: "Bachelor of Science in Information Technology",
      campus: "Legarda Campus",
      status: STATUS.ACTIVE,
      createdAt: "2024-08-15T10:30:00.000Z",
      updatedAt: now,
    },
    {
      id: "S-002",
      studentId: "2020-0321",
      name: "John Dela Rosa",
      course: "Bachelor of Science in Business Administration (BSBA)",
      campus: "Pasay Campus",
      status: STATUS.TERMINATED,
      createdAt: "2023-06-10T09:00:00.000Z",
      updatedAt: now,
    },
    {
      id: "S-003",
      studentId: "2019-0788",
      name: "Maria Santos",
      course: "Bachelor of Arts in Psychology",
      campus: "Jose Abad Santos Campus",
      status: STATUS.ACTIVE,
      createdAt: "2022-01-20T13:45:00.000Z",
      updatedAt: now,
    },
    {
      id: "S-004",
      studentId: "2018-0101",
      name: "Paolo Reyes",
      course: "Bachelor of Science in Computer Science",
      campus: "Andres Bonifacio Campus",
      status: STATUS.ACTIVE,
      createdAt: "2021-03-11T09:15:00.000Z",
      updatedAt: now,
    },
    {
      id: "S-005",
      studentId: "2017-0202",
      name: "Anne Villanueva",
      course: "Bachelor of Science in Tourism Management (BSTM)",
      campus: "Apolinario Mabini Campus",
      status: STATUS.TERMINATED,
      createdAt: "2020-07-02T12:00:00.000Z",
      updatedAt: now,
    },
    {
      id: "S-006",
      studentId: "2016-0303",
      name: "Kyle Mendoza",
      course: "Bachelor of Arts in Political Science",
      campus: "Elisa Esquerra Campus",
      status: STATUS.ACTIVE,
      createdAt: "2019-10-18T10:00:00.000Z",
      updatedAt: now,
    },
  ];
}

/* =========================
   Hooks
   ========================= */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);

    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, [query]);

  return matches;
}

function useLockBodyScroll(locked) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (!locked) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}

/* =========================
   Portal
   ========================= */
function Portal({ children }) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(children, document.body);
}

/* =========================
   UI Atoms
   ========================= */
function Pill({ children, tone = "slate" }) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${toneClass}`}>
      {children}
    </span>
  );
}

function Button({ children, variant = "solid", className = "", type = "button", ...props }) {
  const base =
    "inline-flex items-center justify-center px-3 py-2 rounded-xl text-sm font-extrabold transition border disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-200";
  const styles =
    variant === "solid"
      ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
      : variant === "soft"
        ? "bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
        : variant === "danger"
          ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-500"
          : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50";

  return (
    <button type={type} className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

function StatusPillButton({ status, onClick, disabled }) {
  const isActive = status === STATUS.ACTIVE;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      className="rounded-full focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
      aria-label={isActive ? "Change status: Terminate" : "Change status: Activate"}
      title={isActive ? "Click to terminate" : "Click to activate"}
    >
      {isActive ? <Pill tone="green">Active</Pill> : <Pill tone="amber">Terminated</Pill>}
    </button>
  );
}

function DetailItem({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-xs font-extrabold text-slate-800 break-words leading-snug ${mono ? "tabular-nums" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function FilterChip({ label, value, active, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-2xl border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-slate-200 ${
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
      } ${className}`}
    >
      <div className={`text-[10px] font-black uppercase tracking-wider ${active ? "text-white/70" : "text-slate-500"}`}>
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-black whitespace-normal break-words leading-snug ${active ? "text-white" : "text-slate-900"}`}>
        {value}
      </div>
    </button>
  );
}

function BottomSheet({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}>
          <div
            className="sheet-enter w-full max-w-[560px] mx-auto bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="text-sm font-black text-slate-900">{title}</div>
              <button type="button" onClick={onClose} className="text-xs font-black text-slate-500 hover:text-slate-900">
                Close
              </button>
            </div>
            <div className="p-3">{children}</div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  tone = "slate",
  onCancel,
  onConfirm,
  confirmLabel,
  password,
  onPasswordChange,
  passwordError,
  showPassword,
  onToggleShowPassword,
  loading,
}) {
  if (!open) return null;

  const border = tone === "danger" ? "border-rose-200" : "border-slate-200";
  const bg = tone === "danger" ? "bg-rose-50" : "bg-white";
  const canConfirm = Boolean((password || "").trim()) && !loading;

  return (
    <Portal>
      <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}>
        <div className="absolute inset-0 bg-black/40" onClick={loading ? undefined : onCancel} />
        <div className="absolute inset-0 flex items-end sm:items-center justify-center p-2" onClick={loading ? undefined : onCancel}>
          <div
            className={`pop-in w-[calc(100vw-16px)] max-w-[420px] rounded-3xl border ${border} ${bg} shadow-2xl overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              className="p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (canConfirm) onConfirm();
              }}
            >
              <div className="text-base font-black text-slate-900">{title}</div>
              <div className="mt-2 text-sm font-bold text-slate-700 whitespace-pre-line break-words leading-snug">
                {description}
              </div>

              <div className="mt-4">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Admin Password</div>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password to confirm"
                    disabled={loading}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={onToggleShowPassword}
                    disabled={loading}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {passwordError ? <div className="mt-2 text-sm font-extrabold text-rose-700">{passwordError}</div> : null}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="soft" onClick={onCancel} disabled={loading}>
                  Cancel
                </Button>
                <Button variant={tone === "danger" ? "danger" : "solid"} type="submit" disabled={!canConfirm}>
                  {loading ? "Processing..." : confirmLabel}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function Toast({ open, message, tone = "slate" }) {
  if (!open) return null;

  const cls =
    tone === "danger"
      ? "bg-rose-600 text-white"
      : tone === "success"
        ? "bg-emerald-600 text-white"
        : "bg-slate-900 text-white";

  return (
    <Portal>
      <div className="fixed inset-x-0 bottom-4 z-[75] flex justify-center px-2" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className={`toast-up px-4 py-3 rounded-2xl text-sm font-extrabold shadow-2xl ${cls}`}>{message}</div>
      </div>
    </Portal>
  );
}

/* =========================
   Pagination
   ========================= */
function getPageItems(totalPages, currentPage) {
  if (totalPages <= 1) return [1];
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 2) return [1, 2, "…", totalPages];
  if (currentPage >= totalPages - 1) return [1, "…", totalPages - 1, totalPages];
  return [1, "…", currentPage - 1, currentPage, currentPage + 1, "…", totalPages];
}

function PageButton({ active, children, onClick, disabled, compact = false }) {
  const base = compact
    ? "h-9 min-w-9 px-2 rounded-2xl text-sm font-extrabold border transition focus:outline-none focus:ring-2 focus:ring-slate-200"
    : "h-8 min-w-8 px-2 sm:h-9 sm:min-w-9 sm:px-3 rounded-xl text-sm font-extrabold border transition focus:outline-none focus:ring-2 focus:ring-slate-200";
  const cls = active
    ? "bg-slate-900 text-white border-slate-900"
    : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50";

  return (
    <button type="button" className={`${base} ${cls}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// ✅ Cleaner mobile pagination: indicator + compact buttons
function Pagination({ page, totalPages, onPrev, onNext, onGoTo, isMobile }) {
  const pageItems = useMemo(() => getPageItems(totalPages, page), [totalPages, page]);

if (isMobile) {
  return (
    <div className="px-3 py-4">
      <div className="mx-auto max-w-[560px] flex items-center justify-between gap-2">
        <Button
          variant="soft"
          className="h-10 px-4 rounded-2xl"
          disabled={page <= 1}
          onClick={onPrev}
        >
          Prev
        </Button>

        <div className="text-sm font-black text-slate-900 tabular-nums">
          {page} <span className="text-slate-400">/</span> {totalPages}
        </div>

        <Button
          variant="soft"
          className="h-10 px-4 rounded-2xl"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}


  return (
    <div className="px-4 py-4 flex items-center justify-center">
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
        <Button variant="soft" className="h-8 px-3 text-xs sm:h-9 sm:text-sm" disabled={page <= 1} onClick={onPrev}>
          Prev
        </Button>

        {pageItems.map((it, idx) =>
          it === "…" ? (
            <span key={`e-${idx}`} className="px-2 text-xs font-black text-slate-400 select-none">
              …
            </span>
          ) : (
            <PageButton key={it} active={it === page} onClick={() => onGoTo(it)} disabled={it === page}>
              {it}
            </PageButton>
          ),
        )}

        <Button variant="soft" className="h-8 px-3 text-xs sm:h-9 sm:text-sm" disabled={page >= totalPages} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}

/* =========================
   Selection
   ========================= */
function SelectAllCheckbox({ checked, indeterminate, onChange, ariaLabel, size = "md" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  const cls = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className={`${cls} accent-slate-900`}
    />
  );
}

/* =========================
   Main
   ========================= */
export default function StudentLifecycle() {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const isUltraNarrow = useMediaQuery("(max-width: 360px)");
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const [confirm, setConfirm] = useState({ open: false, action: null, targetIds: [] });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [confirmShowPassword, setConfirmShowPassword] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [animKey, setAnimKey] = useState(0);

  const [sheet, setSheet] = useState({ open: false, type: null }); // "course" | "status"
  const [sheetSearch, setSheetSearch] = useState("");

  const [toast, setToast] = useState({ open: false, message: "", tone: "success" });

  useLockBodyScroll(sheet.open || confirm.open);

  const COURSE_OPTIONS = useMemo(
    () => [{ value: "all", label: "All courses" }, ...COURSES.map((c) => ({ value: c, label: c }))],
    [],
  );

  function openSheet(type) {
    setSheetSearch("");
    setSheet({ open: true, type });
  }
  function closeSheet() {
    setSheet({ open: false, type: null });
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.listStudents();
        if (!mounted) return;
        setStudents(data);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load students");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);

    return students
      .filter((s) => {
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        if (courseFilter !== "all" && s.course !== courseFilter) return false;
        if (!q) return true;

        return (
          normalize(s.name).includes(q) ||
          normalize(s.studentId).includes(q) ||
          normalize(s.course).includes(q) ||
          normalize(s.campus).includes(q) ||
          normalize(s.id).includes(q)
        );
      })
      .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
  }, [students, query, statusFilter, courseFilter]);

  const filteredIds = useMemo(() => filtered.map((s) => s.id), [filtered]);

  useEffect(() => {
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter, courseFilter, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  function bumpListAnimation() {
    setAnimKey((k) => k + 1);
  }

  useEffect(() => {
    bumpListAnimation();
    setExpandedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, statusFilter, courseFilter, pageSize]);

  const selectedCount = useMemo(() => {
    if (filteredIds.length === 0) return 0;
    let n = 0;
    for (const id of filteredIds) if (selectedIds.has(id)) n += 1;
    return n;
  }, [filteredIds, selectedIds]);

  const allFilteredSelected = filteredIds.length > 0 && selectedCount === filteredIds.length;
  const someFilteredSelected = selectedCount > 0 && selectedCount < filteredIds.length;

  const hasActiveFilters = Boolean(query) || statusFilter !== "all" || courseFilter !== "all";

  const bulkBar = selectedCount > 0;
  const showMobileBulkBar = isMobile && bulkBar && !confirm.open;

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setCourseFilter("all");
    setPage(1);
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      let isAll = true;
      for (const id of filteredIds) {
        if (!next.has(id)) {
          isAll = false;
          break;
        }
      }

      if (isAll) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }

      return next;
    });
    bumpListAnimation();
  }

  function toggleSelectOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    bumpListAnimation();
  }

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAction(action, targetIds) {
    setConfirmPassword("");
    setConfirmPasswordError("");
    setConfirmShowPassword(false);
    setConfirmLoading(false);
    setConfirm({ open: true, action, targetIds });
  }

  function closeConfirm() {
    if (confirmLoading) return;
    setConfirmPassword("");
    setConfirmPasswordError("");
    setConfirmShowPassword(false);
    setConfirmLoading(false);
    setConfirm({ open: false, action: null, targetIds: [] });
  }

  function openToggleStatus(student) {
    const action = student.status === STATUS.ACTIVE ? "terminate" : "activate";
    openAction(action, [student.id]);
  }

  async function runAction() {
    const { action, targetIds } = confirm;
    if (!action || targetIds.length === 0) return;

    const pw = (confirmPassword || "").trim();
    if (!pw) {
      setConfirmPasswordError("Password is required.");
      return;
    }

    const nextStatus = action === "activate" ? STATUS.ACTIVE : STATUS.TERMINATED;

    setError("");
    setConfirmPasswordError("");
    setConfirmLoading(true);

    try {
      const updates =
        targetIds.length === 1
          ? [await api.setStatus({ studentId: targetIds[0], nextStatus, adminPassword: pw })]
          : await api.bulkSetStatus({ studentIds: targetIds, nextStatus, adminPassword: pw });

      const byId = new Map(updates.map((u) => [u.id, u]));

      setStudents((prev) =>
        prev.map((s) => {
          const u = byId.get(s.id);
          return u ? { ...s, status: u.status, updatedAt: u.updatedAt } : s;
        }),
      );

      setSelectedIds(new Set());
      closeConfirm();
      bumpListAnimation();

      setToast({
        open: true,
        message: `${action === "activate" ? "Activated" : "Terminated"} ${targetIds.length} ${
          targetIds.length === 1 ? "student" : "students"
        }.`,
        tone: action === "activate" ? "success" : "danger",
      });
    } catch (e) {
      setConfirmPasswordError(e?.message || "Action failed");
    } finally {
      setConfirmLoading(false);
    }
  }

  useEffect(() => {
    if (!toast.open) return undefined;
    const t = setTimeout(() => setToast((x) => ({ ...x, open: false })), 2200);
    return () => clearTimeout(t);
  }, [toast.open]);

  const courseLabel = courseFilter === "all" ? "All courses" : courseFilter;
  const statusLabel = statusFilter === "all" ? "All statuses" : statusFilter === STATUS.ACTIVE ? "Active" : "Terminated";

  const sheetTitle = sheet.type === "course" ? "Choose course" : "Choose status";

  function setSheetValue(value) {
    if (sheet.type === "course") setCourseFilter(value);
    if (sheet.type === "status") setStatusFilter(value);
    setPage(1);
    closeSheet();
  }

  function renderSheetList() {
    const q = normalize(sheetSearch);

    const isCourse = sheet.type === "course";
    const isStatus = sheet.type === "status";

    const items = isCourse
      ? COURSE_OPTIONS
      : [
          { value: "all", label: "All" },
          { value: STATUS.ACTIVE, label: "Active" },
          { value: STATUS.TERMINATED, label: "Terminated" },
        ];

    const current = isCourse ? courseFilter : statusFilter;

    if (isStatus) {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {items.map((x) => (
              <button
                key={x.value}
                type="button"
                onClick={() => setSheetValue(x.value)}
                className={`min-w-0 h-11 rounded-2xl border px-2 sm:px-3 text-sm font-black transition ${
                  current === x.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end">
            <Button variant="soft" onClick={closeSheet}>
              Done
            </Button>
          </div>
        </div>
      );
    }

    const filteredItems = items.filter((opt) => (!q ? true : normalize(opt.label).includes(q)));

    return (
      <div className="space-y-2">
        <input
          value={sheetSearch}
          onChange={(e) => setSheetSearch(e.target.value)}
          placeholder="Search course..."
          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
        />

        <div className="max-h-[52vh] overflow-auto border border-slate-200 rounded-2xl">
          {filteredItems.map((opt) => {
            const selected = opt.value === current;

            return (
              <button
                key={`${sheet.type}-${opt.value}`}
                type="button"
                onClick={() => setSheetValue(opt.value)}
                className={`w-full text-left px-3 py-3 border-b border-slate-200 last:border-b-0 transition ${
                  selected ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
                }`}
              >
                <div
                  className={`text-sm font-black whitespace-normal break-words leading-snug ${
                    selected ? "text-white" : "text-slate-900"
                  }`}
                >
                  {opt.label}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end">
          <Button variant="soft" onClick={closeSheet}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  const confirmTone = confirm.action === "terminate" ? "danger" : "slate";
  const confirmTitle = confirm.action === "terminate" ? "Terminate student?" : "Activate student?";
  const confirmLabel = confirm.action === "terminate" ? "Yes, Terminate" : "Yes, Activate";

  const confirmDescription = useMemo(() => {
    if (!confirm.open) return "";
    if (confirm.targetIds.length > 1) return `This will update ${confirm.targetIds.length} students.`;

    const one = students.find((s) => s.id === confirm.targetIds[0]);
    if (!one) return "";
    return `${one.name} • ${one.id}\n${one.course || "—"}`;
  }, [confirm.open, confirm.targetIds, students]);

  return (
    <div className={`w-full ${showMobileBulkBar ? "pb-24" : ""}`}>
      <style>{`
        @keyframes fadeRight {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .fade-right { animation: fadeRight 240ms ease-out both; }

        @keyframes sheetUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sheet-enter { animation: sheetUp 170ms ease-out both; }

        @keyframes popIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .pop-in { animation: popIn 170ms ease-out both; }

        @keyframes toastUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .toast-up { animation: toastUp 170ms ease-out both; }
      `}</style>

      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="flex flex-col gap-2">
              <div className="relative w-full lg:max-w-[560px]">
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, student id, course, campus..."
                  className="w-full px-3 py-2 pr-16 rounded-xl border border-slate-200 bg-white text-sm font-bold outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 hover:text-slate-900"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {/* Mobile chips */}
              {isMobile ? (
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    label="Course"
                    value={courseLabel}
                    active={courseFilter !== "all"}
                    onClick={() => openSheet("course")}
                    className={isUltraNarrow ? "w-full" : "flex-1 min-w-[160px]"}
                  />
                  <FilterChip
                    label="Status"
                    value={statusLabel}
                    active={statusFilter !== "all"}
                    onClick={() => openSheet("status")}
                    className={isUltraNarrow ? "w-full" : "flex-1 min-w-[160px]"}
                  />

                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className={`rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 ${
                        isUltraNarrow ? "w-full" : "flex-1 min-w-[160px]"
                      }`}
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <select
                    value={courseFilter}
                    onChange={(e) => {
                      setCourseFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-slate-100"
                  >
                    {COURSE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="all">All statuses</option>
                    <option value={STATUS.ACTIVE}>Active</option>
                    <option value={STATUS.TERMINATED}>Terminated</option>
                  </select>

                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-sm font-black text-slate-600 hover:text-slate-900 underline underline-offset-4 w-fit"
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {/* Desktop bulk bar */}
            {!isMobile && selectedCount > 0 && !confirm.open ? (
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-slate-700">
                  <span className="font-black">{selectedCount}</span> selected
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="soft" onClick={() => openAction("activate", Array.from(selectedIds))}>
                    Set Active
                  </Button>
                  <Button variant="soft" onClick={() => openAction("terminate", Array.from(selectedIds))}>
                    Set Terminated
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-3 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-extrabold">
              {error}
            </div>
          ) : null}
        </div>

        {/* List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-3 sm:px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-black text-slate-900">
                Students <span className="text-slate-500 font-extrabold">({filtered.length})</span>
              </div>
              <div className="text-[11px] font-bold text-slate-500">
                Page {page} of {totalPages}
              </div>
            </div>

            {isMobile ? (
              <label className="flex items-center gap-2 text-xs font-black text-slate-700 shrink-0">
                <SelectAllCheckbox
                  checked={allFilteredSelected}
                  indeterminate={someFilteredSelected && !allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  ariaLabel="Select all students (all pages)"
                  size="lg"
                />
                <span className="hidden sm:inline">Select all</span>
              </label>
            ) : null}
          </div>

          {/* Mobile Cards */}
          <div className="p-3 lg:hidden">
            <div key={animKey} className="space-y-3">
              {loading ? (
                <div className="fade-right p-4 border border-slate-200 rounded-2xl text-sm font-extrabold text-slate-500">
                  Loading...
                </div>
              ) : pageStudents.length === 0 ? (
                <div className="fade-right p-4 border border-slate-200 rounded-2xl text-sm font-extrabold text-slate-500">
                  No students found.
                </div>
              ) : (
                pageStudents.map((s) => {
                  const expanded = expandedIds.has(s.id);

                  return (
                    <div key={s.id} className="fade-right border border-slate-200 rounded-2xl bg-white overflow-hidden">
                      <div className={`p-3 ${isUltraNarrow ? "p-2" : ""}`}>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(s.id)}
                            onChange={() => toggleSelectOne(s.id)}
                            className="mt-1 h-5 w-5 accent-slate-900"
                            aria-label={`Select ${s.name}`}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-black text-slate-900 leading-tight break-words">
                                  {s.name}
                                </div>
                                <div className="text-xs font-bold text-slate-500">{s.id}</div>
                              </div>

                              <div className="shrink-0">
                                <StatusPillButton status={s.status} onClick={() => openToggleStatus(s)} disabled={confirmLoading} />
                              </div>
                            </div>

                            <div className="mt-2 space-y-1">
                              <div className="text-xs font-extrabold text-slate-700 break-words">
                                <span className="text-slate-500 font-black">Course:</span>{" "}
                                <span className="font-extrabold">{s.course || "—"}</span>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(s.id)}
                                className="text-xs font-black text-slate-600 hover:text-slate-900 underline underline-offset-4"
                              >
                                {expanded ? "Hide details" : "View details"}
                              </button>

                              <div className="text-[11px] font-black text-slate-400 tabular-nums">{formatDateUS(s.createdAt)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {expanded ? (
                        <div className="px-3 pb-3 border-t border-slate-200 bg-slate-50/40">
                          <div className={`pt-3 grid gap-y-3 gap-x-4 ${isUltraNarrow ? "grid-cols-1" : "grid-cols-2"}`}>
                            <DetailItem label="Student ID" value={s.studentId} mono />
                            <DetailItem label="Created At" value={formatDateUS(s.createdAt)} mono />
                            <DetailItem label="Course" value={s.course} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                  <tr>
                    <th className="p-3 text-xs font-black uppercase tracking-wider text-slate-600 w-12">
                      <SelectAllCheckbox
                        checked={allFilteredSelected}
                        indeterminate={someFilteredSelected && !allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        ariaLabel="Select all students (all pages)"
                      />
                    </th>
                    <th className="p-3 text-xs font-black uppercase tracking-wider text-slate-600">Student</th>
                    <th className="p-3 text-xs font-black uppercase tracking-wider text-slate-600 whitespace-nowrap">Student ID</th>
                    <th className="p-3 text-xs font-black uppercase tracking-wider text-slate-600 whitespace-nowrap">Created At</th>
                    <th className="p-3 text-xs font-black uppercase tracking-wider text-slate-600">Course</th>
                    <th className="p-3 text-xs font-black uppercase tracking-wider text-slate-600">Status</th>
                  </tr>
                </thead>

                <tbody key={animKey} className="bg-white">
                  {loading ? (
                    <tr className="fade-right">
                      <td colSpan={6} className="p-6 text-sm font-extrabold text-slate-500">
                        Loading...
                      </td>
                    </tr>
                  ) : pageStudents.length === 0 ? (
                    <tr className="fade-right">
                      <td colSpan={6} className="p-6 text-sm font-extrabold text-slate-500">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    pageStudents.map((s) => (
                      <tr key={s.id} className="fade-right border-b border-slate-200 last:border-b-0 hover:bg-slate-50/70">
                        <td className="p-3 align-top">
                          <input
                            checked={selectedIds.has(s.id)}
                            onChange={() => toggleSelectOne(s.id)}
                            type="checkbox"
                            className="h-4 w-4 accent-slate-900"
                            aria-label={`Select ${s.name}`}
                          />
                        </td>

                        <td className="p-3 align-top min-w-0">
                          <div className="font-black text-slate-900 leading-tight break-words">{s.name}</div>
                          <div className="text-xs font-bold text-slate-500">{s.id}</div>
                        </td>

                        <td className="p-3 align-top text-sm font-extrabold text-slate-700 whitespace-nowrap">{s.studentId || "—"}</td>

                        <td className="p-3 align-top text-sm font-extrabold text-slate-700 whitespace-nowrap tabular-nums">
                          {formatDateUS(s.createdAt)}
                        </td>

                        <td className="p-3 align-top text-sm font-extrabold text-slate-700 break-words">{s.course || "—"}</td>

                        <td className="p-3 align-top">
                          <StatusPillButton status={s.status} onClick={() => openToggleStatus(s)} disabled={confirmLoading} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          isMobile={isMobile} // ✅ enhanced mobile pagination
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          onGoTo={(p) => setPage(p)}
        />
      </div>

      {/* ✅ Mobile sticky bulk bar */}
      {showMobileBulkBar ? (
        <Portal>
          <div className="fixed inset-x-0 bottom-0 z-[65] px-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}>
            <div className="mx-auto max-w-[560px] rounded-3xl border border-slate-200 bg-white shadow-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-slate-700">
                  <span className="font-black">{selectedCount}</span> selected
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs font-black text-slate-500 hover:text-slate-900"
                >
                  Clear
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Button variant="soft" className="flex-1" onClick={() => openAction("activate", Array.from(selectedIds))}>
                  Set Active
                </Button>
                <Button variant="soft" className="flex-1" onClick={() => openAction("terminate", Array.from(selectedIds))}>
                  Set Terminated
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}

      <BottomSheet open={sheet.open} title={sheetTitle} onClose={closeSheet}>
        {renderSheetList()}
      </BottomSheet>

      <ConfirmModal
        open={confirm.open}
        title={confirmTitle}
        description={confirmDescription}
        tone={confirmTone}
        onCancel={closeConfirm}
        onConfirm={runAction}
        confirmLabel={confirmLabel}
        password={confirmPassword}
        onPasswordChange={(v) => {
          setConfirmPassword(v);
          if (confirmPasswordError) setConfirmPasswordError("");
        }}
        passwordError={confirmPasswordError}
        showPassword={confirmShowPassword}
        onToggleShowPassword={() => setConfirmShowPassword((x) => !x)}
        loading={confirmLoading}
      />

      <Toast open={toast.open} message={toast.message} tone={toast.tone} />
    </div>
  );
}
