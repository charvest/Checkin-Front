// src/pages/CounselorDashboard/Sections/StudentAccounts.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getStudentAccounts, updateStudentAccount } from "../counselor.api";

/* ===================== THEME ===================== */
const THEME = {
  border: "border-slate-200",
  surface: "bg-white",
  surfaceMuted: "bg-slate-50",
  text: "text-slate-900",
  textMuted: "text-slate-600",
  primaryBg: "bg-slate-900",
  primaryText: "text-white",
  primaryHover: "hover:bg-slate-800",
  primaryBorder: "border-slate-900",
  greenSoft: "rgba(185, 255, 102, 0.10)",
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  ms: 360,
};

const PAGE_SIZE = 5;

/**
 * Counselor password configuration:
 * - CRA: REACT_APP_COUNSELOR_PASSWORD
 * - If not set, UI requires non-empty password (no exact match check).
 */
const COUNSELOR_PASSWORD = ""; // ✅ server-side verification now (unused)

/* ===================== DROPDOWN OPTIONS ===================== */
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

const CAMPUS_OPTIONS = []; // ✅ removed from Student Accounts UI

const PROFILE_SECTIONS = [
  {
    title: "Student Details",
    subtitle: "Personal information",
    items: [
      { label: "First Name", key: "firstName", autoComplete: "given-name" },
      { label: "Last Name", key: "lastName", autoComplete: "family-name" },

      // ✅ constrained: NN-NNNNN (2 digits + dash + 5 digits)
      { label: "Student ID", key: "studentId", mono: true, breakAll: true, autoComplete: "off", maxLength: 8, inputMode: "numeric", placeholder: "22-00197" },

      { label: "Email", key: "email", breakAll: true, inputType: "email", autoComplete: "email", inputMode: "email", placeholder: "name@domain.com" },
    ],
  },
  {
    title: "Academic Info",
    subtitle: "Program",
    items: [
      { label: "Course", key: "course", options: COURSE_OPTIONS, kind: "select" },
      { label: "Created At", key: "createdMonth", breakAll: true, inputType: "text", autoComplete: "off", readOnly: true },
    ],
  },
];

/* ===================== UTILS ===================== */
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function safeText(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  // ✅ TLD letters only (prevents .com123)
  return /^[a-z0-9._+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(v);
}

/**
 * ✅ Silent input constraints (NO red errors while typing)
 * - firstName/lastName: letters + spaces + apostrophes + hyphens
 * - studentId: NN-NNNNN (2 digits + dash + 5 digits), max length 8 incl. dash
 */
function lettersOnly(value) {
  const v = String(value ?? "");
  // Prefer unicode letters (supports names beyond A-Z), fallback to ASCII if unsupported.
  // Allow common name separators: spaces, apostrophes, hyphens.
  // Also keep combining marks (accents) where supported.
  try {
    const normalized = v.replace(/[’`]/g, "'");
    let cleaned = normalized.replace(/[^\p{L}\p{M} \-']/gu, "");
    cleaned = cleaned.replace(/\s+/g, " ");
    return cleaned;
  } catch {
    const normalized = v.replace(/[’`]/g, "'");
    let cleaned = normalized.replace(/[^a-zA-Z \-']/g, "");
    cleaned = cleaned.replace(/\s+/g, " ");
    return cleaned;
  }
}

function formatStudentId(value) {
  const raw = String(value ?? "");
  const digits = raw.replace(/\D/g, "").slice(0, 7); // 2 + 5 digits
  const a = digits.slice(0, 2);
  const b = digits.slice(2, 7);

  if (!digits) return "";
  if (digits.length <= 2) return a; // still typing first part
  return `${a}-${b}`;
}

function sanitizeEmailInput(value) {
  let v = String(value ?? "").toLowerCase();

  // ✅ allow only normal email characters while typing
  v = v.replace(/[^a-z0-9@._+\-]/g, "");

  // ✅ keep only the first "@"
  const at = v.indexOf("@");
  if (at !== -1) {
    const before = v.slice(0, at + 1);
    let after = v.slice(at + 1).replace(/@+/g, "");

    // ✅ If there's a domain dot, keep ONLY letters in the final TLD part
    const lastDot = after.lastIndexOf(".");
    if (lastDot !== -1) {
      const domainMain = after.slice(0, lastDot);
      let tld = after.slice(lastDot + 1);
      tld = tld.replace(/[^a-z]/g, ""); // ".com123" -> ".com"
      after = `${domainMain}.${tld}`;
    }

    v = before + after;
  }

  return v;
}



function buildFullName(student) {
  const first = String(student?.firstName || "").trim();
  const last = String(student?.lastName || "").trim();
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || "";
}

function updateStudentByEmail(list, oldEmail, patch) {
  const oldKey = normalizeEmail(oldEmail);
  if (!oldKey) return list;

  let replaced = false;
  const next = list.map((s) => {
    const key = normalizeEmail(s?.email);
    if (key !== oldKey) return s;
    replaced = true;
    return { ...(s || {}), ...(patch || {}) };
  });

  return replaced ? next : list;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, Math.trunc(x)));
}

/**
 * Calendar-style: Pagination window of 5 pages (CENTERED)
 * - Keeps current page around the middle when possible.
 */
function buildPageWindow5(currentPage, totalPages) {
  const total = Math.max(1, Number(totalPages) || 1);
  const p = clamp(Number(currentPage) || 1, 1, total);
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const start = clamp(p - 2, 1, total - 4);
  return [start, start + 1, start + 2, start + 3, start + 4];
}

function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return undefined;

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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia("(max-width: 639px)");
    const onChange = (e) => setIsMobile(e.matches);

    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    setIsMobile(mql.matches);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isMobile;
}

function useEventListener(target, type, handler, opts) {
  useEffect(() => {
    const el = typeof target === "function" ? target() : target;
    if (!el?.addEventListener) return undefined;
    el.addEventListener(type, handler, opts);
    return () => el.removeEventListener(type, handler, opts);
  }, [target, type, handler, opts]);
}

function isInteractiveTarget(target) {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  return Boolean(
    el.closest?.(
      [
        "input",
        "textarea",
        "select",
        "button",
        "a",
        "[role='button']",
        "[role='option']",
        "[role='listbox']",
        "[data-cc-nodrag='1']",
        "[data-cc-select-root='1']",
      ].join(",")
    )
  );
}

function getClientXYFromEvent(e) {
  if (!e) return null;
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  if (typeof e.clientX === "number" && typeof e.clientY === "number") return { x: e.clientX, y: e.clientY };
  return null;
}

/* ===================== ICONS ===================== */
function IconEdit(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronDown(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ===================== CLEAN SELECT ===================== */
function getViewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

function computeMenuPosition(anchorRect, desiredHeight = 320, gap = 8) {
  const { w, h } = getViewport();
  const maxWidth = Math.min(anchorRect.width, w - 16);
  const left = Math.min(w - maxWidth - 8, Math.max(8, anchorRect.left));
  const spaceBelow = h - anchorRect.bottom - gap - 8;
  const spaceAbove = anchorRect.top - gap - 8;
  const openUp = spaceBelow < Math.min(220, desiredHeight) && spaceAbove > spaceBelow;

  const maxH = Math.min(desiredHeight, openUp ? spaceAbove : spaceBelow);
  const top = openUp ? anchorRect.top - gap - maxH : anchorRect.bottom + gap;

  return {
    left,
    top: Math.max(8, top),
    width: maxWidth,
    maxHeight: Math.max(160, maxH),
  };
}

function CleanSelect({ label, value, options, onChange }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0, maxHeight: 240 });
  const [activeIdx, setActiveIdx] = useState(-1);

  const btnRef = useRef(null);

  useLockBodyScroll(open && isMobile);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIdx(-1);
    btnRef.current?.focus?.();
  }, []);

  const syncPos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = computeMenuPosition(rect, 360, 10);
    setPos(next);
  }, []);

  const openMenu = useCallback(() => {
    if (!isMobile) syncPos();
    setOpen(true);
    const idx = Math.max(0, (options || []).findIndex((x) => x === value));
    setActiveIdx(idx);
  }, [isMobile, options, syncPos, value]);

  useEffect(() => {
    if (!open || isMobile) return undefined;
    const t = window.setTimeout(syncPos, 0);
    return () => window.clearTimeout(t);
  }, [open, isMobile, syncPos]);

  useEventListener(
    () => window,
    "resize",
    () => {
      if (open && !isMobile) syncPos();
    },
    { passive: true }
  );

  useEventListener(
    () => window,
    "scroll",
    () => {
      if (open && !isMobile) syncPos();
    },
    { passive: true, capture: true }
  );

  useEventListener(
    () => document,
    "keydown",
    (e) => {
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min((options?.length || 1) - 1, i + 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
        return;
      }

      if (e.key === "Enter") {
        if (activeIdx >= 0 && activeIdx < (options?.length || 0)) {
          e.preventDefault();
          onChange?.({ target: { value: options[activeIdx] } });
          close();
        }
      }
    },
    { passive: false }
  );

  const display = String(value ?? "");

  const triggerCls = cx(
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3",
    "text-sm sm:text-base font-medium text-slate-900",
    "outline-none focus:outline-none focus:ring-0 focus:border-slate-300",
    "flex justify-between gap-3",
    "text-left touch-manipulation",
    isMobile ? "min-h-[44px] h-auto py-2 items-start" : "h-11 items-center"
  );

  const stopSheetDrag = (e) => {
    e.stopPropagation();
  };

  const renderDesktopMenu = () =>
    createPortal(
      <div className="fixed inset-0 z-[10000]" role="presentation" data-cc-select-root="1" onPointerDown={stopSheetDrag}>
        <button type="button" className="absolute inset-0 bg-transparent" aria-label="Close menu" onClick={close} />
        <div
          role="listbox"
          aria-label={label}
          className={cx(
            "fixed rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden",
            "animate-[ccMenuIn_160ms_var(--cc-ease)_both]"
          )}
          style={{
            left: `${pos.left}px`,
            top: `${pos.top}px`,
            width: `${pos.width}px`,
            maxHeight: `${pos.maxHeight}px`,
          }}
          onPointerDown={stopSheetDrag}
        >
          <div className="max-h-[inherit] overflow-auto py-1">
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm sm:text-base font-medium hover:bg-slate-50 touch-manipulation"
              onClick={() => {
                onChange?.({ target: { value: "" } });
                close();
              }}
            >
              Select...
            </button>

            {options.map((opt, i) => {
              const active = i === activeIdx;
              const selected = opt === display;
              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cx(
                    "w-full text-left px-3 py-2 text-sm sm:text-base font-medium hover:bg-slate-50 touch-manipulation",
                    active && "bg-slate-50",
                    selected ? "text-slate-900" : "text-slate-700"
                  )}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    onChange?.({ target: { value: opt } });
                    close();
                  }}
                >
                  <span className="block break-words whitespace-normal text-left">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>,
      document.body
    );

  const renderMobileBottomMenu = () =>
    createPortal(
      <div className="fixed inset-0 z-[10000]" role="presentation" data-cc-select-root="1" onPointerDown={stopSheetDrag}>
        <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={close} />

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto w-full max-w-[640px] rounded-t-3xl border border-slate-200 bg-white shadow-2xl animate-[ccSheetIn_var(--cc-ms)_var(--cc-ease)_both]">
            <div className="px-4 pt-3 pb-2 text-left">
              <div className="flex justify-center">
                <div className="h-1.5 w-12 rounded-full bg-slate-300" aria-hidden="true" />
              </div>

              <div className="mt-3 text-left">
                <div className="text-sm font-semibold text-slate-900">{label}</div>
                {display ? (
                  <div className="mt-1 text-sm font-medium text-slate-600 break-words whitespace-normal text-left">
                    {display}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="max-h-[62vh] overflow-auto border-t border-slate-200 py-2">
              <button
                type="button"
                className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 touch-manipulation"
                onClick={() => {
                  onChange?.({ target: { value: "" } });
                  close();
                }}
              >
                Select...
              </button>

              {options.map((opt) => {
                const selected = opt === display;
                return (
                  <button
                    key={opt}
                    type="button"
                    className={cx(
                      "w-full text-left px-4 py-3 text-sm font-medium hover:bg-slate-50 touch-manipulation",
                      selected ? "text-slate-900" : "text-slate-700"
                    )}
                    onClick={() => {
                      onChange?.({ target: { value: opt } });
                      close();
                    }}
                  >
                    <span className="block break-words whitespace-normal text-left">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );

  const menu =
    open && typeof document !== "undefined" ? (isMobile ? renderMobileBottomMenu() : renderDesktopMenu()) : null;

  return (
    <div className="flex flex-col gap-2" data-cc-nodrag="1">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>

        <button
          ref={btnRef}
          type="button"
          data-cc-nodrag="1"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            open ? close() : openMenu();
          }}
          className={triggerCls}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={cx("min-w-0 flex-1 text-left", display ? "text-slate-900" : "text-slate-500")}>
            <span className={cx("block whitespace-normal break-words text-left", isMobile ? "" : "truncate")}>
              {display || "Select..."}
            </span>
          </span>

          <span className="shrink-0 text-slate-400 pt-1 sm:pt-0">
            <IconChevronDown className="h-5 w-5" />
          </span>
        </button>
      </div>

      {menu}
    </div>
  );
}

/* ===================== FIELD ===================== */
function Field({
  label,
  value,
  mono,
  breakAll,
  multiline,
  options,
  onChange,
  inputType = "text",
  kind,
  name,
  autoComplete,
  readOnly,

  // ✅ new: constraints
  maxLength,
  inputMode,
  placeholder,
}) {
  if (Array.isArray(options) && kind === "select") {
    return <CleanSelect label={label} value={String(value ?? "")} options={options} onChange={onChange} />;
  }

  const inputBase = cx(
    "mt-2 w-full rounded-xl border border-slate-200 px-3",
    "h-11 text-sm sm:text-base font-medium text-slate-900",
    "outline-none focus:outline-none focus:ring-0 focus:border-slate-300",
    "touch-manipulation",
    readOnly ? "bg-slate-50 text-slate-700" : "bg-white"
  );

  if (multiline) {
    return (
      <div className="flex flex-col gap-2" data-cc-nodrag="1">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <textarea
            name={name}
            autoComplete={autoComplete}
            value={String(value ?? "")}
            onChange={onChange}
            rows={3}
            maxLength={maxLength}
            placeholder={placeholder}
            readOnly={readOnly}
            onPointerDown={(e) => e.stopPropagation()}
            className={cx(
              "mt-2 w-full rounded-xl border border-slate-200 px-3 py-2",
              "text-sm sm:text-base font-medium text-slate-900 outline-none",
              "focus:outline-none focus:ring-0 focus:border-slate-300 touch-manipulation",
              readOnly ? "bg-slate-50 text-slate-700" : "bg-white"
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-cc-nodrag="1">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <input
          name={name}
          autoComplete={autoComplete}
          type={inputType}
          value={String(value ?? "")}
          onChange={onChange}
          maxLength={maxLength}
          inputMode={inputMode}
          placeholder={placeholder}
          readOnly={readOnly}
          onPointerDown={(e) => e.stopPropagation()}
          className={cx(inputBase, mono && "font-mono", breakAll && "break-all")}
        />
      </div>
    </div>
  );
}

/* ===================== PROFILE FORM ===================== */
function ProfileSettingsForm({ profile, onChange, onSave, onCancel, saving, error }) {
  const data = profile ?? {};

  // ✅ silent typing restrictions (no visible errors)
  const setField = (key, readOnly) => (e) => {
  if (readOnly) return;

  const raw = e?.target?.value ?? "";
  let next = raw;

  // ✅ typing constraints (silent)
  if (key === "firstName" || key === "lastName") next = lettersOnly(raw);
  if (key === "studentId") next = formatStudentId(raw);

  // ✅ email constraint (silent)
  if (key === "email") next = sanitizeEmailInput(raw);

  onChange?.({ ...data, [key]: next });
};

  const primaryBtn = cx(
    "h-11 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-60",
    "outline-none focus:outline-none focus:ring-0",
    "touch-manipulation",
    THEME.primaryBg,
    THEME.primaryText,
    THEME.primaryHover
  );

  return (
    <form
      className="w-full"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onSave?.();
      }}
      data-cc-nodrag="1"
    >
      <div className={cx("rounded-2xl border overflow-hidden", THEME.border)}>
        <div className={cx("h-1.5", THEME.surface)} aria-hidden="true" />

        <div className="px-4 sm:px-6 py-5 sm:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {PROFILE_SECTIONS.map((section) => {
              const sectionId = `${section.title.toLowerCase().replace(/\s+/g, "-")}-heading`;
              return (
                <section key={section.title} aria-labelledby={sectionId} className="min-w-0">
                  <div className="min-w-0">
                    <h2 id={sectionId} className="font-semibold text-base sm:text-lg text-slate-900">
                      {section.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">{section.subtitle}</p>
                  </div>

                  <div className={cx("mt-4 rounded-lg border overflow-hidden", THEME.border)}>
                    {section.items.map((item, idx) => (
                      <div
                        key={item.label}
                        className={cx(
                          "px-3 sm:px-5 py-3.5",
                          idx !== section.items.length - 1 && cx("border-b", THEME.border)
                        )}
                        style={{ background: idx % 2 === 0 ? "rgba(15, 23, 42, 0.03)" : "white" }}
                      >
                        <Field
                          label={item.label}
                          value={data[item.key]}
                          mono={item.mono}
                          breakAll={item.breakAll}
                          multiline={item.multiline}
                          options={item.options}
                          kind={item.kind}
                          onChange={setField(item.key, item.readOnly)}
                          inputType={item.inputType ?? "text"}
                          name={`student-profile-${item.key}`}
                          autoComplete={item.autoComplete ?? "off"}
                          readOnly={Boolean(item.readOnly)}
                          maxLength={item.maxLength}
                          inputMode={item.inputMode}
                          placeholder={item.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {error ? <div className="mt-4 text-sm font-medium text-red-600">{error}</div> : null}

          <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="order-2 sm:order-1 h-11 px-4 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 transition-all outline-none focus:outline-none focus:ring-0 touch-manipulation"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={cx(primaryBtn, "order-1 sm:order-2")}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* ===================== PASSWORD MODAL ===================== */
function CounselorPasswordModal({ open, busy, error, password, setPassword, onCancel, onConfirm }) {
  const isMobile = useIsMobile();
  const inputRef = useRef(null);

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => inputRef.current?.focus?.(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEventListener(
    () => window,
    "keydown",
    (e) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm?.();
      }
    },
    { passive: false }
  );

  if (!open || typeof document === "undefined") return null;

  const card = (
    <div
      className={cx(
        "pointer-events-auto bg-white shadow-2xl border border-slate-200",
        "w-full sm:w-[520px]",
        "rounded-2xl",
        "overflow-hidden"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm counselor password"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-4 sm:px-6 py-5">
        <div className="text-base sm:text-lg font-semibold text-slate-900">Confirm Changes</div>
        <div className="mt-1 text-sm font-medium text-slate-600">Enter counselor password to save the edited profile.</div>

        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Counselor Password</div>
          <input
            ref={inputRef}
            name="counselor-password"
            autoComplete="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword?.(e.target.value)}
            placeholder="••••••••"
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-2 w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm sm:text-base font-medium text-slate-900 outline-none focus:outline-none focus:ring-0 focus:border-slate-300 touch-manipulation"
          />
          {error ? <div className="mt-2 text-sm font-medium text-red-600">{error}</div> : null}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="order-2 sm:order-1 h-11 px-4 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 transition-all outline-none focus:outline-none focus:ring-0 touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cx(
              "order-1 sm:order-2 h-11 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-60",
              "outline-none focus:outline-none focus:ring-0 touch-manipulation",
              THEME.primaryBg,
              THEME.primaryText,
              THEME.primaryHover
            )}
          >
            {busy ? "Saving..." : "Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onCancel} />
      <div
        className={cx(
          "absolute inset-0 flex justify-center pointer-events-none",
          isMobile ? "items-end p-0" : "items-center p-6"
        )}
      >
        {isMobile ? (
          <div className="pointer-events-auto w-full max-w-[640px] rounded-t-3xl overflow-hidden">{card}</div>
        ) : (
          card
        )}
      </div>
    </div>,
    document.body
  );
}

/* ===================== CONFIRM CHANGES MODAL ===================== */
function ConfirmChangesModal({ open, busy, error, summaryLines, onCancel, onConfirm }) {
  const isMobile = useIsMobile();
  useLockBodyScroll(open);

  if (!open || typeof document === "undefined") return null;

  const card = (
    <div
      className={cx(
        "pointer-events-auto bg-white shadow-2xl border border-slate-200",
        "w-full sm:w-[560px]",
        "rounded-2xl",
        "overflow-hidden"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm changes"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-4 sm:px-6 py-5">
        <div className="text-base sm:text-lg font-semibold text-slate-900">Are you sure?</div>
        <div className="mt-1 text-sm font-medium text-slate-600">
          Please confirm you want to apply these changes to the student account.
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          {Array.isArray(summaryLines) && summaryLines.length ? (
            <ul className="list-disc pl-5 space-y-1 text-sm font-medium text-slate-700">
              {summaryLines.map((line, i) => (
                <li key={i} className="break-words">{line}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm font-medium text-slate-700">No visible changes detected.</div>
          )}
        </div>

        {error ? <div className="mt-3 text-sm font-medium text-red-600">{error}</div> : null}

        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="order-2 sm:order-1 h-11 px-4 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 transition-all outline-none focus:outline-none focus:ring-0 touch-manipulation"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cx(
              "order-1 sm:order-2 h-11 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-60",
              "outline-none focus:outline-none focus:ring-0 touch-manipulation",
              THEME.primaryBg,
              THEME.primaryText,
              THEME.primaryHover
            )}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onCancel} />
      <div
        className={cx(
          "absolute inset-0 flex justify-center pointer-events-none",
          isMobile ? "items-end p-0" : "items-center p-6"
        )}
      >
        {isMobile ? (
          <div className="pointer-events-auto w-full max-w-[640px] rounded-t-3xl overflow-hidden">{card}</div>
        ) : (
          card
        )}
      </div>
    </div>,
    document.body
  );
}

/* ===================== SUCCESS MODAL ===================== */
function SuccessModal({ open, message, summaryLines, onClose }) {
  const isMobile = useIsMobile();
  useLockBodyScroll(open);

  if (!open || typeof document === "undefined") return null;

  const card = (
    <div
      className={cx(
        "pointer-events-auto bg-white shadow-2xl border border-slate-200",
        "w-full sm:w-[560px]",
        "rounded-2xl",
        "overflow-hidden"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Success"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-4 sm:px-6 py-5">
        <div className="text-base sm:text-lg font-semibold text-slate-900">Success</div>
        <div className="mt-1 text-sm font-medium text-slate-600">{message || "Changes saved."}</div>

        {Array.isArray(summaryLines) && summaryLines.length ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <ul className="list-disc pl-5 space-y-1 text-sm font-medium text-slate-700">
              {summaryLines.map((line, i) => (
                <li key={i} className="break-words">{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={cx(
              "h-11 px-4 rounded-xl text-sm font-medium transition-all",
              "outline-none focus:outline-none focus:ring-0 touch-manipulation",
              THEME.primaryBg,
              THEME.primaryText,
              THEME.primaryHover
            )}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        className={cx(
          "absolute inset-0 flex justify-center pointer-events-none",
          isMobile ? "items-end p-0" : "items-center p-6"
        )}
      >
        {isMobile ? (
          <div className="pointer-events-auto w-full max-w-[640px] rounded-t-3xl overflow-hidden">{card}</div>
        ) : (
          card
        )}
      </div>
    </div>,
    document.body
  );
}

/* ===================== SHEET / MODAL ===================== */
function EditProfileBottomSheet({ open, student, draft, setDraft, saving, error, onClose, onSave, lockClose = false }) {
  const MS = THEME.ms;
  const isMobile = useIsMobile();

  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState(open ? "enter" : "exit");
  const timerRef = useRef(null);

  const scrollRef = useRef(null);

  const draggingRef = useRef(false);
  const allowDragRef = useRef(false);
  const startYRef = useRef(0);
  const lastYRef = useRef(0);
  const startTRef = useRef(0);
  const [dragPx, setDragPx] = useState(0);

  useLockBodyScroll(open);

  const close = useCallback(() => {
    if (lockClose) return;
    onClose?.();
  }, [onClose, lockClose]);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);

    if (open) {
      setMounted(true);
      setDragPx(0);
      requestAnimationFrame(() => setPhase("enter"));
      return;
    }

    if (mounted) {
      setPhase("exit");
      timerRef.current = window.setTimeout(() => setMounted(false), MS);
    }
  }, [open, mounted, MS]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!open) return;
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const canStartDragFromTarget = (target) => {
    if (!isMobile) return false;
    if (lockClose) return false;
    if (isInteractiveTarget(target)) return false;

    const scroller = scrollRef.current;
    const scrollTop = scroller ? scroller.scrollTop : 0;
    const header = target?.closest?.("[data-cc-sheet-header='1']");
    if (header) return true;

    return scrollTop <= 0;
  };

  const beginDrag = (clientY) => {
    draggingRef.current = true;
    startYRef.current = clientY;
    lastYRef.current = clientY;
    startTRef.current = performance.now();
    setDragPx(0);
  };

  const moveDrag = (clientY) => {
    if (!draggingRef.current) return;
    const dy = Math.max(0, clientY - startYRef.current);
    lastYRef.current = clientY;
    setDragPx(dy);
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    const dy = dragPx;
    const dt = Math.max(1, performance.now() - startTRef.current);
    const velocity = (lastYRef.current - startYRef.current) / dt;

    const shouldClose = dy > 140 || (dy > 70 && velocity > 0.6);

    if (shouldClose) {
      setDragPx(0);
      close();
      return;
    }

    setDragPx(0);
  };

  const onSheetPointerDown = (e) => {
    if (!isMobile) return;
    if (isInteractiveTarget(e.target)) return;

    allowDragRef.current = canStartDragFromTarget(e.target);
    if (!allowDragRef.current) return;

    beginDrag(e.clientY);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onSheetPointerMove = (e) => {
    if (!isMobile) return;
    if (!allowDragRef.current) return;
    if (!draggingRef.current) return;

    if (e.clientY > startYRef.current) e.preventDefault();
    moveDrag(e.clientY);
  };

  const onSheetPointerUp = () => {
    allowDragRef.current = false;
    endDrag();
  };

  const onSheetPointerCancel = () => {
    allowDragRef.current = false;
    endDrag();
  };

  if (!mounted || !student) return null;

  const overlayCls = phase === "enter" ? "cc-sheet-overlay-in" : "cc-sheet-overlay-out";
  const sheetAnimCls = phase === "enter" ? "cc-sheet-in" : "cc-sheet-out";

  const chipCls = cx(
    "inline-flex items-center rounded-full px-3 py-1",
    "text-xs sm:text-sm font-medium border",
    THEME.primaryBg,
    THEME.primaryText,
    THEME.primaryBorder
  );

  const name = buildFullName(student);
  const titleLine = name || safeText(student?.email);

  const dragStyle =
    isMobile && dragPx > 0
      ? { transform: `translateY(${Math.min(360, dragPx)}px)`, transition: "none" }
      : undefined;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Edit student profile">
      <button
        className={cx("absolute inset-0", lockClose ? "bg-black/0" : "bg-black/40", overlayCls)}
        aria-label="Close"
        onClick={close}
      />

      <div className="absolute inset-0 flex items-end sm:items-center justify-center pointer-events-none p-0 sm:p-6">
        <div
          className={cx(
            "pointer-events-auto bg-white shadow-2xl border border-slate-200",
            "w-full sm:w-full",
            "max-w-none sm:max-w-4xl",
            "rounded-t-3xl sm:rounded-2xl",
            "pb-4 sm:pb-6",
            sheetAnimCls
          )}
          style={{ ...dragStyle, WebkitOverflowScrolling: "touch" }}
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerCancel}
        >
          <div className="px-4 sm:px-6 pt-3 select-none" data-cc-sheet-header="1" style={{ touchAction: "pan-y" }}>
            <div className="flex justify-center">
              <div className="h-1.5 w-12 rounded-full bg-slate-300" aria-hidden="true" />
            </div>

            <div className="mt-3 min-w-0">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">Profile Settings</div>
                  <div className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">Editing</div>
                  <div className="text-sm sm:text-base font-medium text-slate-900 break-words leading-snug">
                    <span className="block max-w-[70vw] sm:max-w-none truncate sm:whitespace-normal sm:break-words">
                      {titleLine}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 pt-0.5 sm:pt-0">
                  <span className={chipCls}>Counselor Editable</span>
                </div>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="mt-4 px-4 sm:px-6 max-h-[78vh] sm:max-h-[85vh] overflow-auto">
            <ProfileSettingsForm
              profile={draft}
              onChange={setDraft}
              onSave={onSave}
              onCancel={close}
              saving={saving}
              error={error}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== MAPPERS ===================== */
function mapStudentToProfile(s) {
  return {
    userId: s?.userId ?? s?._id ?? "",
    firstName: s?.firstName ?? "",
    lastName: s?.lastName ?? "",
    studentId: s?.studentId ?? s?.studentNumber ?? "",
    email: s?.email ?? "",
    course: s?.course ?? "",
    // display only
    createdMonth: s?.createdMonth ?? "",
  };
}

function mapProfileToPatch(p) {
  return {
    // ✅ keep silent constraint even if pasted / autofilled
    firstName: lettersOnly(String(p?.firstName ?? "")).trim(),
    lastName: lettersOnly(String(p?.lastName ?? "")).trim(),
    email: sanitizeEmailInput(p?.email).trim(),
    studentNumber: formatStudentId(p?.studentId),
    course: String(p?.course ?? "").trim(),
  };
}

/* ===================== CALENDAR-STYLE PAGINATION UI ===================== */
function CalendarPagination({ isMobile, safePage, totalPages, pageWindow, onPrev, onNext, onPage }) {
  if (totalPages <= 1) return null;

  const btnBase =
    "cc-focus cc-clickable px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      {isMobile ? (
        <div className="flex w-full items-center justify-center gap-2">
          <button type="button" onClick={onPrev} disabled={safePage <= 1} className={btnBase}>
            Prev
          </button>

          <div className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 whitespace-nowrap">
            {safePage} / {totalPages}
          </div>

          <button type="button" onClick={onNext} disabled={safePage >= totalPages} className={btnBase}>
            Next
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={onPrev} disabled={safePage <= 1} className={btnBase}>
              Prev
            </button>

            {pageWindow.map((x) => (
              <button
                key={`p-${x}`}
                type="button"
                onClick={() => onPage(x)}
                className={cx(
                  "cc-focus cc-clickable px-3 py-2 rounded-xl border text-sm font-extrabold",
                  x === safePage
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
                aria-current={x === safePage ? "page" : undefined}
              >
                {x}
              </button>
            ))}

            <button type="button" onClick={onNext} disabled={safePage >= totalPages} className={btnBase}>
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
  );
}

/* ===================== MAIN PAGE ===================== */
export default function StudentAccounts() {
  const isMobile = useIsMobile();

  const [students, setStudents] = useState([]);
  const [q, setQ] = useState("");
  const qBeforeEditRef = useRef("");

  const [page, setPage] = useState(1);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successLines, setSuccessLines] = useState([]);

  const prevPageRef = useRef(1);
  const [pageAnim, setPageAnim] = useState("");
  const pageAnimTimerRef = useRef(null);

  const listRef = useRef(null);
  const swipeRef = useRef({
    active: false,
    startedAt: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [pwOpen, setPwOpen] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState("");
  const [pendingSave, setPendingSave] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const loadStudents = useCallback(async () => {
    setIsLoadingStudents(true);
    try {
      const res = await Promise.resolve(getStudentAccounts());
      const list = Array.isArray(res) ? res : [];
      setStudents(list);
    } catch {
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const filtered = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    if (!query) return students;

    return (students || []).filter((s) => {
      const hay = [
        s?.email,
        s?.firstName,
        s?.lastName,
        s?.studentId,
        s?.studentNumber,
        s?.course,
        s?.createdMonth,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return hay.includes(query);
    });
  }, [students, q]);

  useEffect(() => setPage(1), [q, students.length]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = clampInt(page, 1, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const startIdx = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(total, startIdx + PAGE_SIZE);
  const pagedStudents = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  useEffect(() => {
    if (prevPageRef.current === safePage) return undefined;
    const dir = safePage > prevPageRef.current ? "in-right" : "in-left";
    prevPageRef.current = safePage;

    setPageAnim(dir);
    if (pageAnimTimerRef.current) window.clearTimeout(pageAnimTimerRef.current);
    pageAnimTimerRef.current = window.setTimeout(() => setPageAnim(""), 220);

    return () => {
      if (pageAnimTimerRef.current) window.clearTimeout(pageAnimTimerRef.current);
      pageAnimTimerRef.current = null;
    };
  }, [safePage]);

  useEffect(() => {
    return () => {
      if (pageAnimTimerRef.current) window.clearTimeout(pageAnimTimerRef.current);
    };
  }, []);

  const pageWindow = useMemo(() => buildPageWindow5(safePage, totalPages), [safePage, totalPages]);

  const goToPage = useCallback(
    (target) => {
      const next = typeof target === "function" ? target(safePage) : target;
      setPage(clampInt(next, 1, totalPages));
    },
    [safePage, totalPages]
  );

  const openEdit = (student) => {
    qBeforeEditRef.current = q;
    setEditError("");
    setEditStudent(student);
    setEditDraft(mapStudentToProfile(student));
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditStudent(null);
    setEditDraft(null);
    setEditError("");
    setEditSaving(false);

    setConfirmOpen(false);

    setPwOpen(false);
    setPwValue("");
    setPwError("");
    setPendingSave(null);
    setConfirmError("");

    // BUG GUARD: restore search query (prevents browser autofill/history from changing it during edit)
    setQ(qBeforeEditRef.current || "");
  };

  const closePassword = () => {
    if (editSaving) return;
    setConfirmOpen(false);

    setPwOpen(false);
    setPwValue("");
    setPwError("");
    setPendingSave(null);
    setConfirmError("");
  };

  const validateCounselorPassword = (value) => {
    const v = String(value || "");
    if (!v.trim()) return "Password is required.";
    return "";
  };

  const validateEditDraft = useCallback(
    (draft, currentStudent) => {
      const nextEmail = normalizeEmail(draft?.email);
      const oldEmail = normalizeEmail(currentStudent?.email);

      if (!nextEmail) return "Email is required.";
      if (!isValidEmail(nextEmail)) return "Email format is invalid.";

      if (nextEmail !== oldEmail) {
        const exists = (students || []).some((s) => normalizeEmail(s?.email) === nextEmail);
        if (exists) return "Email already exists. Please use a different email.";
      }

      const firstName = String(draft?.firstName ?? "").trim();
      const lastName = String(draft?.lastName ?? "").trim();
      if (!firstName) return "First Name is required.";
      if (!lastName) return "Last Name is required.";

      return "";
    },
    [students]
  );

  const buildChangeSummary = (draft, original) => {
    const lines = [];
    if (!draft || !original) return lines;

    const pairs = [
      ["First Name", String(original.firstName || ""), String(draft.firstName || "")],
      ["Last Name", String(original.lastName || ""), String(draft.lastName || "")],
      ["Student ID", String(original.studentId || original.studentNumber || ""), String(draft.studentId || "")],
      ["Email", String(original.email || ""), String(draft.email || "")],
      ["Course", String(original.course || ""), String(draft.course || "")],
    ];

    for (const [label, from, to] of pairs) {
      if (from.trim() !== to.trim()) lines.push(`${label}: "${from || "—"}" → "${to || "—"}"`);
    }
    return lines;
  };

  const performSaveEdit = async ({ userId, patch, counselorPassword }) => {
    if (editSaving) return;
    setEditSaving(true);
    setEditError("");
    try {
      const data = await updateStudentAccount({ userId, patch, counselorPassword });
      const updated = data?.item || null;
      if (!updated) throw new Error("Update failed.");

      setStudents((prev) => {
        const idKey = String(userId || "");
        const next = (prev || []).map((s) => {
          const sid = String(s?.userId || s?._id || "");
          if (idKey && sid && sid === idKey) return { ...(s || {}), ...(updated || {}) };
          return s;
        });
        return next;
      });
      closeEdit();
    } catch (e) {
      const msg = e?.message || "Update failed. Please try again.";
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const requestSaveEdit = () => {
    if (editSaving) return;
    setEditError("");
    setPwError("");
    setConfirmError("");

    const draftErr = validateEditDraft(editDraft, editStudent);
    if (draftErr) {
      setEditError(draftErr);
      return;
    }

    const patch = mapProfileToPatch(editDraft);
    const userId = editStudent?.userId || editStudent?._id || editDraft?.userId;

    setPendingSave({ userId, patch });
    setConfirmOpen(true);
  };

  const confirmPasswordAndSave = async () => {
    const err = validateCounselorPassword(pwValue);
    if (err) {
      setPwError(err);
      return;
    }

    const payload = pendingSave;
    if (!payload?.userId) {
      setPwError("Missing student reference. Please close and try again.");
      return;
    }

    setPwError("");
    setEditError("");
    setEditSaving(true);

    try {
      const data = await updateStudentAccount({
        userId: payload.userId,
        patch: payload.patch,
        counselorPassword: pwValue,
      });

      const updated = data?.item || null;
      if (!updated) throw new Error("Update failed.");

      setStudents((prev) => {
        const idKey = String(payload.userId || "");
        return (prev || []).map((s) => {
          const sid = String(s?.userId || s?._id || "");
          return sid && idKey && sid === idKey ? { ...(s || {}), ...(updated || {}) } : s;
        });
      });

      // Success modal (copy Confirm Changes style)
      setSuccessMessage(data?.message || "Student details updated successfully.");
      setSuccessLines(buildChangeSummary(editDraft, editStudent));
      setSuccessOpen(true);

      // Close password + edit UI
      setPwOpen(false);
      closeEdit();
    } catch (e) {
      const msg = e?.message || "Update failed. Please try again.";
      // Keep password modal open and show error there
      setPwError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const canSwipeNow = (eventTarget) => {
    if (!isMobile) return false;
    if (totalPages <= 1) return false;
    if (isInteractiveTarget(eventTarget)) return false;

    const el = listRef.current;
    if (!el) return true;
    return (el.scrollTop || 0) <= 0;
  };

  const beginSwipe = (e) => {
    if (!canSwipeNow(e.target)) return;

    const pt = getClientXYFromEvent(e);
    if (!pt) return;

    swipeRef.current.active = true;
    swipeRef.current.startedAt = performance.now();
    swipeRef.current.startX = pt.x;
    swipeRef.current.startY = pt.y;
    swipeRef.current.lastX = pt.x;
    swipeRef.current.lastY = pt.y;
  };

  const moveSwipe = (e) => {
    if (!swipeRef.current.active) return;
    const pt = getClientXYFromEvent(e);
    if (!pt) return;
    swipeRef.current.lastX = pt.x;
    swipeRef.current.lastY = pt.y;
  };

  const endSwipe = () => {
    if (!swipeRef.current.active) return;
    swipeRef.current.active = false;

    const dx = swipeRef.current.lastX - swipeRef.current.startX;
    const dy = swipeRef.current.lastY - swipeRef.current.startY;
    const dt = Math.max(1, performance.now() - swipeRef.current.startedAt);

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX < 44) return;
    if (absX < absY * 1.2) return;

    const vx = absX / dt;
    const enough = absX >= 80 || vx >= 0.6;
    if (!enough) return;

    if (dx < 0) goToPage(safePage + 1);
    else goToPage(safePage - 1);
  };

  const cancelSwipe = () => {
    swipeRef.current.active = false;
  };

  // Pointer-only (avoids some devices firing both touch + pointer)
  const onListPointerDown = (e) => {
    if (!isMobile) return;
    beginSwipe(e);
    if (swipeRef.current.active) e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onListPointerMove = (e) => {
    if (!isMobile) return;
    moveSwipe(e);
  };
  const onListPointerUp = () => {
    if (!isMobile) return;
    endSwipe();
  };
  const onListPointerCancel = () => {
    cancelSwipe();
  };

  return (
    <div className="space-y-4">
      <style>{`
        *::selection { background: ${THEME.greenSoft}; color: #0F172A; }
        *::-moz-selection { background: ${THEME.greenSoft}; color: #0F172A; }
        :focus { outline: none; }
        :focus-visible { outline: none; }
        :root { --cc-ease: ${THEME.ease}; --cc-ms: ${THEME.ms}ms; }

        @keyframes ccFadeRight { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes ccFadeLeft  { from { opacity: 0; transform: translateX(-10px);} to { opacity: 1; transform: translateX(0); } }
        .cc-page-in-right{ animation: ccFadeRight 220ms ease-out; }
        .cc-page-in-left{ animation: ccFadeLeft 220ms ease-out; }

        @media (prefers-reduced-motion: reduce){
          * { animation: none !important; transition: none !important; }
        }

        @keyframes ccSheetOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ccSheetOverlayOut { from { opacity: 1; } to { opacity: 0; } }

        @keyframes ccSheetIn { from { transform: translateY(18px) scale(0.99); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes ccSheetOut { from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(18px) scale(0.99); opacity: 0; } }

        @media (max-width: 639px) {
          @keyframes ccSheetIn { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes ccSheetOut { from { transform: translateY(0); opacity: 1; } to { transform: translateY(40px); opacity: 0; } }
        }

        .cc-sheet-overlay-in { animation: ccSheetOverlayIn var(--cc-ms) var(--cc-ease) both; }
        .cc-sheet-overlay-out { animation: ccSheetOverlayOut var(--cc-ms) var(--cc-ease) both; }
        .cc-sheet-in { animation: ccSheetIn var(--cc-ms) var(--cc-ease) both; }
        .cc-sheet-out { animation: ccSheetOut var(--cc-ms) var(--cc-ease) both; }

        @keyframes ccMenuIn { from { opacity: 0; transform: translateY(6px) scale(0.99); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .cc-focus:focus-visible{
          outline: none;
          box-shadow: 0 0 0 4px rgba(15,23,42,0.08);
        }
        .cc-clickable:active { transform: scale(0.99); }
        .cc-clickable { transition: transform 140ms ease, background-color 140ms ease, box-shadow 140ms ease; }
      `}</style>

      <SuccessModal
        open={successOpen}
        message={successMessage}
        summaryLines={successLines}
        onClose={() => {
          setSuccessOpen(false);
          setSuccessMessage("");
          setSuccessLines([]);
        }}
      />

      <ConfirmChangesModal
        open={confirmOpen}
        busy={editSaving}
        error={confirmError}
        summaryLines={buildChangeSummary(editDraft, editStudent)}
        onCancel={() => {
          if (editSaving) return;
          setConfirmOpen(false);
          setConfirmError("");
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          setPwOpen(true);
        }}
      />

      <CounselorPasswordModal
        open={pwOpen}
        busy={editSaving}
        error={pwError}
        password={pwValue}
        setPassword={setPwValue}
        onCancel={closePassword}
        onConfirm={confirmPasswordAndSave}
      />

      <EditProfileBottomSheet
        open={editOpen}
        student={editStudent}
        draft={editDraft}
        setDraft={setEditDraft}
        saving={editSaving}
        error={editError}
        onClose={closeEdit}
        onSave={requestSaveEdit}
        lockClose={pwOpen || confirmOpen}
      />

      <section className={cx("", THEME.border, THEME.surface)}>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900">Student Account</h2>
          <p className="mt-1 text-sm sm:text-base font-medium text-slate-600">
            Search by name, email, student ID, course, or created month.
          </p>
        </div>
      </section>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <input
            name="cc-student-search"            // prevents collisions with generic names
            autoComplete="new-password"         // more reliable than "off" in some browsers
            inputMode="search"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, student ID…"
            className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm sm:text-base font-medium text-slate-900 outline-none focus:outline-none focus:ring-0 touch-manipulation"
          />
        </div>
        {isLoadingStudents ? <div className="text-sm font-medium text-slate-600">Loading…</div> : null}
      </div>

      <section className={cx("rounded-2xl border overflow-hidden", THEME.border, THEME.surface)}>
        <div className={cx("px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap", THEME.border, THEME.surfaceMuted)}>
          <div className="text-base font-semibold text-slate-900">
            Students <span className="text-slate-500 font-medium">({total})</span>
          </div>
          <div className="text-sm font-medium text-slate-600">{total === 0 ? "" : `Showing ${startIdx + 1}–${endIdx}`}</div>
        </div>

        {total === 0 ? (
          <div className="px-4 py-8 text-sm sm:text-base font-medium text-slate-600">
            {isLoadingStudents ? "Loading students..." : "No students found. Try a different keyword."}
          </div>
        ) : (
          <div
            ref={listRef}
            className={cx(
              "divide-y divide-slate-100",
              pageAnim === "in-right" ? "cc-page-in-right" : "",
              pageAnim === "in-left" ? "cc-page-in-left" : ""
            )}
            onPointerDown={onListPointerDown}
            onPointerMove={onListPointerMove}
            onPointerUp={onListPointerUp}
            onPointerCancel={onListPointerCancel}
            style={{ touchAction: isMobile ? "pan-y" : "auto" }}
            aria-label={isMobile ? "Swipe left/right to change page" : undefined}
          >
            {pagedStudents.map((s) => {
              const fullName = buildFullName(s);
              const primary = fullName || safeText(s?.email);
              const secondary = fullName ? safeText(s?.email) : "";

              return (
                <div
                  key={normalizeEmail(s?.email) || `${safeText(s?.studentNumber)}-${safeText(s?.createdMonth)}`}
                  className="px-4 py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-semibold text-slate-900 break-words">{primary}</div>
                    {secondary ? <div className="mt-0.5 text-sm font-medium text-slate-600 break-words">{secondary}</div> : null}
                    {s?.studentId || s?.studentNumber ? (
                      <div className="mt-0.5 text-xs font-semibold text-slate-400 break-words">
                        ID: {safeText(s?.studentId || s?.studentNumber)}
                      </div>
                    ) : null}
                    {s?.createdMonth ? (
                      <div className="mt-0.5 text-xs font-semibold text-slate-400 break-words">
                        Created: {safeText(s?.createdMonth)}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all inline-flex items-center justify-center outline-none focus:outline-none focus:ring-0 touch-manipulation cc-focus cc-clickable"
                      aria-label="Edit profile"
                      title="Edit profile"
                    >
                      <IconEdit className="w-5 h-5 text-slate-900" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={cx("px-4 pb-4", THEME.surface)}>
          <CalendarPagination
            isMobile={isMobile}
            safePage={safePage}
            totalPages={totalPages}
            pageWindow={pageWindow}
            onPrev={() => goToPage(safePage - 1)}
            onNext={() => goToPage(safePage + 1)}
            onPage={(n) => goToPage(n)}
          />
        </div>
      </section>
    </div>
  );
}