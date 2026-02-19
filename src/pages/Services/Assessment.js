// /components/PHQ9.jsx
import { useMemo, useRef, useState, useEffect, useCallback, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/** CheckIn palette (match Journal) */
const CHECKIN_GREEN = "#B9FF66";
const CHECKIN_DARK = "#141414";

const ANSWER_COUNT = 9;
const AUTO_NEXT_MS = 180;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * ✅ Layout spacing (readable + navbar-safe)
 * If you set: :root { --app-nav-h: 72px; } this will adapt automatically.
 */
const NAVBAR_H = "var(--app-nav-h, 72px)";
const PAGE_TOP_PAD = `calc(${NAVBAR_H} + 16px)`; // space below navbar
const STICKY_TOP = `calc(${NAVBAR_H} + 12px)`; // sticky header offset (below navbar)
const ACTIONS_STICKY_TOP = `calc(${NAVBAR_H} + 96px)`; // right column offset below sticky header

/** ✅ Text scale for readability */
const TXT = {
  base: "text-[16px] sm:text-[17px] leading-relaxed",
  xs: "text-[14px] sm:text-[15px]",
  sm: "text-[15px] sm:text-[16px]",
  md: "text-[16px] sm:text-[17px]",
  lg: "text-[18px] sm:text-[20px]",
  xl: "text-[20px] sm:text-[22px] lg:text-[26px]",
};

/** Visual tokens (reduce giant inline style blobs) */
const STYLES = {
  pageBg: {
    background: `
      radial-gradient(1100px 520px at 18% 0%, rgba(185,255,102,0.48) 0%, rgba(185,255,102,0.00) 58%),
      radial-gradient(980px 480px at 70% 6%, rgba(218,252,182,0.55) 0%, rgba(218,252,182,0.00) 62%),
      radial-gradient(900px 420px at 30% 28%, rgba(211,243,176,0.40) 0%, rgba(211,243,176,0.00) 60%),
      radial-gradient(760px 360px at 82% 36%, rgba(224,252,193,0.28) 0%, rgba(224,252,193,0.00) 62%),
      radial-gradient(820px 420px at 12% 62%, rgba(199,227,168,0.25) 0%, rgba(199,227,168,0.00) 62%),
      linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 58%, #F7F7F7 100%)
    `,
  },
  headerGlow: {
    background: `radial-gradient(900px 260px at 12% 0%, ${CHECKIN_GREEN} 0%, transparent 62%),
                radial-gradient(700px 240px at 90% 20%, rgba(20,20,20,0.10) 0%, transparent 60%)`,
  },
  headerDots: {
    backgroundImage: "radial-gradient(rgba(0,0,0,0.35) 1px, transparent 1px)",
    backgroundSize: "24px 24px",
    maskImage: "radial-gradient(800px 260px at 30% 20%, black 0%, transparent 70%)",
    WebkitMaskImage: "radial-gradient(800px 260px at 30% 20%, black 0%, transparent 70%)",
  },
};

/**
 * ✅ Privacy: store sensitive answers in sessionStorage by default
 * ✅ Non-sensitive: store last submission timestamp in localStorage
 */
const STORAGE = {
  getItem(key) {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem(key) {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

const PUBLIC_STORAGE = {
  getItem(key) {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      try {
        return window.sessionStorage.getItem(key);
      } catch {
        return null;
      }
    }
  },
  setItem(key, value) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      // fallback
    }
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem(key) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
      return;
    } catch {
      // fallback
    }
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

const LS_KEYS = {
  answers: "phq9_answers",
  submitted: "phq9_submitted",
  termsAccepted: "phq9_terms_accepted",
  lastSubmittedAt: "phq9_last_submitted_at",
};

/** Questions */
const QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things (e.g., studying)",
  "Moving or speaking slowly, or being restless",
  "Thoughts that you would be better off dead or hurting yourself",
];

const OPTIONS = [
  { label: "Not at all", value: 0, hint: "0 days" },
  { label: "Several days", value: 1, hint: "1–6 days" },
  { label: "More than half the days", value: 2, hint: "7–11 days" },
  { label: "Nearly every day", value: 3, hint: "12–14 days" },
];

/** Helpers */
function isBrowser() {
  return typeof window !== "undefined";
}
function safeParseJSON(value, fallback) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function clampAnswer(v) {
  if (v === null) return null;
  if (typeof v !== "number") return null;
  if (v < 0 || v > 3) return null;
  return v;
}
function normalizeAnswers(raw) {
  if (!Array.isArray(raw) || raw.length !== ANSWER_COUNT) return Array(ANSWER_COUNT).fill(null);
  return raw.map(clampAnswer);
}
function optionLabelForValue(v) {
  const opt = OPTIONS.find((o) => o.value === v);
  return opt ? opt.label : "—";
}

/** Terms + Privacy text */
function defaultTermsText() {
  return [
    "This check is a screening tool and not a medical diagnosis.",
    "If you feel unsafe or in immediate danger, contact local emergency services right away.",
    "By continuing, you confirm you understand and agree to these terms.",
  ];
}
function defaultPrivacyText() {
  return [
    "We store your responses in this browser session (sessionStorage) by default.",
    "We only use your answers to provide screening feedback and wellness guidance.",
    "You can reset before submitting. After submitting, the weekly lock makes it read-only.",
  ];
}

/** Date formatting */
function formatDateTime(ms) {
  if (!ms || typeof ms !== "number") return "";
  try {
    const d = new Date(ms);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return new Date(ms).toLocaleString();
  }
}

/** ICS helpers (weekly recurring event) */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toICSLocalDateTime(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(
    d.getMinutes()
  )}${pad2(d.getSeconds())}`;
}
function makeWeeklyCheckInICS({ startAtMs, title = "PHQ-9 Weekly Check-In", durationMinutes = 15 }) {
  const start = new Date(startAtMs);
  const end = new Date(startAtMs + durationMinutes * 60 * 1000);
  const uid = `phq9-${startAtMs}-${Math.random().toString(16).slice(2)}@checkin`;
  const dtstamp = toICSLocalDateTime(new Date());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CheckIn//PHQ9//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${title}`,
    `DTSTART:${toICSLocalDateTime(start)}`,
    `DTEND:${toICSLocalDateTime(end)}`,
    "RRULE:FREQ=WEEKLY;INTERVAL=1",
    "DESCRIPTION:Weekly PHQ-9 wellness check-in.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
function downloadTextFile({ filename, text, mime }) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Severity + tips (score hidden) */
function getSeverityLabel(score) {
  if (score <= 4) return "Minimal";
  if (score <= 9) return "Mild";
  if (score <= 14) return "Moderate";
  if (score <= 19) return "Moderately High";
  return "High";
}
function getWellnessTips(label) {
  switch (label) {
    case "Minimal":
      return [
        "Keep a steady routine: consistent sleep/wake times.",
        "Do one mood-lifting activity today (walk, sunlight, music, hobby).",
        "Quick check-in: “What’s one thing I did okay this week?”",
      ];
    case "Mild":
      return [
        "Pick one daily anchor: 10 minutes of movement or fresh air.",
        "Make goals tiny: 2 minutes still counts (build momentum).",
        "Connect once today: text/call someone you trust.",
      ];
    case "Moderate":
      return [
        "Use structure: 2–3 simple tasks/day (eat, shower, step outside counts).",
        "Try grounding: 5-4-3-2-1 senses for 60 seconds.",
        "Consider scheduling with a counselor/therapist or talking to your primary care doctor.",
      ];
    case "Moderately High":
      return [
        "Prioritize support: ask someone safe to check in with you this week.",
        "Make a low-energy plan for meals, sleep, and responsibilities.",
        "Schedule a counselor/therapist appointment soon, or reach out to your doctor.",
      ];
    case "High":
      return [
        "Schedule with a counselor/therapist as soon as possible (or contact your doctor/clinic today).",
        "Lean on support: reach out to someone you trust and don’t isolate with these feelings.",
        "If you feel unsafe or might harm yourself, seek immediate help via local emergency services or a crisis line.",
      ];
    default:
      return [];
  }
}
function getSafetyNoteForQ9(q9Value) {
  if (q9Value === null) return null;
  if (q9Value > 0) {
    return "Important: If you feel like you might act on these thoughts or you’re in immediate danger, seek urgent help now (local emergency number / crisis support). If you can, reach out to someone you trust and don’t stay alone.";
  }
  return null;
}

/** Focus trap helpers */
function getFocusableElements(container) {
  if (!container) return [];
  const selectors = [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  return Array.from(container.querySelectorAll(selectors.join(","))).filter(
    (el) => el.offsetParent !== null && !el.getAttribute("aria-hidden")
  );
}
function useFocusTrap({ open, onClose }) {
  const containerRef = useRef(null);
  const lastActiveRef = useRef(null);

  useEffect(() => {
    if (!isBrowser()) return;
    if (!open) return;

    lastActiveRef.current = document.activeElement;

    const container = containerRef.current;
    const focusables = getFocusableElements(container);
    const toFocus = focusables[0] || container;
    if (toFocus && typeof toFocus.focus === "function") {
      setTimeout(() => toFocus.focus(), 0);
    }

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const items = getFocusableElements(containerRef.current);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === containerRef.current) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const lastActive = lastActiveRef.current;
      if (lastActive && typeof lastActive.focus === "function") {
        setTimeout(() => lastActive.focus(), 0);
      }
    };
  }, [open, onClose]);

  return containerRef;
}

/** Icons */
function IconInfo({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10.5v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 7.2h.01" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
function IconCheck({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChevron({ dir = "right", className = "" }) {
  const rotate = dir === "left" ? "rotate-180" : "";
  return (
    <svg viewBox="0 0 24 24" className={`${className} ${rotate}`} fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Journal-aligned Glass card */
function GlassCard({ title, right, children, className = "" }) {
  return (
    <div
      className={[
        "relative overflow-hidden",
        "rounded-[26px] border border-black/10",
        "bg-white/78 backdrop-blur-xl",
        "shadow-[0_18px_60px_rgba(0,0,0,0.08)]",
        className,
      ].join(" ")}
    >
      {(title || right) && (
        <div className="px-5 py-4 bg-black/[0.02] flex items-center justify-between gap-3">
          <div className={`font-extrabold text-[#141414] flex items-center gap-2 ${TXT.sm}`} style={{ fontFamily: "Lora, serif" }}>
            {title}
          </div>
          {right}
        </div>
      )}
      <div className={title || right ? "p-5 lg:p-6" : ""}>{children}</div>
    </div>
  );
}

/** Journal-aligned background FX */
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
        animate={reduce ? {} : { x: [0, 44, -24, 0], y: [0, 22, 56, 0], scale: [1, 1.08, 0.98, 1] }}
        transition={reduce ? {} : { duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -top-40 -right-44 h-[680px] w-[680px] rounded-full blur-3xl"
        style={blob("rgba(218,252,182,0.95)", "rgba(218,252,182,0.00)", 0.34)}
        animate={reduce ? {} : { x: [0, -36, 18, 0], y: [0, 26, -14, 0], scale: [1, 1.06, 1.0, 1] }}
        transition={reduce ? {} : { duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[18%] left-[18%] h-[720px] w-[720px] rounded-full blur-3xl"
        style={blob("rgba(211,243,176,0.85)", "rgba(211,243,176,0.00)", 0.26)}
        animate={reduce ? {} : { x: [0, 24, -18, 0], y: [0, -10, 20, 0], scale: [1, 1.04, 0.99, 1] }}
        transition={reduce ? {} : { duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-44 -left-40 h-[640px] w-[640px] rounded-full blur-3xl"
        style={blob("rgba(224,252,193,0.85)", "rgba(224,252,193,0.00)", 0.22)}
        animate={reduce ? {} : { x: [0, 22, -10, 0], y: [0, -18, 12, 0], scale: [1, 1.05, 1.0, 1] }}
        transition={reduce ? {} : { duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[10%] right-[6%] h-[560px] w-[560px] rounded-full blur-3xl"
        style={blob("rgba(20,20,20,0.10)", "rgba(20,20,20,0.00)", 0.16)}
        animate={reduce ? {} : { x: [0, -18, 10, 0], y: [0, 16, -10, 0], scale: [1, 1.03, 1.0, 1] }}
        transition={reduce ? {} : { duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

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

function ModalShell({ open, titleId, descId, onClose, closeOnBackdrop = true, children }) {
  const trapRef = useFocusTrap({ open, onClose });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-start sm:items-center justify-center px-4 py-4 sm:py-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <div className="absolute inset-0 bg-black/50" onClick={closeOnBackdrop ? onClose : undefined} aria-hidden />
          <motion.div
            ref={trapRef}
            tabIndex={-1}
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-2xl rounded-[22px] border border-black/10 bg-white shadow-2xl overflow-hidden outline-none"
            style={{ maxHeight: "calc(100vh - 32px)" }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InfoModal({ open, onClose, termsAccepted, onAccept }) {
  const terms = defaultTermsText();
  const privacy = defaultPrivacyText();
  const mandatory = !termsAccepted;

  return (
    <ModalShell open={open} onClose={mandatory ? undefined : onClose} closeOnBackdrop={!mandatory} titleId="info-title" descId="info-desc">
      <div className="flex flex-col" style={{ maxHeight: "calc(100vh - 32px)" }}>
        <div
          className="p-5 overflow-y-auto"
          style={{ background: `radial-gradient(780px 240px at 15% 0%, rgba(185,255,102,0.92) 0%, rgba(185,255,102,0.22) 35%, transparent 68%)` }}
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: CHECKIN_GREEN, color: CHECKIN_DARK }}>
              <IconInfo className="h-6 w-6" />
            </div>

            <div className="flex-1">
              <div id="info-title" className="font-extrabold text-[#141414] text-[18px] sm:text-[20px]" style={{ fontFamily: "Lora, serif" }}>
                Terms &amp; Privacy
              </div>
              <div id="info-desc" className={`${TXT.xs} text-black/60 mt-1`}>
                {mandatory ? "Please accept to begin." : "View terms and privacy info anytime."}
              </div>
            </div>

            {!mandatory && (
              <button onClick={onClose} className="text-black/60 hover:text-black font-bold" aria-label="Close" type="button">
                ✕
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <div className={`font-extrabold text-[#141414] ${TXT.sm}`}>Terms</div>
              <ul className={`mt-2 text-black/70 leading-relaxed list-disc pl-5 space-y-2 ${TXT.xs}`}>
                {terms.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <div className={`font-extrabold text-[#141414] ${TXT.sm}`}>Privacy</div>
              <ul className={`mt-2 text-black/70 leading-relaxed list-disc pl-5 space-y-2 ${TXT.xs}`}>
                {privacy.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-black/10 bg-white">
          {mandatory ? (
            <button onClick={onAccept} className={`w-full rounded-full py-3 font-extrabold ${TXT.sm}`} style={{ backgroundColor: CHECKIN_DARK, color: "white" }} type="button">
              I Agree &amp; Start
            </button>
          ) : (
            <button onClick={onClose} className={`w-full rounded-full py-3 font-extrabold ${TXT.sm}`} style={{ backgroundColor: CHECKIN_DARK, color: "white" }} type="button">
              Close
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/** Reset confirmation modal */
function ResetConfirmModal({ open, onClose, onConfirm }) {
  return (
    <ModalShell open={open} onClose={onClose} titleId="reset-title" descId="reset-desc">
      <div className="p-5">
        <div id="reset-title" className="font-extrabold text-[#141414] text-[18px] sm:text-[20px]" style={{ fontFamily: "Lora, serif" }}>
          Reset assessment?
        </div>
        <p id="reset-desc" className={`mt-2 text-black/60 ${TXT.xs}`}>
          This clears answers and starts over. Weekly submission lock still applies.
        </p>

        <div className="mt-4 flex gap-2">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClose}
            className={`flex-1 rounded-full py-3 font-extrabold bg-white hover:bg-black/5 transition ${TXT.sm}`}
            style={{ border: "1px solid rgba(0,0,0,0.15)", color: CHECKIN_DARK }}
            type="button"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onConfirm}
            className={`flex-1 rounded-full py-3 font-extrabold ${TXT.sm}`}
            style={{ backgroundColor: CHECKIN_DARK, color: "white" }}
            type="button"
          >
            Reset
          </motion.button>
        </div>
      </div>
    </ModalShell>
  );
}

/** Buttons */
function PillButton({ onClick, disabled, children, icon, className = "" }) {
  return (
    <motion.button
      whileHover={!disabled ? { y: -1, rotate: -0.2 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-2 rounded-full border border-black/15",
        "bg-white/85 backdrop-blur px-4 py-2 font-extrabold text-black/70 hover:bg-black/5 transition disabled:opacity-60",
        TXT.xs,
        className,
      ].join(" ")}
      type="button"
      style={{ boxShadow: disabled ? "none" : "0 10px 22px rgba(0,0,0,0.04)" }}
    >
      {icon}
      {children}
    </motion.button>
  );
}
function PrimaryButton({ onClick, disabled, children }) {
  return (
    <motion.button
      whileHover={!disabled ? { y: -1 } : undefined}
      whileTap={!disabled ? { scale: 0.99 } : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full py-3 font-extrabold transition disabled:opacity-50 disabled:cursor-not-allowed ${TXT.sm}`}
      style={{
        backgroundColor: disabled ? "rgba(0,0,0,0.05)" : CHECKIN_GREEN,
        color: CHECKIN_DARK,
        border: "1px solid rgba(0,0,0,0.15)",
        boxShadow: disabled ? "none" : "0 18px 50px rgba(185,255,102,0.45)",
      }}
      type="button"
    >
      {children}
    </motion.button>
  );
}
function SecondaryButton({ onClick, disabled, children }) {
  return (
    <motion.button
      whileHover={!disabled ? { y: -1 } : undefined}
      whileTap={!disabled ? { scale: 0.99 } : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full py-3 font-extrabold bg-white/85 backdrop-blur hover:bg-black/5 transition disabled:opacity-50 disabled:cursor-not-allowed ${TXT.sm}`}
      style={{ border: "1px solid rgba(0,0,0,0.15)", color: CHECKIN_DARK }}
      type="button"
    >
      {children}
    </motion.button>
  );
}

/** Step dots */
function StepDot({ active, done, index, onClick, disabled }) {
  const bg = done ? "rgba(185,255,102,0.60)" : active ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.90)";
  const border = active ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.14)";
  const bubble = done ? "rgba(20,20,20,0.90)" : active ? "rgba(185,255,102,0.55)" : "rgba(0,0,0,0.10)";

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={!disabled ? { y: -1 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className="h-10 w-10 rounded-full border font-extrabold transition disabled:opacity-60 inline-flex items-center justify-center text-[14px] sm:text-[15px]"
      style={{ background: bg, borderColor: border, color: CHECKIN_DARK }}
      title={done ? "Answered" : "Not answered"}
    >
      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full" style={{ background: bubble, color: done ? "white" : CHECKIN_DARK }}>
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.span
              key="done"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="inline-flex items-center justify-center leading-none"
            >
              <IconCheck className="h-4 w-4" />
            </motion.span>
          ) : (
            <motion.span key="num" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="leading-none">
              {index + 1}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

/** Option card */
function OptionCard({ label, hint, active, disabled, onSelect }) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      whileHover={!disabled ? { y: -2, rotate: -0.2 } : undefined}
      whileTap={!disabled ? { scale: 0.99 } : undefined}
      className="rounded-2xl border px-4 py-4 text-left transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/20"
      style={{
        borderColor: active ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.12)",
        background: active
          ? "linear-gradient(180deg, rgba(185,255,102,0.44) 0%, rgba(185,255,102,0.16) 100%)"
          : "rgba(255,255,255,0.92)",
        boxShadow: active ? "0 14px 40px rgba(0,0,0,0.10)" : "0 10px 26px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-extrabold text-[#141414] text-[15px] sm:text-[16px]">{label}</div>
          <div className="text-black/55 mt-1 text-[14px] sm:text-[15px]">{hint}</div>
        </div>

        <div
          className="h-9 w-9 rounded-full border flex items-center justify-center shrink-0"
          style={{
            borderColor: active ? "rgba(20,20,20,0.28)" : "rgba(0,0,0,0.15)",
            background: active ? CHECKIN_DARK : "white",
            boxShadow: active ? `0 10px 18px rgba(0,0,0,0.10)` : undefined,
          }}
        >
          <AnimatePresence initial={false}>
            {active && (
              <motion.div
                key="check"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="text-white inline-flex items-center justify-center leading-none"
              >
                <IconCheck className="h-4 w-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.button>
  );
}

/** Review modal */
function ReviewModal({ open, onClose, answers, onEdit, canEdit }) {
  return (
    <ModalShell open={open} onClose={onClose} titleId="review-title" descId="review-desc">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div id="review-title" className="font-extrabold text-[#141414] text-[18px] sm:text-[20px]" style={{ fontFamily: "Lora, serif" }}>
              Review answers
            </div>
            <div id="review-desc" className={`text-black/60 mt-1 ${TXT.xs}`}>
              {canEdit ? "Tap any row to edit." : "View-only."}
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05, rotate: 2 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClose}
            className="text-black/60 hover:text-black font-bold"
            aria-label="Close"
            type="button"
          >
            ✕
          </motion.button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-black/10 bg-white">
          <div className="divide-y divide-black/10">
            {QUESTIONS.map((q, idx) => {
              const v = answers[idx];
              const missing = v === null;

              const Row = ({ children }) =>
                canEdit ? (
                  <button type="button" onClick={() => onEdit(idx)} className="w-full text-left p-4 hover:bg-black/5 transition">
                    {children}
                  </button>
                ) : (
                  <div className="w-full text-left p-4">{children}</div>
                );

              return (
                <Row key={idx}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`font-extrabold text-black/60 ${TXT.xs}`}>Q{idx + 1}</div>
                      <div className={`font-extrabold text-[#141414] mt-1 leading-snug ${TXT.sm}`}>{q}</div>
                      <div className={`mt-2 ${TXT.xs}`}>
                        <span className="font-extrabold text-black/60">Answer: </span>
                        <span className={missing ? "text-red-600 font-extrabold" : "text-black/70"}>
                          {missing ? "Missing" : optionLabelForValue(v)}
                        </span>
                      </div>
                    </div>

                    {canEdit && (
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 font-extrabold ${TXT.xs}`}
                        style={{
                          background: missing ? "rgba(239,68,68,0.12)" : "rgba(185,255,102,0.42)",
                          color: missing ? "rgb(185,28,28)" : CHECKIN_DARK,
                          border: "1px solid rgba(0,0,0,0.10)",
                        }}
                      >
                        {missing ? "Fix" : "Edit"}
                      </span>
                    )}
                  </div>
                </Row>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <SecondaryButton onClick={onClose} disabled={false}>
            Close
          </SecondaryButton>
        </div>
      </div>
    </ModalShell>
  );
}

export default function PHQ9() {
  const shouldReduceMotion = useReducedMotion();
  const progressId = useId();

  const [answers, setAnswers] = useState(() => Array(ANSWER_COUNT).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null);
  const [nowMs, setNowMs] = useState(() => (isBrowser() ? Date.now() : 0));

  const prevIndexRef = useRef(0);
  const autoNextTimeoutRef = useRef(null);
  const didInitialResumeRef = useRef(false);
  const userNavigatedRef = useRef(false);
  const navDirRef = useRef(1);

  const answeredCount = useMemo(() => answers.filter((a) => a !== null).length, [answers]);
  const canSubmit = answeredCount === ANSWER_COUNT;

  const lockUntilMs = useMemo(() => {
    if (!lastSubmittedAt || typeof lastSubmittedAt !== "number") return null;
    return lastSubmittedAt + WEEK_MS;
  }, [lastSubmittedAt]);

  const weeklyLocked = useMemo(() => {
    if (!lockUntilMs) return false;
    return nowMs < lockUntilMs;
  }, [nowMs, lockUntilMs]);

  const readOnly = submitted || weeklyLocked;

  const nextAvailableText = useMemo(() => {
    if (!lockUntilMs) return null;
    return formatDateTime(lockUntilMs);
  }, [lockUntilMs]);

  const lastSubmittedText = useMemo(() => {
    if (!lastSubmittedAt) return null;
    return formatDateTime(lastSubmittedAt);
  }, [lastSubmittedAt]);

  const canSubmitNow = canSubmit && !submitted && termsAccepted && !weeklyLocked;
  const isModalOpen = infoOpen || confirmReset || reviewOpen;

  const clearAutoNext = useCallback(() => {
    if (!isBrowser()) return;
    if (autoNextTimeoutRef.current) window.clearTimeout(autoNextTimeoutRef.current);
    autoNextTimeoutRef.current = null;
  }, []);

  const navigateTo = useCallback(
    (index) => {
      const nextIndex = Math.max(0, Math.min(QUESTIONS.length - 1, index));
      clearAutoNext();
      userNavigatedRef.current = true;
      navDirRef.current = nextIndex >= prevIndexRef.current ? 1 : -1;
      setActiveIndex(nextIndex);
    },
    [clearAutoNext]
  );

  /** Load from storage */
  useEffect(() => {
    if (!isBrowser()) return;

    const savedAnswers = normalizeAnswers(safeParseJSON(STORAGE.getItem(LS_KEYS.answers), Array(ANSWER_COUNT).fill(null)));
    const savedTerms = Boolean(safeParseJSON(STORAGE.getItem(LS_KEYS.termsAccepted), false));

    const allAnswered = savedAnswers.every((v) => v !== null);
    const savedSubmittedRaw = Boolean(safeParseJSON(STORAGE.getItem(LS_KEYS.submitted), false));
    const savedSubmitted = savedSubmittedRaw && allAnswered;

    const savedLastSubmittedAt = safeParseJSON(PUBLIC_STORAGE.getItem(LS_KEYS.lastSubmittedAt), null);
    const parsedLast = typeof savedLastSubmittedAt === "number" ? savedLastSubmittedAt : null;

    setAnswers(savedAnswers);
    setTermsAccepted(savedTerms);
    setSubmitted(savedSubmitted);
    setLastSubmittedAt(parsedLast);
    setNowMs(Date.now());

    if (!savedTerms) setInfoOpen(true);
  }, []);

  /** Persist */
  useEffect(() => STORAGE.setItem(LS_KEYS.answers, JSON.stringify(answers)), [answers]);
  useEffect(() => STORAGE.setItem(LS_KEYS.submitted, JSON.stringify(submitted)), [submitted]);
  useEffect(() => STORAGE.setItem(LS_KEYS.termsAccepted, JSON.stringify(termsAccepted)), [termsAccepted]);
  useEffect(() => PUBLIC_STORAGE.setItem(LS_KEYS.lastSubmittedAt, JSON.stringify(lastSubmittedAt)), [lastSubmittedAt]);

  /** Keep clock updated while locked */
  useEffect(() => {
    if (!isBrowser()) return;
    if (!weeklyLocked) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [weeklyLocked]);

  /** If answers become incomplete, ensure submitted can't stay true */
  useEffect(() => {
    if (!submitted) return;
    if (answers.some((a) => a === null)) setSubmitted(false);
  }, [submitted, answers]);

  /** Clear auto-next on unmount */
  useEffect(() => () => clearAutoNext(), [clearAutoNext]);

  /** Resume first unanswered ONCE */
  useEffect(() => {
    if (!termsAccepted) return;
    if (submitted) return;
    if (didInitialResumeRef.current) return;
    if (userNavigatedRef.current) return;

    didInitialResumeRef.current = true;
    const firstEmpty = answers.findIndex((a) => a === null);
    if (firstEmpty !== -1) setActiveIndex(firstEmpty);
  }, [answers, termsAccepted, submitted]);

  /** Track animation direction */
  const direction = navDirRef.current;
  useEffect(() => {
    prevIndexRef.current = activeIndex;
  }, [activeIndex]);

  function setAnswer(qIndex, value) {
    if (readOnly) return;
    if (!termsAccepted) return;
    if (value < 0 || value > 3) return;

    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = value;
      return next;
    });

    clearAutoNext();

    if (qIndex < QUESTIONS.length - 1) {
      autoNextTimeoutRef.current = window.setTimeout(() => {
        setActiveIndex((x) => (x === qIndex ? Math.min(x + 1, QUESTIONS.length - 1) : x));
      }, AUTO_NEXT_MS);
    }
  }

  function handleSubmit() {
    if (!canSubmitNow) return;
    clearAutoNext();
    const ts = Date.now();
    setLastSubmittedAt(ts);
    setNowMs(ts);
    setSubmitted(true);
  }

  function resetAssessment() {
    if (readOnly) return;
    clearAutoNext();
    userNavigatedRef.current = false;
    didInitialResumeRef.current = false;
    setAnswers(Array(ANSWER_COUNT).fill(null));
    setSubmitted(false);
    setActiveIndex(0);
  }

  const activeQuestion = QUESTIONS[activeIndex];
  const selected = answers[activeIndex];

  const totalScore = useMemo(() => {
    if (answers.some((a) => a === null)) return null;
    return answers.reduce((sum, v) => sum + (v ?? 0), 0);
  }, [answers]);

  const severityLabel = useMemo(() => {
    if (totalScore === null) return null;
    return getSeverityLabel(totalScore);
  }, [totalScore]);

  const wellnessTips = useMemo(() => (severityLabel ? getWellnessTips(severityLabel) : []), [severityLabel]);
  const q9SafetyNote = useMemo(() => getSafetyNoteForQ9(answers[8]), [answers]);
  const progressPct = useMemo(() => Math.round((answeredCount / ANSWER_COUNT) * 100), [answeredCount]);

  const slideVariants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -28 : 28 }),
  };

  /** Keyboard shortcuts */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isModalOpen) return;

      const target = e.target;
      const tag = target?.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;

      if (e.key >= "0" && e.key <= "3") {
        if (readOnly) return;
        setAnswer(activeIndex, Number(e.key));
        return;
      }

      const last = QUESTIONS.length - 1;

      if (e.key === "ArrowLeft") {
        if (activeIndex === 0) return;
        navigateTo(activeIndex - 1);
        return;
      }
      if (e.key === "ArrowRight") {
        if (activeIndex === last) return;
        navigateTo(activeIndex + 1);
        return;
      }
      if (e.key === "Enter") {
        if (activeIndex === last) return;
        if (answers[activeIndex] === null) return;
        navigateTo(activeIndex + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen, readOnly, activeIndex, navigateTo, answers]);

  const calendarStartAtMs = useMemo(() => {
    const base = lockUntilMs && lockUntilMs > nowMs ? lockUntilMs : nowMs;
    const d = new Date(base);
    d.setHours(9, 0, 0, 0);
    if (d.getTime() < base) d.setDate(d.getDate() + 1);
    return d.getTime();
  }, [lockUntilMs, nowMs]);

  function handleAddToCalendarWeekly() {
    if (!isBrowser()) return;
    const ics = makeWeeklyCheckInICS({ startAtMs: calendarStartAtMs });
    downloadTextFile({ filename: "phq9-weekly-checkin.ics", text: ics, mime: "text/calendar;charset=utf-8" });
  }

  const headerStatusText = useMemo(() => {
    if (!termsAccepted) return "Accept Terms & Privacy to begin.";
    if (submitted) return "Submitted (read-only).";
    if (weeklyLocked && nextAvailableText) return `Weekly lock — next submit: ${nextAvailableText}`;
    if (!canSubmit) return "Answer all 9 questions to enable submit.";
    return "All set — review then submit.";
  }, [termsAccepted, submitted, weeklyLocked, nextAvailableText, canSubmit]);

  const primaryActionLabel = useMemo(() => {
    if (submitted) return "Submitted";
    if (weeklyLocked) return "Weekly lock active";
    if (!termsAccepted) return "Accept to begin";
    if (!canSubmit) return "Complete all questions";
    return "Submit Assessment";
  }, [submitted, weeklyLocked, termsAccepted, canSubmit]);

  const disableInteractions = isModalOpen || !termsAccepted || readOnly;

  function openReview() {
    if (!termsAccepted) return;
    setReviewOpen(true);
  }

  function onEditFromReview(idx) {
    if (readOnly) return;
    setReviewOpen(false);
    navigateTo(idx);
  }

  return (
    <div
      className={`min-h-screen relative overflow-hidden ${TXT.base}`}
      style={{
        fontFamily: "Nunito, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        ...STYLES.pageBg,
      }}
      aria-hidden={isModalOpen ? "true" : undefined}
    >
      {/* If you don't load fonts globally, keep this. Otherwise remove it. */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:wght@400;600;700&display=swap');`}</style>

      <BackgroundFX />

      {/* ===== Modals ===== */}
      <InfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        termsAccepted={termsAccepted}
        onAccept={() => {
          setTermsAccepted(true);
          setInfoOpen(false);
        }}
      />
      <ResetConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          resetAssessment();
        }}
      />
      <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} answers={answers} onEdit={onEditFromReview} canEdit={!readOnly && termsAccepted} />

      {/* ===== Page Wrapper (adds space under global navbar) ===== */}
      <div className="pb-10 relative z-[1]" style={{ paddingTop: PAGE_TOP_PAD }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-6">
          {/* ===== Sticky Header (below navbar + extra space) ===== */}
          <div className="sticky z-20 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 pb-3" style={{ top: STICKY_TOP }}>
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
              className="relative rounded-[28px] border border-black/10 bg-white/78 backdrop-blur-xl shadow-[0_22px_70px_rgba(0,0,0,0.10)] p-5 sm:p-6 lg:p-7 overflow-hidden"
            >
              <div className="absolute inset-0 opacity-35" style={STYLES.headerGlow} />
              <motion.div
                className="absolute inset-0 opacity-[0.10]"
                style={STYLES.headerDots}
                animate={shouldReduceMotion ? {} : { backgroundPosition: ["0px 0px", "24px 24px"] }}
                transition={shouldReduceMotion ? {} : { duration: 10, repeat: Infinity, ease: "linear" }}
              />

              <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <motion.div
                    className="h-11 w-11 rounded-2xl flex items-center justify-center shadow-sm shrink-0"
                    style={{ backgroundColor: CHECKIN_GREEN, color: CHECKIN_DARK }}
                    initial={{ rotate: -2 }}
                    animate={shouldReduceMotion ? {} : { rotate: [-2, 2, -2] }}
                    transition={shouldReduceMotion ? {} : { duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden="true"
                  >
                    <IconInfo className="h-6 w-6" />
                  </motion.div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className={`font-black text-[#141414] leading-tight ${TXT.xl}`} style={{ fontFamily: "Lora, serif" }}>
                        CheckIn: PHQ-9
                      </h1>

                      {submitted && (
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 font-extrabold ${TXT.xs}`}
                          style={{ backgroundColor: CHECKIN_GREEN, color: CHECKIN_DARK, borderColor: "rgba(0,0,0,0.15)" }}
                        >
                          Submitted
                        </span>
                      )}

                      {!submitted && weeklyLocked && (
                        <span className={`inline-flex items-center rounded-full border border-black/15 bg-black/5 px-3 py-1 font-extrabold text-black/70 ${TXT.xs}`}>
                          Weekly lock
                        </span>
                      )}
                    </div>

                    <div className={`mt-2 font-extrabold text-black/60 ${TXT.xs}`}>{headerStatusText}</div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <PillButton onClick={() => setInfoOpen(true)} disabled={false} icon={<IconInfo className="h-4 w-4" />}>
                        Terms &amp; Privacy
                      </PillButton>

                      <PillButton onClick={handleAddToCalendarWeekly} disabled={!termsAccepted} icon={<span className="text-[16px] leading-none">🗓</span>}>
                        Weekly reminder
                      </PillButton>

                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-2 font-extrabold ${TXT.xs}`}
                        style={{ background: "rgba(185,255,102,0.18)", borderColor: "rgba(0,0,0,0.10)", color: CHECKIN_DARK }}
                        aria-label="Progress"
                      >
                        {progressPct}% done
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                    {QUESTIONS.map((_, i) => (
                      <StepDot key={i} index={i} active={i === activeIndex} done={answers[i] !== null} disabled={isModalOpen} onClick={() => navigateTo(i)} />
                    ))}
                  </div>

                  <div className="mt-1">
                    <div className={`font-extrabold text-black/60 flex items-center justify-between ${TXT.xs}`}>
                      <span>Progress</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-black/10" aria-labelledby={progressId}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "linear-gradient(180deg, #B9FF66, #A3F635)" }}
                        initial={false}
                        animate={{ width: `${progressPct}%` }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
                      />
                    </div>
                    <span id={progressId} className="sr-only">
                      PHQ-9 progress bar
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ===== Space between sticky header + content ===== */}
          <div className="h-3" />

          {/* ===== Main Content Grid ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start pb-24 lg:pb-10">
            {/* ===== Left: Question ===== */}
            <div className="lg:col-span-2">
              <GlassCard
                title={
                  <span className="flex items-center gap-2">
                    Question {activeIndex + 1} of {ANSWER_COUNT}
                  </span>
                }
                right={
                  <div className={`text-black/60 ${TXT.xs}`}>
                    <AnimatePresence initial={false}>
                      {selected !== null ? (
                        <motion.span
                          key="saved"
                          initial={{ opacity: 0, y: -3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.16 }}
                          className="inline-flex items-center gap-2 font-extrabold"
                        >
                          <span className="h-8 w-8 rounded-full border border-black/10 inline-flex items-center justify-center" style={{ backgroundColor: CHECKIN_DARK, color: "white" }}>
                            <IconCheck className="h-4 w-4" />
                          </span>
                          Saved
                        </motion.span>
                      ) : (
                        <span key="pick" className="font-extrabold">
                          Pick one
                        </span>
                      )}
                    </AnimatePresence>
                  </div>
                }
              >
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={activeIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
                  >
                    <div className={`font-extrabold text-[#141414] leading-snug ${TXT.lg}`}>{activeQuestion}</div>
                    <div className={`mt-2 text-black/60 ${TXT.xs}`}>Over the last 2 weeks, how often have you been bothered by this?</div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={`PHQ-9 question ${activeIndex + 1}`}>
                      {OPTIONS.map((opt) => (
                        <OptionCard
                          key={opt.value}
                          label={opt.label}
                          hint={opt.hint}
                          active={selected === opt.value}
                          disabled={disableInteractions}
                          onSelect={() => setAnswer(activeIndex, opt.value)}
                        />
                      ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <motion.button
                        type="button"
                        onClick={() => navigateTo(activeIndex - 1)}
                        disabled={activeIndex === 0 || isModalOpen}
                        whileHover={activeIndex !== 0 && !isModalOpen ? { y: -1 } : undefined}
                        whileTap={activeIndex !== 0 && !isModalOpen ? { scale: 0.99 } : undefined}
                        className={`rounded-full px-5 py-3 font-extrabold bg-white/85 backdrop-blur hover:bg-black/5 transition disabled:opacity-40 ${TXT.sm}`}
                        style={{ border: "1px solid rgba(0,0,0,0.14)", color: CHECKIN_DARK, boxShadow: "0 14px 30px rgba(0,0,0,0.05)" }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <IconChevron dir="left" className="h-4 w-4" />
                          Prev
                        </span>
                      </motion.button>

                      <motion.button
                        type="button"
                        onClick={() => navigateTo(activeIndex + 1)}
                        disabled={activeIndex === QUESTIONS.length - 1 || isModalOpen}
                        whileHover={activeIndex !== QUESTIONS.length - 1 && !isModalOpen ? { y: -1 } : undefined}
                        whileTap={activeIndex !== QUESTIONS.length - 1 && !isModalOpen ? { scale: 0.99 } : undefined}
                        className={`rounded-full px-5 py-3 font-extrabold bg-white/85 backdrop-blur hover:bg-black/5 transition disabled:opacity-40 ${TXT.sm}`}
                        style={{ border: "1px solid rgba(0,0,0,0.14)", color: CHECKIN_DARK, boxShadow: "0 14px 30px rgba(0,0,0,0.05)" }}
                      >
                        <span className="inline-flex items-center gap-1">
                          Next
                          <IconChevron className="h-4 w-4" />
                        </span>
                      </motion.button>
                    </div>

                    {readOnly && (
                      <div className={`mt-4 rounded-2xl border border-black/10 bg-black/5 p-4 text-black/70 ${TXT.xs}`}>
                        This assessment is currently <span className="font-extrabold">read-only</span>{" "}
                        {submitted ? "because it was submitted." : "because the weekly lock is active."}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </GlassCard>

              {submitted && (
                <div className="mt-4 space-y-4">
                  <GlassCard title="Results">
                    <div className={`rounded-2xl border border-black/10 bg-black/5 p-4 text-black/70 ${TXT.sm}`}>
                      Thank you. Your responses have been recorded.
                    </div>

                    {severityLabel && (
                      <div className="mt-4 rounded-2xl border border-black/10 bg-white/85 p-4">
                        <div className={`font-extrabold text-[#141414] ${TXT.sm}`}>
                          Severity: <span className="text-black/70">{severityLabel}</span>
                        </div>

                        <div className={`mt-4 font-extrabold text-[#141414] ${TXT.sm}`}>Wellness tips</div>
                        <ul className={`mt-2 list-disc pl-5 space-y-2 text-black/70 ${TXT.sm}`}>
                          {wellnessTips.map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {q9SafetyNote && (
                      <div className="mt-4 rounded-2xl border border-black/10 bg-white/85 p-4">
                        <div className={`font-extrabold text-[#141414] ${TXT.sm}`}>Important</div>
                        <p className={`mt-2 text-black/70 ${TXT.sm}`}>{q9SafetyNote}</p>
                      </div>
                    )}
                  </GlassCard>
                </div>
              )}
            </div>

            {/* ===== Right: Actions ===== */}
            <div className="lg:col-span-1 lg:sticky" style={{ top: ACTIONS_STICKY_TOP }}>
              <GlassCard title="Actions">
                <div className={`text-black/60 ${TXT.xs}`}>{readOnly ? "Read-only." : "Review and submit when complete."}</div>

                <div className="mt-4 space-y-3">
                  {!!lastSubmittedText && (
                    <div
                      className={`rounded-2xl border border-black/10 p-3 text-black/70 ${TXT.xs}`}
                      style={{ background: "linear-gradient(180deg, rgba(185,255,102,0.16) 0%, rgba(0,0,0,0.03) 100%)" }}
                    >
                      <div className="font-extrabold text-black/70">Last submission</div>
                      <div className="mt-1">{lastSubmittedText}</div>
                      {weeklyLocked && nextAvailableText && (
                        <>
                          <div className="mt-3 font-extrabold text-black/70">Next available</div>
                          <div className="mt-1">{nextAvailableText}</div>
                        </>
                      )}
                    </div>
                  )}

                  <SecondaryButton onClick={openReview} disabled={!termsAccepted}>
                    Review answers
                  </SecondaryButton>

                  <PrimaryButton onClick={handleSubmit} disabled={!canSubmitNow}>
                    {primaryActionLabel}
                  </PrimaryButton>

                  {!canSubmit && termsAccepted && !submitted && (
                    <div className={`text-black/55 ${TXT.xs}`}>
                      Remaining: <span className="font-extrabold text-black">{ANSWER_COUNT - answeredCount}</span>
                    </div>
                  )}

                  {weeklyLocked && nextAvailableText && (
                    <div className={`text-black/55 ${TXT.xs}`}>
                      You can submit again on <span className="font-extrabold text-black">{nextAvailableText}</span>.
                    </div>
                  )}

                  <SecondaryButton onClick={() => setConfirmReset(true)} disabled={readOnly || !termsAccepted}>
                    Reset
                  </SecondaryButton>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Mobile sticky nav ===== */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-black/10 bg-white/92 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="grid grid-cols-3 gap-2 items-center">
            <motion.button
              type="button"
              onClick={() => navigateTo(activeIndex - 1)}
              disabled={activeIndex === 0 || isModalOpen}
              whileTap={activeIndex !== 0 && !isModalOpen ? { scale: 0.99 } : undefined}
              className={`rounded-full px-4 py-3 font-extrabold bg-white hover:bg-black/5 transition disabled:opacity-40 ${TXT.sm}`}
              style={{ border: "1px solid rgba(0,0,0,0.15)", color: CHECKIN_DARK }}
            >
              <span className="inline-flex items-center justify-center gap-1">
                <IconChevron dir="left" className="h-4 w-4" />
                Prev
              </span>
            </motion.button>

            <motion.button
              type="button"
              onClick={openReview}
              disabled={!termsAccepted || isModalOpen}
              whileTap={termsAccepted && !isModalOpen ? { scale: 0.99 } : undefined}
              className={`rounded-full px-4 py-3 font-extrabold bg-white hover:bg-black/5 transition disabled:opacity-40 ${TXT.sm}`}
              style={{ border: "1px solid rgba(0,0,0,0.15)", color: CHECKIN_DARK }}
            >
              Review
            </motion.button>

            <motion.button
              type="button"
              onClick={() => navigateTo(activeIndex + 1)}
              disabled={activeIndex === QUESTIONS.length - 1 || isModalOpen}
              whileTap={activeIndex !== QUESTIONS.length - 1 && !isModalOpen ? { scale: 0.99 } : undefined}
              className={`rounded-full px-4 py-3 font-extrabold bg-white hover:bg-black/5 transition disabled:opacity-40 ${TXT.sm}`}
              style={{ border: "1px solid rgba(0,0,0,0.15)", color: CHECKIN_DARK }}
            >
              <span className="inline-flex items-center justify-center gap-1">
                Next
                <IconChevron className="h-4 w-4" />
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
