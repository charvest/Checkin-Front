// src/pages/CounselorDashboard/Sections/Inbox.jsx
import { useMemo, useState, useEffect } from "react";
import {
  getAskInboxItems,
  counselorReplyToAsk,
  requestUnmaskIdentity,
  // ✅ add this to counselor.api (sample backend contract below)
  counselorSetThreadStatus,
} from "../counselor.api";

import PHQ9Card from "../Components/PHQ9Card";

/* -------------------------------------------------------
   Status definitions
------------------------------------------------------- */
const STATUS = {
  NEW: {
    label: "NEW",
    desc: "Created by student; not yet reviewed.",
    studentVisible: true,
  },
  UNDER_REVIEW: {
    label: "UNDER_REVIEW",
    desc: "Counselor/intake is reviewing the concern.",
    studentVisible: true,
  },
  APPOINTMENT_REQUIRED: {
    label: "APPOINTMENT_REQUIRED",
    desc: "Counselor requires a session; student must schedule/confirm.",
    studentVisible: true,
  },
  SCHEDULED: {
    label: "SCHEDULED",
    desc: "Appointment scheduled and confirmed.",
    studentVisible: true,
  },
  IN_SESSION: {
    label: "IN_SESSION",
    desc: "Counseling is actively ongoing.",
    studentVisible: true,
  },
  WAITING_ON_STUDENT: {
    label: "WAITING_ON_STUDENT",
    desc: "Counselor requested info/action from student.",
    studentVisible: true,
  },
  FOLLOW_UP_REQUIRED: {
    label: "FOLLOW_UP_REQUIRED",
    desc: "Session done but follow-up/monitoring recommended.",
    studentVisible: true,
  },
  COMPLETED: {
    label: "COMPLETED",
    desc: "Concern addressed; no further action required.",
    studentVisible: true,
  },
  CLOSED: {
    label: "CLOSED",
    desc: "Thread archived; student can open a new one. (Read-only to student)",
    studentVisible: true,
  },

  // Optional internal statuses (restricted)
  URGENT: {
    label: "URGENT",
    desc: "High priority; requires immediate attention.",
    studentVisible: false,
    internal: true,
  },
  CRISIS: {
    label: "CRISIS",
    desc: "Potential safety/mental health crisis; follow emergency protocols.",
    studentVisible: false,
    internal: true,
  },
};

const COUNSELOR_VISIBLE_STATUSES = [
  "NEW",
  "UNDER_REVIEW",
  "APPOINTMENT_REQUIRED",
  "SCHEDULED",
  "IN_SESSION",
  "WAITING_ON_STUDENT",
  "FOLLOW_UP_REQUIRED",
  "COMPLETED",
  "CLOSED",
  // include internal if you want counselors to set them:
  "URGENT",
  "CRISIS",
];

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function ymd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}
function buildMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startDay = first.getDay(); // 0=Sun
  const start = new Date(year, monthIndex, 1 - startDay);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function badgeClassForStatus(status) {
  // You can tweak colors
  if (status === "CRISIS") return "bg-red-600 text-white border-red-600";
  if (status === "URGENT") return "bg-red-50 text-red-800 border-red-200";
  if (status === "NEW") return "bg-slate-50 text-slate-800 border-slate-200";
  if (status === "UNDER_REVIEW")
    return "bg-blue-50 text-blue-800 border-blue-200";
  if (status === "WAITING_ON_STUDENT")
    return "bg-amber-50 text-amber-900 border-amber-200";
  if (status === "APPOINTMENT_REQUIRED")
    return "bg-purple-50 text-purple-800 border-purple-200";
  if (status === "SCHEDULED") return "bg-indigo-50 text-indigo-800 border-indigo-200";
  if (status === "IN_SESSION") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "FOLLOW_UP_REQUIRED")
    return "bg-teal-50 text-teal-800 border-teal-200";
  if (status === "COMPLETED") return "bg-emerald-600 text-white border-emerald-600";
  if (status === "CLOSED") return "bg-slate-900 text-white border-slate-900";
  return "bg-slate-50 text-slate-800 border-slate-200";
}

/* -------------------------------------------------------
   Confirm Modal
------------------------------------------------------- */
function ConfirmModal({ open, title, message, confirmText, onConfirm, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <button
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-label="Close"
        type="button"
      />
      <div className="relative w-[420px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-black text-slate-900">{title}</div>
        </div>

        <div className="p-4">
          <div className="text-sm font-semibold text-slate-700">{message}</div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm?.();
                onClose?.();
              }}
              className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
              type="button"
            >
              {confirmText || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   Calendar icon + modal
------------------------------------------------------- */
function CalendarIconButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
      title="Open calendar"
      aria-label="Open calendar"
      type="button"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M7 3v2M17 3v2M4 9h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          className="text-slate-700"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      Calendar
    </button>
  );
}

function CalendarModal({ open, onClose, selectedYmd, onSelect, hasEntryYmdSet }) {
  const [cursor, setCursor] = useState(() => {
    const base = selectedYmd ? new Date(selectedYmd) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;
    const base = selectedYmd ? new Date(selectedYmd) : new Date();
    setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, selectedYmd]);

  if (!open) return null;

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const grid = buildMonthGrid(year, monthIndex);
  const monthLabel = cursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <button
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close calendar"
        type="button"
      />

      <div className="relative w-[360px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-black text-slate-900">Select date</div>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded-lg text-xs font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCursor(new Date(year, monthIndex - 1, 1))}
              className="px-2 py-1 rounded-lg text-xs font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
              type="button"
            >
              ‹
            </button>

            <div className="text-xs font-extrabold text-slate-700">{monthLabel}</div>

            <button
              onClick={() => setCursor(new Date(year, monthIndex + 1, 1))}
              className="px-2 py-1 rounded-lg text-xs font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
              type="button"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
              <div key={d} className="text-[11px] font-extrabold text-slate-500 py-1">
                {d}
              </div>
            ))}

            {grid.map((d) => {
              const dYmd = ymd(d);
              const inMonth = d.getMonth() === monthIndex;
              const active = selectedYmd && dYmd === selectedYmd;
              const hasEntry = hasEntryYmdSet?.has(dYmd);

              return (
                <button
                  key={dYmd}
                  onClick={() => {
                    onSelect(dYmd);
                    onClose();
                  }}
                  className={[
                    "relative rounded-xl px-0 py-2 text-xs font-extrabold transition border",
                    inMonth ? "text-slate-800" : "text-slate-400",
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                  type="button"
                >
                  {d.getDate()}
                  {hasEntry ? (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   Mood + Journal History Cards
------------------------------------------------------- */
function MoodTrackingHistoryCard({ moodTracking, day }) {
  if (!moodTracking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-black text-slate-900">Mood Tracking</div>
        <div className="mt-1 text-sm font-semibold text-slate-500">
          No mood tracking data found.
        </div>
      </div>
    );
  }

  const entries = Array.isArray(moodTracking.entries) ? moodTracking.entries : [];
  const found = entries.find((e) => e.date === day) || null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-black text-slate-900">Mood Tracking</div>
          <div className="mt-1 text-xs font-bold text-slate-500">
            Date: <span className="font-extrabold text-slate-700">{day}</span>
          </div>
        </div>
        <div className="text-xs font-bold text-slate-500">
          Family consent:{" "}
          <span className="text-slate-700 font-extrabold">
            {moodTracking.familyConsent ? "Yes" : "No"}
          </span>
        </div>
      </div>

      {!found ? (
        <div className="text-sm font-semibold text-slate-500">
          No mood entry for this date.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-slate-700">{found.date}</div>
            <div className="text-xs font-bold text-slate-500">
              Mood:{" "}
              <span className="font-extrabold text-slate-700">{found.mood ?? "—"}</span>
            </div>
          </div>
          {found.note ? (
            <div className="text-sm font-semibold text-slate-700">{found.note}</div>
          ) : (
            <div className="text-sm font-semibold text-slate-500">No note.</div>
          )}
        </div>
      )}
    </div>
  );
}

function JournalHistoryCard({ journalEntry, day }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-black text-slate-900">Journal</div>
          <div className="mt-1 text-xs font-bold text-slate-500">
            Date: <span className="font-extrabold text-slate-700">{day}</span>
          </div>
        </div>
        <div className="text-xs font-bold text-slate-500">
          Status:{" "}
          <span className="font-extrabold text-slate-700">
            {journalEntry?.status || "—"}
          </span>
        </div>
      </div>

      {!journalEntry ? (
        <div className="text-sm font-semibold text-slate-500">
          No journal entry for this date.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">
            {journalEntry.note || "—"}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   Status Selector (Counselor)
------------------------------------------------------- */
function StatusSelector({ value, onChange }) {
  const meta = STATUS[value] || null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        className={[
          "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-extrabold",
          badgeClassForStatus(value),
        ].join(" ")}
        title={meta?.desc || value}
      >
        {value}
      </div>

      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
      >
        {COUNSELOR_VISIBLE_STATUSES.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Inbox() {
  const [items, setItems] = useState(() => getAskInboxItems());
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(items?.[0]?.id || "");
  const [reply, setReply] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  // ✅ Mobile tabs: messages / conversation / details
  const [mobileTab, setMobileTab] = useState("messages");

  const today = useMemo(() => ymd(new Date()), []);
  const [historyDay, setHistoryDay] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // ✅ Status store per thread
  const [statusById, setStatusById] = useState(() => {
    const map = {};
    for (const x of getAskInboxItems() || []) {
      map[x.id] = x.status || "NEW"; // default NEW
    }
    return map;
  });

  // confirm modals
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCfg, setConfirmCfg] = useState({
    title: "",
    message: "",
    confirmText: "",
    onConfirm: null,
  });

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) || null,
    [items, selectedId]
  );

  const openConfirm = (cfg) => {
    setConfirmCfg(cfg);
    setConfirmOpen(true);
  };

  const notify = (msg, ms = 1400) => {
    setToast(msg);
    window.clearTimeout(window.__inboxToastTimer);
    window.__inboxToastTimer = window.setTimeout(() => setToast(""), ms);
  };

  const markRead = (id) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
  };

  const filtered = useMemo(() => {
    let base = items;

    if (filter === "unread") base = base.filter((x) => !x.read);
    if (filter === "flagged") base = base.filter((x) => (x.flags || []).length);

    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((x) => {
        const name = (x.anonymous ? "Anonymous Student" : x.studentName || "").toLowerCase();
        const topic = (x.topic || "").toLowerCase();
        const msg = (x.message || "").toLowerCase();
        return name.includes(q) || topic.includes(q) || msg.includes(q);
      });
    }

    return base;
  }, [items, filter, search]);

  const sendReply = () => {
    if (!selected) return;
    const text = reply.trim();
    if (!text) return;

    const next = counselorReplyToAsk(selected.id, text);
    setItems((prev) => prev.map((x) => (x.id === selected.id ? next : x)));
    setReply("");
    notify("Reply sent.");
  };

  const createIncidentNow = () => {
    if (!selected) return;

    setItems((prev) =>
      prev.map((x) =>
        x.id === selected.id
          ? {
              ...x,
              incidentId: x.incidentId || `INC-${Date.now()}`,
              incidentStatus: "Open",
            }
          : x
      )
    );

    notify("Incident created. You can now request unmask.", 1800);
  };

  const doUnmaskNow = () => {
    if (!selected) return;

    if (!selected.incidentId) {
      notify("Unmask is only allowed after an incident is created.", 1800);
      return;
    }

    const next = requestUnmaskIdentity(selected.id);
    setItems((prev) => prev.map((x) => (x.id === selected.id ? next : x)));
    notify("Identity revealed for investigation.", 1800);
  };

  // ✅ Counselor sets status (UI + API)
  const setThreadStatus = async (status) => {
    if (!selected) return;

    const prev = statusById[selected.id] || "NEW";
    setStatusById((p) => ({ ...p, [selected.id]: status }));

    try {
      // If your counselor.api doesn't have this yet, add it (backend section below)
      if (typeof counselorSetThreadStatus === "function") {
        await counselorSetThreadStatus(selected.id, status);
      }
      notify(`Status updated: ${status}`);
    } catch (e) {
      // rollback
      setStatusById((p) => ({ ...p, [selected.id]: prev }));
      notify("Failed to update status. Check API.", 1800);
      // optional: console error
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  // history lookups
  const phq9History = useMemo(() => {
    if (!selected) return [];
    if (Array.isArray(selected.phq9History)) return selected.phq9History;
    if (Array.isArray(selected.phq9s)) return selected.phq9s;
    return selected.phq9 ? [selected.phq9] : [];
  }, [selected]);

  const phq9ForDay = useMemo(() => {
    if (!phq9History.length) return null;
    return (
      phq9History.find((p) => p.date === historyDay) ||
      phq9History.find((p) => p.submittedDate === historyDay) ||
      phq9History.find((p) => (p.submittedAt || "").slice(0, 10) === historyDay) ||
      null
    );
  }, [phq9History, historyDay]);

  const moodEntryDaySet = useMemo(() => {
    const entries = selected?.moodTracking?.entries;
    if (!Array.isArray(entries)) return new Set();
    return new Set(entries.map((e) => e.date).filter(Boolean));
  }, [selected]);

  const journalHistory = useMemo(() => {
    if (!selected) return [];
    if (Array.isArray(selected.journalEntries)) return selected.journalEntries;
    if (Array.isArray(selected.journalHistory)) return selected.journalHistory;
    if (Array.isArray(selected.journal)) return selected.journal;
    return [];
  }, [selected]);

  const journalForDay = useMemo(() => {
    if (!journalHistory.length) return null;
    return (
      journalHistory.find((j) => j.date === historyDay) ||
      journalHistory.find((j) => (j.createdAt || "").slice(0, 10) === historyDay) ||
      null
    );
  }, [journalHistory, historyDay]);

  const historyDotsSet = useMemo(() => {
    const set = new Set();
    for (const d of moodEntryDaySet) set.add(d);
    for (const p of phq9History) {
      const d =
        p.date ||
        p.submittedDate ||
        (p.submittedAt ? String(p.submittedAt).slice(0, 10) : null);
      if (d) set.add(d);
    }
    for (const j of journalHistory) {
      const d = j.date || (j.createdAt ? String(j.createdAt).slice(0, 10) : null);
      if (d) set.add(d);
    }
    return set;
  }, [moodEntryDaySet, phq9History, journalHistory]);

  const FILTERS = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "flagged", label: "Flagged" },
  ];

  const currentStatus = selected ? statusById[selected.id] || "NEW" : "—";
  const statusMeta = STATUS[currentStatus] || null;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {toast}
        </div>
      ) : null}

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmCfg.title}
        message={confirmCfg.message}
        confirmText={confirmCfg.confirmText}
        onConfirm={confirmCfg.onConfirm}
        onClose={() => setConfirmOpen(false)}
      />

      {/* Mobile Tabs */}
      <div className="flex items-center gap-2 flex-wrap xl:hidden">
        {[
          { key: "messages", label: "Messages" },
          { key: "conversation", label: "Conversation" },
          { key: "details", label: "Details" },
        ].map((t) => {
          const active = mobileTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setMobileTab(t.key)}
              className={[
                "px-3 py-2 rounded-xl text-sm font-extrabold transition border",
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
              type="button"
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_420px] gap-4">
        {/* LEFT: Messages */}
        <section
          className={[
            "rounded-2xl border border-slate-200 bg-white overflow-hidden",
            "xl:block",
            mobileTab === "messages" ? "block" : "hidden",
          ].join(" ")}
        >
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-extrabold text-slate-700">
                Messages <span className="text-slate-500">({filtered.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {FILTERS.map((f) => {
                  const active = f.key === filter;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={[
                        "px-3 py-2 rounded-xl text-sm font-extrabold transition border",
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                      ].join(" ")}
                      type="button"
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, topic, or message..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div className="h-[72vh] overflow-y-auto overflow-x-hidden">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm font-semibold text-slate-500">
                No messages found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map((x) => {
                  const active = x.id === selectedId;
                  const st = statusById[x.id] || "NEW";
                  const urgentPulse = st === "URGENT" || st === "CRISIS";

                  return (
                    <button
                      key={x.id}
                      onClick={() => {
                        setSelectedId(x.id);
                        markRead(x.id);
                        setHistoryDay(today);
                        if (window.innerWidth < 1280) setMobileTab("conversation");
                      }}
                      className={[
                        "w-full text-left px-4 py-3 transition",
                        active ? "bg-slate-50" : "bg-white hover:bg-slate-50/70",
                      ].join(" ")}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* dot pulse only for urgent/crisis */}
                            <span
                              className={[
                                "w-2 h-2 rounded-full",
                                urgentPulse ? "bg-red-600 animate-pulse" : "bg-slate-300",
                              ].join(" ")}
                              title={st}
                            />

                            <div className="text-sm font-extrabold text-slate-800 truncate">
                              {x.anonymous ? "Anonymous Student" : x.studentName}
                            </div>

                            {!x.read ? (
                              <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                Unread
                              </span>
                            ) : null}

                            <span
                              className={[
                                "text-[11px] font-extrabold px-2 py-0.5 rounded-full border",
                                badgeClassForStatus(st),
                              ].join(" ")}
                            >
                              {st}
                            </span>

                            {(x.flags || []).length ? (
                              <span className="text-[11px] font-extrabold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                                Flagged
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            Topic:{" "}
                            <span className="font-extrabold text-slate-700">
                              {x.topic}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs font-bold text-slate-500 whitespace-nowrap">
                          {x.date}
                        </div>
                      </div>

                      <div className="mt-2 text-sm font-semibold text-slate-600 line-clamp-2">
                        {x.message}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <style>{`
            .line-clamp-2{
              display:-webkit-box;
              -webkit-line-clamp:2;
              -webkit-box-orient:vertical;
              overflow:hidden;
            }
          `}</style>
        </section>

        {/* MIDDLE: Conversation (mobile clarity fix) */}
        <section
          className={[
            "rounded-2xl border border-slate-200 bg-white overflow-hidden",
            "xl:block",
            mobileTab === "conversation" ? "block" : "hidden",
          ].join(" ")}
        >
          <div className="px-4 py-3 border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-extrabold text-slate-700">
                Conversation
              </div>

              {/* Mobile back button for clarity */}
              <button
                className="xl:hidden px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => setMobileTab("messages")}
                type="button"
              >
                Back
              </button>
            </div>
          </div>

          {!selected ? (
            <div className="px-4 py-6 text-sm font-semibold text-slate-500">
              Select a message to view conversation.
            </div>
          ) : (
            // ✅ Use full viewport height on mobile so thread is visible
            <div className="h-[78vh] xl:h-[72vh] flex flex-col">
              {/* Header */}
              <div className="px-4 py-4 border-b border-slate-200 bg-white space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-500">
                      {selected.date} • {selected.topic}
                    </div>

                    <div className="mt-1 text-lg font-black text-slate-900">
                      {selected.anonymous ? "Anonymous Student" : selected.studentName}
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-500">
                      {selected.anonymous
                        ? "Identity is hidden unless an incident is created and investigation is approved."
                        : "Student identity is visible (non-anonymous)."}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() =>
                        openConfirm({
                          title: "Create incident?",
                          message:
                            "This will create an incident record and unlock the unmask request flow.",
                          confirmText: "Create Incident",
                          onConfirm: createIncidentNow,
                        })
                      }
                      className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
                      type="button"
                    >
                      Create Incident
                    </button>

                    <button
                      onClick={() =>
                        openConfirm({
                          title: "Request unmask?",
                          message:
                            "Unmasking reveals student identity for investigation. Proceed?",
                          confirmText: "Confirm Unmask",
                          onConfirm: doUnmaskNow,
                        })
                      }
                      className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                      type="button"
                    >
                      Request Unmask
                    </button>
                  </div>
                </div>

                {/* ✅ Counselor status selector */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-500">
                      Current status
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-700">
                      {statusMeta?.desc || ""}
                    </div>
                  </div>

                  <StatusSelector value={currentStatus} onChange={setThreadStatus} />
                </div>
              </div>

              {/* Student message */}
              <div className="px-4 py-4 border-b border-slate-200 bg-white">
                <div className="text-sm font-extrabold text-slate-700">
                  Student Message
                </div>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {selected.message}
                </div>
              </div>

              {/* ✅ ONLY THREAD SCROLLS + clearer on mobile */}
              <div className="flex-1 min-h-0 px-4 py-4 overflow-y-auto bg-slate-50">
                <div className="sticky top-0 z-10 bg-slate-50 pb-2">
                  <div className="text-sm font-extrabold text-slate-700">Thread</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1">
                    Scroll here to view replies.
                  </div>
                </div>

                {(selected.thread || []).length === 0 ? (
                  <div className="mt-3 text-sm font-semibold text-slate-500">
                    No replies yet.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selected.thread.map((t) => (
                      <div
                        key={t.id}
                        className={[
                          "rounded-2xl border px-4 py-3",
                          t.by === "Counselor"
                            ? "border-emerald-100 bg-emerald-50"
                            : "border-slate-200 bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-extrabold text-slate-700">
                            {t.by}
                          </div>
                          <div className="text-xs font-bold text-slate-500">
                            {t.at}
                          </div>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-700 whitespace-pre-wrap break-words">
                          {t.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply sticky */}
              <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white px-4 py-4">
                <div className="text-sm font-extrabold text-slate-700">Reply</div>

                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder="Write a supportive reply..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
                />

                <div className="mt-2 flex justify-end">
                  <button
                    onClick={sendReply}
                    className="px-4 py-2.5 rounded-xl text-sm font-extrabold bg-slate-900 text-white hover:bg-slate-800"
                    type="button"
                  >
                    Send Reply
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT: Details */}
        <section
          className={[
            "rounded-2xl border border-slate-200 bg-white overflow-hidden",
            "xl:block",
            mobileTab === "details" ? "block" : "hidden",
          ].join(" ")}
        >
          <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-700">Details</div>
              <div className="text-xs font-bold text-slate-500 mt-0.5">
                Viewing history for:{" "}
                <span className="font-extrabold text-slate-700">{historyDay}</span>
              </div>
              {selected ? (
                <div className="text-xs font-bold text-slate-500 mt-1">
                  Status:{" "}
                  <span className="font-extrabold text-slate-700">{currentStatus}</span>
                </div>
              ) : null}
            </div>

            <CalendarIconButton onClick={() => setCalendarOpen(true)} />
          </div>

          <CalendarModal
            open={calendarOpen}
            onClose={() => setCalendarOpen(false)}
            selectedYmd={historyDay}
            onSelect={setHistoryDay}
            hasEntryYmdSet={historyDotsSet}
          />

          {!selected ? (
            <div className="px-4 py-6 text-sm font-semibold text-slate-500">
              Select a message to view details.
            </div>
          ) : (
            <div className="px-4 py-4 space-y-4 max-h-[72vh] overflow-y-auto">
              {selected.phq9 ? (
                <div className="space-y-2">
                  <div className="text-sm font-extrabold text-slate-700">
                    PHQ-9 Screening (History)
                  </div>
                  {phq9ForDay ? (
                    <PHQ9Card phq9={phq9ForDay} />
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-black text-slate-900">PHQ-9</div>
                      <div className="mt-1 text-sm font-semibold text-slate-500">
                        No PHQ-9 record for {historyDay}.
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <MoodTrackingHistoryCard moodTracking={selected.moodTracking} day={historyDay} />
              <JournalHistoryCard journalEntry={journalForDay} day={historyDay} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
