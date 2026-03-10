// src/pages/Services/SessionType/ViewRequest.js
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../../../api/apiFetch";


/* ===================== THEME ===================== */
const PRIMARY = "#B9FF66";
const PRIMARY_SOFT = "rgba(185, 255, 102, 0.18)";
const PRIMARY_SOFT_2 = "rgba(185, 255, 102, 0.10)";
const TEXT_DARK = "#0F172A";
const TEXT_MUTED = "#64748B";
const BG_TOP = "rgba(185, 255, 102, 0.28)";
const BG_MID = "rgba(185, 255, 102, 0.12)";
const BG_BOTTOM = "#F8FAFC";
const FOCUS_RING = PRIMARY;
const FOCUS_GLOW = "rgba(185, 255, 102, 0.22)";
const CTA_BG = PRIMARY;
const CTA_TEXT = TEXT_DARK;
const CTA_BORDER = "rgba(15,23,42,0.14)";

const TABS = ["All", "Pending", "Approved", "Rescheduled", "Disapproved", "Canceled", "Past"];
const PAGE_SIZE = 5;

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (!isBrowser()) return;
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

function normalizeStatus(raw) {
  if (!raw) return "Pending";
  const s = String(raw).trim().toLowerCase();
  if (s.includes("cancel")) return "Canceled"; // handles Cancelled/CancelledAt
  if (s.includes("resched")) return "Rescheduled";
  if (s.includes("disapprove")) return "Disapproved";
  if (s.includes("approve")) return "Approved";
  if (s.includes("pending")) return "Pending";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function safeISO(value, fallbackIso) {
  if (!value) return fallbackIso;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallbackIso;
  return d.toISOString();
}

function normalizeRequest(raw) {
  if (!raw || typeof raw !== "object") return null;

  const type = raw.type || (raw.sessionType || raw.date || raw.time ? "MEET" : "ASK");
  const now = new Date().toISOString();
  const createdAt = safeISO(raw.createdAt, now);
  const updatedAt = safeISO(raw.updatedAt, createdAt);

  return {
    id: String(raw._id || raw.id || raw.requestId || ""),
    type,
    status: normalizeStatus(raw.status),
    sessionType: raw.sessionType || "",
    reason: raw.reason || "",
    date: raw.date || "",
    time: raw.time || "",
    notes: raw.notes || "",
    counselorId: raw.counselorId?._id ? String(raw.counselorId._id) : String(raw.counselorId || ""),
    counselorName:
      raw.counselorName ||
      (raw.counselorId && typeof raw.counselorId === "object"
        ? [raw.counselorId.firstName, raw.counselorId.lastName].filter(Boolean).join(" ") ||
          raw.counselorId.fullName ||
          ""
        : ""),
    topic: raw.topic || "",
    message: raw.message || "",
    counselorReply: raw.counselorReply || "",
    disapprovalReason: raw.disapprovalReason || "",
    meetingLink: raw.meetingLink || raw.meetingUrl || raw.onlineMeetingLink || raw.meetLink || "",
    repliedAt: raw.repliedAt || "",
    readByStudentAt: raw.readByStudentAt || "",
    cancelledAt: raw.cancelledAt || raw.canceledAt || "",
    completedAt: raw.completedAt || "",
    createdAt,
    updatedAt,
  };
}

/* ===================== DATE HELPERS ===================== */
function parseDateOnly(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const m = String(yyyyMmDd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDate(value) {
  if (!value) return "—";
  const dateOnly = parseDateOnly(value);
  if (dateOnly) {
    return dateOnly.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function isPastMeeting(item) {
  if (!item || item.type !== "MEET") return false;
  if (item.completedAt) return true;
  if (!item.date) return false;
  const dt = parseDateOnly(item.date);
  if (!dt) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dt < startOfToday;
}


/* ===================== CANCEL RULES (Option B) ===================== */
const PH_OFFSET = "+08:00";
const CANCEL_CUTOFF_MS = 24 * 60 * 60 * 1000;

function buildPHSessionISO(date, time) {
  const d = String(date || "").trim();
  const tRaw = String(time || "").trim();
  if (!d || !tRaw) return "";
  const t = /^\d{1,2}:\d{2}$/.test(tRaw) ? tRaw.padStart(5, "0") : tRaw;
  if (!/^\d{2}:\d{2}$/.test(t)) return "";
  return `${d}T${t}:00${PH_OFFSET}`;
}

function cancelGate(item) {
  const status = String(item?.status || "");
  if (status === "Pending") return { ok: true, reason: "" };
  if (status !== "Approved" && status !== "Rescheduled") return { ok: false, reason: "" };

  const iso = buildPHSessionISO(item?.date, item?.time);
  if (!iso) return { ok: false, reason: "Invalid schedule." };

  const sessionMs = new Date(iso).getTime();
  if (Number.isNaN(sessionMs)) return { ok: false, reason: "Invalid schedule." };

  const diff = sessionMs - Date.now();
  if (diff >= CANCEL_CUTOFF_MS) return { ok: true, reason: "" };
  return { ok: false, reason: "Locked (within 24 hours)." };
}

/* ===================== UI HELPERS ===================== */
function typeLabel(type) {
  return type === "MEET" ? "Session" : "Inquiry";
}

function statusBadge(status) {
  switch (status) {
    case "Approved":
      return { bg: "rgba(185, 255, 102, 0.20)", text: "#166534", label: "Approved" };
    case "Rescheduled":
      return { bg: "rgba(59,130,246,0.14)", text: "#1D4ED8", label: "Rescheduled" };
    case "Disapproved":
      return { bg: "rgba(239,68,68,0.14)", text: "#991B1B", label: "Disapproved" };
    case "Canceled":
      return { bg: "rgba(148,163,184,0.20)", text: "#334155", label: "Canceled" };
    default:
      return { bg: "rgba(245,158,11,0.18)", text: "#7C2D12", label: "Pending" };
  }
}

function previewText(r) {
  if (r.type === "MEET") {
    const counselor = r.counselorName || (r.counselorId ? r.counselorId : "Any");
    return `${formatDate(r.date)} • ${r.time || "—"} • ${counselor}`;
  }
  const msg = (r.message || "").trim().replace(/\s+/g, " ");
  return msg.slice(0, 120) + (msg.length > 120 ? "…" : "");
}

function canShowMeetingLink(item) {
  return item?.type === "MEET" && item?.status === "Approved" && !!item?.meetingLink;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function buildPageModel(page, totalPages) {
  const p = clamp(page, 1, totalPages);
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const out = [1];
  const left = Math.max(2, p - 1);
  const right = Math.min(totalPages - 1, p + 1);

  if (left > 2) out.push("…");
  for (let i = left; i <= right; i += 1) out.push(i);
  if (right < totalPages - 1) out.push("…");

  out.push(totalPages);
  return out;
}

async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}
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

export default function ViewRequest() {
  const navigate = useNavigate();


  const [counselorMap, setCounselorMap] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [tab, setTab] = useState("All");
  const [sort, setSort] = useState("Newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const toastTimerRef = useRef(null);
  useEffect(() => () => toastTimerRef.current && clearTimeout(toastTimerRef.current), []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 1200);
  }, []);

  const fetchCounselors = useCallback(async () => {
    try {
      const data = await apiFetch("/api/counseling/counselors");
      const list = Array.isArray(data?.items) ? data.items : [];
      const map = {};
      for (const c of list) map[String(c.id)] = c.name || c.fullName || "";
      setCounselorMap(map);
    } catch {}
  }, [apiFetch]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/counseling/requests");
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list.map(normalizeRequest).filter(Boolean));
      setLoading(false);
    } catch (e) {
      setError(e?.message || "Failed to load your requests.");
      setItems([]);
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!isBrowser()) return;
    document.title = "My Counseling Request";
    fetchCounselors();
    fetchRequests();
  }, [fetchCounselors, fetchRequests]);

  const allRequests = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return sort === "Oldest" ? ta - tb : tb - ta;
    });
    const q = search.trim().toLowerCase();
    if (!q) return sorted;

    return sorted.filter((r) => {
      const hay = [
        r.type,
        r.status,
        r.topic,
        r.reason,
        r.sessionType,
        r.time,
        r.date,
        r.counselorName,
        r.counselorId,
        r.message,
        r.counselorReply,
        r.disapprovalReason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, sort, search]);

  const filtered = useMemo(() => {
    let list = allRequests;

    if (tab === "Past") list = list.filter((r) => r.type === "MEET" && isPastMeeting(r));
    else if (tab !== "All") list = list.filter((r) => r.status === tab);

    return list;
  }, [allRequests, tab]);

  const counts = useMemo(() => {
    const c = { All: allRequests.length, Pending: 0, Approved: 0, Rescheduled: 0, Disapproved: 0, Canceled: 0, Past: 0 };
    for (const r of allRequests) {
      if (r.status === "Pending") c.Pending += 1;
      if (r.status === "Approved") c.Approved += 1;
      if (r.status === "Rescheduled") c.Rescheduled += 1;
      if (r.status === "Disapproved") c.Disapproved += 1;
      if (r.status === "Canceled") c.Canceled += 1;
      if (r.type === "MEET" && isPastMeeting(r)) c.Past += 1;
    }
    return c;
  }, [allRequests]);

  useEffect(() => setPage(1), [tab, sort, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = clamp(page, 1, totalPages);
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(filtered.length, startIdx + PAGE_SIZE);
  const paged = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const selected = useMemo(() => allRequests.find((x) => x.id === selectedId) || null, [allRequests, selectedId]);

  const cancelRequest = useCallback(
    async (id) => {
      if (!id) return;
      setBusyId(id);
      setError("");
      try {
        await apiFetch(`/api/counseling/requests/${id}/cancel`, { method: "PATCH" });
        showToast("Canceled");
        await fetchRequests();
      } catch (e) {
        setError(e?.message || "Failed to cancel request.");
      } finally {
        setBusyId("");
      }
    },
    [apiFetch, fetchRequests, showToast]
  );


  const newRequest = useCallback(() => navigate("/services/counseling/request"), [navigate]);

  return (
    <div
      className="min-h-screen px-3 sm:px-6 lg:px-8 pt-16 pb-10 overflow-x-hidden"
      style={{
        background: `linear-gradient(180deg, ${BG_TOP} 0px, ${BG_MID} 240px, ${BG_BOTTOM} 520px)`,
      }}
    >
      <GlobalStyles />

      <div className="max-w-7xl mx-auto">
        <div className="cc-hero cc-fade-in">
          <div className="cc-hero-inner">
            <div className="cc-hero-badges">
              <span className="cc-pill">
                <span className="cc-dot" /> Counseling
              </span>
              <span className="cc-pill cc-pill-soft">Track • Manage • Review</span>
            </div>

            <div className="mt-3">
              <h1 className="cc-title">My Counseling Request</h1>
              <p className="cc-subtitle">Track and manage your counseling requests.</p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={newRequest}
                className="cc-focus cc-clickable cc-cta rounded-full font-extrabold shadow-sm hover:shadow-md transition-shadow"
                aria-label="Create new counseling request"
              >
                + New Request
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {toast && (
              <div className="mt-4 cc-toast" role="status" aria-live="polite">
                {toast}
              </div>
            )}
          </div>

          <div className="cc-hero-glow" aria-hidden="true" />
          <div className="cc-hero-pattern" aria-hidden="true" />
        </div>

        <div className="mt-5 flex justify-center">
          <Tabs items={TABS} active={tab} counts={counts} onChange={(t) => setTab(t)} />
        </div>

        <div className="mt-6">
          <ListView
            loading={loading}
            requests={paged}
            totalCount={filtered.length}
            rangeStart={filtered.length ? startIdx + 1 : 0}
            rangeEnd={filtered.length ? endIdx : 0}
            search={search}
            setSearch={setSearch}
            sort={sort}
            setSort={setSort}
            onSelect={(req) => setSelectedId(req.id)}
            selectedId={selectedId}
            onCancel={(id) => cancelRequest(id)}
            busyId={busyId}
          />

          <Pagination page={safePage} totalPages={totalPages} onChange={(p) => setPage(clamp(p, 1, totalPages))} />
        </div>

        {selected && (
          <CenterModal title="Request details" onClose={() => setSelectedId(null)}>
            <DetailsCard
              item={selected}
              counselorName={selected.counselorName || counselorMap[selected.counselorId] || "Any"}
            />
          </CenterModal>
        )}
      </div>
    </div>
  );
}

/* ===================== TABS ===================== */
function Tabs({ items, active, counts, onChange }) {
  const isCompact = useMediaQuery("(max-width: 480px)");
  const containerRef = useRef(null);
  const btnRefs = useRef(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    if (isCompact) return;
    const container = containerRef.current;
    const activeBtn = btnRefs.current.get(active);
    if (!container || !activeBtn) return;

    const cRect = container.getBoundingClientRect();
    const bRect = activeBtn.getBoundingClientRect();

    setIndicator({
      left: bRect.left - cRect.left,
      width: bRect.width,
    });
  }, [active, isCompact]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    if (isCompact) return;
    if (!isBrowser()) return;

    const onResize = () => updateIndicator();
    window.addEventListener("resize", onResize);

    const fontsReady = document.fonts?.ready;
    if (fontsReady && typeof fontsReady.then === "function") {
      // fonts can change button widths after load
      fontsReady.then(() => requestAnimationFrame(updateIndicator)).catch(() => {});
    } else {
      requestAnimationFrame(updateIndicator);
    }

    return () => window.removeEventListener("resize", onResize);
  }, [updateIndicator, isCompact]);

  if (isCompact) {
    return (
      <div className="w-full max-w-4xl">
        <div className="cc-tabs-grid rounded-2xl bg-white/80 border border-gray-200 p-2 shadow-sm backdrop-blur">
          {items.map((t) => {
            const isActive = active === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange(t)}
                className={`cc-focus cc-clickable cc-tab-btn ${isActive ? "cc-tab-btn-active" : ""}`}
                aria-pressed={isActive}
              >
                <span className="truncate">
                  {t} <span className="opacity-60">({counts[t]})</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full max-w-4xl">
      <div className="inline-flex items-center gap-1 rounded-2xl bg-white/80 border border-gray-200 p-1 relative mx-auto shadow-sm backdrop-blur">
        <div
          className="cc-tab-indicator absolute top-1 bottom-1 rounded-xl transition-all duration-200"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: indicator.width,
            background: `linear-gradient(135deg, ${PRIMARY_SOFT}, ${PRIMARY_SOFT_2})`,
          }}
        />
        {items.map((t) => (
          <button
            key={t}
            type="button"
            ref={(el) => el && btnRefs.current.set(t, el)}
            onClick={() => onChange(t)}
            className={`cc-focus cc-clickable relative rounded-xl font-extrabold ${
              active === t ? "text-gray-900 cc-tab-active" : "text-gray-600 hover:text-gray-900"
            }`}
            style={{ padding: "9px 12px", fontSize: "0.92rem" }}
            aria-pressed={active === t}
          >
            {t} <span className="text-sm opacity-60">({counts[t]})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ===================== LIST VIEW ===================== */
function ListView({
  loading,
  requests,
  totalCount,
  rangeStart,
  rangeEnd,
  search,
  setSearch,
  sort,
  setSort,
  onSelect,
  selectedId,
  onCancel,
  busyId,
}) {
  const isEmpty = !loading && requests.length === 0;

  return (
    <div className="space-y-4 cc-fade-in">
      <div className="cc-list-sticky">
        <div className="rounded-2xl bg-white/85 border border-gray-200 p-3.5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 min-w-0">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by topic, counselor, date…"
                className="cc-focus w-full rounded-xl border border-gray-300 px-3 py-2.5 pr-10 cc-input"
                style={{ fontSize: "0.92rem" }}
                aria-label="Search requests"
                autoComplete="off"
                inputMode="search"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="cc-focus cc-clickable absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="cc-focus rounded-xl border border-gray-300 px-3 py-2 bg-white cc-select"
                style={{ fontSize: "0.92rem" }}
                aria-label="Sort"
              >
                <option value="Newest">Newest</option>
                <option value="Oldest">Oldest</option>
              </select>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-500 flex items-center justify-between gap-3">
            <div className="min-w-0">
              {totalCount ? (
                <>
                  Showing <span className="font-extrabold text-gray-900">{rangeStart}</span>–{" "}
                  <span className="font-extrabold text-gray-900">{rangeEnd}</span> of{" "}
                  <span className="font-extrabold text-gray-900">{totalCount}</span>
                </>
              ) : (
                <>
                  Showing <span className="font-extrabold text-gray-900">0</span> of{" "}
                  <span className="font-extrabold text-gray-900">0</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white/90 p-10 text-center cc-fade-in shadow-sm backdrop-blur">
          <div className="text-sm text-gray-500">Loading…</div>
        </div>
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <RequestRow
              key={req.id}
              request={req}
              onClick={() => onSelect(req)}
              selected={selectedId === req.id}
              onCancel={() => onCancel(req.id)}
              cancelDisabled={busyId === req.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({ request, onClick, selected, onCancel, cancelDisabled }) {
  const badge = statusBadge(request.status || "Pending");
  const showCancel = request.status === "Pending" || request.status === "Approved" || request.status === "Rescheduled";
  const gate = cancelGate(request);
  const canCancel = gate.ok;

  return (
    <div
      className={`rounded-2xl border bg-white/90 px-3.5 py-3 transition shadow-sm backdrop-blur cc-row ${
        selected ? "cc-row-selected" : "border-gray-200 hover:bg-white"
      }`}
    >
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="min-w-0 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-gray-500">{typeLabel(request.type)}</span>
            <span
              className="text-xs font-extrabold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: badge.bg, color: badge.text }}
            >
              {badge.label}
            </span>
          </div>

          <div className="mt-1 font-extrabold text-[0.98rem] text-gray-900 cc-row-title">
            {request.type === "MEET"
              ? `${request.sessionType || "Session"} • ${request.reason || "—"}`
              : request.topic || "Inquiry"}
          </div>

          <div className="mt-1 text-sm text-gray-600 cc-clamp2">{previewText(request)}</div>

          <div className="mt-2 text-xs text-gray-500">{formatDate(request.createdAt)}</div>
        </div>
      </button>

      {showCancel && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelDisabled || !canCancel}
            title={!canCancel ? gate.reason : ""}
            className="cc-focus cc-clickable px-4 py-2 rounded-xl border border-gray-300 text-sm font-extrabold bg-white hover:bg-gray-50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelDisabled ? "Cancelling…" : !canCancel ? "Cancel (locked)" : "Cancel"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ===================== PAGINATION ===================== */
function Pagination({ page, totalPages, onChange }) {
  const model = useMemo(() => buildPageModel(page, totalPages), [page, totalPages]);
  if (totalPages <= 1) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="cc-focus cc-clickable cc-page-btn"
      >
        Prev
      </button>

      {model.map((x, idx) =>
        x === "…" ? (
          <span key={`e-${idx}`} className="px-2 text-sm text-gray-500">
            …
          </span>
        ) : (
          <button
            key={`p-${x}-${idx}`}
            type="button"
            onClick={() => onChange(x)}
            className={`cc-focus cc-clickable cc-page-num ${x === page ? "cc-page-num-active" : ""}`}
            aria-current={x === page ? "page" : undefined}
          >
            {x}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="cc-focus cc-clickable cc-page-btn"
      >
        Next
      </button>
    </div>
  );
}

/* ===================== DETAILS ===================== */
function DetailsCard({ item, counselorName }) {
  const isMeet = item.type === "MEET";
  const badge = statusBadge(item.status || "Pending");
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef(null);

  useEffect(() => () => toastTimerRef.current && clearTimeout(toastTimerRef.current), []);

  const doCopy = useCallback(async (label, value) => {
    const ok = await copyText(value);
    setToast(ok ? label : "Copy failed");
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 1200);
  }, []);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 cc-fade-up shadow-sm backdrop-blur">
      <div className="p-3.5 border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-extrabold text-gray-900">Request details</div>
          <span
            className="text-xs font-extrabold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: badge.bg, color: badge.text }}
          >
            {badge.label}
          </span>
        </div>
      </div>

      <div className="p-3.5 space-y-4">
        {toast && (
          <div className="cc-toast" role="status" aria-live="polite">
            {toast}
          </div>
        )}

        <Section title="Info">
          <KeyValue label="Type" value={typeLabel(item.type)} />

          {isMeet ? (
            <>
              <KeyValue label="Session type" value={item.sessionType || "—"} />
              <KeyValue label="Reason" value={item.reason || "—"} />
              <KeyValue label="Date & time" value={`${formatDate(item.date)} • ${item.time || "—"}`} />
              <KeyValue label="Counselor" value={counselorName || "Any"} />


              {item.status === "Disapproved" && (
                <KeyValue label="Counselor reason" value={item.disapprovalReason || "—"} />
              )}
              {canShowMeetingLink(item) ? (
                <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
                  <div className="text-sm font-extrabold text-gray-700">Online link</div>
                  <div className="mt-1 text-sm text-gray-600 break-all">{item.meetingLink}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={item.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="cc-focus cc-clickable inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-extrabold"
                      style={{
                        background: `linear-gradient(135deg, ${PRIMARY_SOFT}, ${PRIMARY_SOFT_2})`,
                        border: "1px solid rgba(185,255,102,.45)",
                      }}
                    >
                      Open link
                    </a>
                    <button
                      type="button"
                      onClick={() => doCopy("Copied link", item.meetingLink)}
                      className="cc-focus cc-clickable inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-extrabold border border-gray-300 bg-white hover:bg-gray-50"
                    >
                      Copy link
                    </button>
                  </div>
                </div>
              ) : item.status === "Pending" ? (
                <KeyValue label="Online link" value="Available after approval." />
              ) : null}
            </>
          ) : (
            <>
              <KeyValue label="Topic" value={item.topic || "—"} />
              <KeyValue
                label="Counselor"
                value={item.counselorReply ? counselorName || "Assigned" : "Assigned when replied"}
              />

              {item.status === "Disapproved" && (
                <KeyValue label="Counselor reason" value={item.disapprovalReason || "—"} />
              )}
            </>
          )}

          <KeyValue
            label="Submitted"
            value={`${formatDate(item.createdAt)}${
              formatTime(item.createdAt) ? ` • ${formatTime(item.createdAt)}` : ""
            }`}
          />
          <KeyValue label="Last updated" value={formatDate(item.updatedAt)} />
        </Section>

        <Section title={isMeet ? "Notes" : "Conversation"}>
          {isMeet ? (
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{item.notes || "No notes."}</div>
          ) : (
            <div className="space-y-3">
              <ChatBubble title="You" text={item.message || "—"} />
              <ChatBubble title="Counselor" text={item.counselorReply || "No reply yet."} isCounselor />
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-sm font-extrabold text-gray-900 mb-2 flex items-center gap-2">
        <span className="cc-section-dot" aria-hidden="true" />
        {title}
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2">{children}</div>
    </div>
  );
}

function KeyValue({ label, value }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900 break-words sm:text-right cc-anywhere">{value}</div>
    </div>
  );
}

function ChatBubble({ title, text, isCounselor = false }) {
  return (
    <div className={`rounded-xl border p-3 shadow-sm bg-white ${isCounselor ? "border-emerald-200" : "border-gray-200"}`}>
      <div className="text-xs font-extrabold text-gray-500 mb-1">{title}</div>
      <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{text}</div>
    </div>
  );
}

/* ===================== EMPTY STATES ===================== */
function EmptyState() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 p-10 text-center cc-fade-in shadow-sm backdrop-blur">
      <div className="text-5xl mb-3 cc-bounce">🌼</div>
      <div className="text-base font-extrabold text-gray-900">No requests yet</div>
      <div className="text-sm text-gray-500 mt-2">Create one to get started.</div>
    </div>
  );
}

/* ===================== MODALS ===================== */
function CenterModal({ title, onClose, children }) {
  useEffect(() => {
    if (!isBrowser()) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 cc-fade-in">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label="Close details" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="w-full max-w-2xl rounded-3xl bg-white border border-gray-200 shadow-2xl cc-fade-up overflow-hidden"
          style={{ maxHeight: "86vh" }}
        >
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌼</span>
                <div className="text-base font-extrabold text-gray-900 truncate">{title}</div>
              </div>
              <div className="text-sm text-gray-500">Press Esc or click outside to close</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="cc-focus cc-clickable px-4 py-2 rounded-xl border border-gray-300 text-sm font-extrabold bg-white hover:bg-gray-50 shadow-sm"
            >
              Close
            </button>
          </div>

          <div className="px-5 py-5 overflow-y-auto cc-scroll" style={{ maxHeight: "calc(86vh - 72px)" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== GLOBAL STYLES ===================== */
function GlobalStyles() {
  return <style>{STYLE}</style>;
}

const STYLE = `
  :root{
    --cc-ring: ${FOCUS_RING};
    --cc-glow: ${FOCUS_GLOW};
    --cc-primary: ${PRIMARY};
    --cc-soft: ${PRIMARY_SOFT};
    --cc-soft2: ${PRIMARY_SOFT_2};
    --cc-text: ${TEXT_DARK};
    --cc-muted: ${TEXT_MUTED};
    --cc-font-head: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }

  .cc-focus:focus-visible{
    outline: none;
    box-shadow:
      0 0 0 3px var(--cc-ring),
      0 0 0 10px var(--cc-glow);
  }

  .cc-anywhere{ overflow-wrap: anywhere; word-break: break-word; }

  .cc-clamp2{
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce){
    * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  }

  .cc-hero{
    position: relative;
    border-radius: 24px;
    border: 1px solid rgba(148,163,184,.35);
    background: rgba(255,255,255,.72);
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(15,23,42,.06);
    backdrop-filter: blur(10px);
  }
  .cc-hero-inner{ position: relative; padding: 22px 18px; z-index: 2; }
  @media (min-width: 640px){ .cc-hero-inner{ padding: 26px 24px; } }

  .cc-hero-glow{
    position: absolute;
    inset: -220px auto auto -220px;
    width: 520px;
    height: 520px;
    background: radial-gradient(circle at 35% 35%, rgba(185,255,102,.45), transparent 62%);
    filter: blur(3px);
    transform: rotate(8deg);
    pointer-events: none;
    z-index: 0;
  }
  .cc-hero-pattern{
    position: absolute;
    inset: 0;
    opacity: .52;
    background-image: radial-gradient(rgba(15,23,42,.08) 1px, transparent 1px);
    background-size: 18px 18px;
    mask-image: radial-gradient(circle at 20% 0%, rgba(0,0,0,1), rgba(0,0,0,.35) 52%, transparent 78%);
    pointer-events: none;
    z-index: 1;
  }

  .cc-hero-badges{ display: flex; gap: 8px; flex-wrap: wrap; }
  .cc-pill{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font: 800 12px/1 var(--cc-font-head);
    color: var(--cc-text);
    padding: 8px 10px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,.35);
    background: rgba(255,255,255,.72);
    backdrop-filter: blur(10px);
  }
  .cc-pill-soft{
    color: rgba(15,23,42,.75);
    background: linear-gradient(135deg, var(--cc-soft), var(--cc-soft2));
    border-color: rgba(185,255,102,.35);
  }
  .cc-dot{
    width: 9px; height: 9px; border-radius: 999px;
    background: var(--cc-primary);
    box-shadow: 0 0 0 4px rgba(185,255,102,.18);
  }

  .cc-title{
    font-weight: 900;
    color: var(--cc-text);
    letter-spacing: -0.03em;
    line-height: 1.02;
    font-size: clamp(1.6rem, 2.5vw, 2.7rem);
  }
  .cc-subtitle{
    margin-top: 10px;
    color: var(--cc-muted);
    font-size: 0.98rem;
  }

  .cc-cta{
    background: ${CTA_BG};
    color: ${CTA_TEXT};
    border: 1px solid ${CTA_BORDER};
    padding: 10px 16px;
    font-size: 0.95rem;
    box-shadow: 0 12px 32px rgba(185,255,102,.20);
  }

  .cc-list-sticky{
    position: sticky;
    top: 0;
    z-index: 30;
    padding-top: 6px;
    padding-bottom: 10px;
  }

  .cc-input{ background: rgba(255,255,255,.92); }
  .cc-select{ background: rgba(255,255,255,.92); }

  .cc-tabs-grid{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }
  @media (max-width: 520px){
    .cc-tabs-grid{ grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
  }
  @media (max-width: 360px){
    .cc-tabs-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  .cc-tab-btn{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(148,163,184,.35);
    background: rgba(255,255,255,.72);
    font: 900 13px/1 var(--cc-font-head);
    color: rgba(15,23,42,.72);
    text-align: center;
    min-height: 42px;
  }

  .cc-tab-btn-active{
    background: linear-gradient(135deg, var(--cc-soft), var(--cc-soft2));
    border-color: rgba(185,255,102,.60);
    color: rgba(15,23,42,.95);
  }

  .cc-tab-btn:active{
    background: linear-gradient(135deg, rgba(185,255,102,0.28), rgba(185,255,102,0.16));
  }

  .cc-tab-indicator{ pointer-events: none; }
  .cc-tab-active{ text-shadow: 0 1px 0 rgba(255,255,255,.6); }

  .cc-row-selected{
    border-color: rgba(185,255,102,.62) !important;
    box-shadow: 0 14px 40px rgba(185,255,102,.12);
  }

  .cc-toast{
    border: 1px solid rgba(185,255,102,.5);
    background: linear-gradient(135deg, var(--cc-soft), var(--cc-soft2));
    color: rgba(15,23,42,.85);
    padding: 10px 12px;
    border-radius: 14px;
    font: 800 12px/1 var(--cc-font-head);
  }

  .cc-section-dot{
    width: 8px; height: 8px; border-radius: 999px;
    background: var(--cc-primary);
    box-shadow: 0 0 0 4px rgba(185,255,102,.14);
  }

  .cc-page-btn{
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(148,163,184,.35);
    background: rgba(255,255,255,.82);
    font: 900 13px/1 var(--cc-font-head);
    color: rgba(15,23,42,.82);
    min-width: 72px;
  }
  .cc-page-btn:disabled{ opacity: .5; cursor: not-allowed; }

  .cc-page-num{
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(148,163,184,.35);
    background: rgba(255,255,255,.82);
    font: 900 13px/1 var(--cc-font-head);
    color: rgba(15,23,42,.72);
    min-width: 44px;
  }
  .cc-page-num-active{
    background: linear-gradient(135deg, var(--cc-soft), var(--cc-soft2));
    border-color: rgba(185,255,102,.60);
    color: rgba(15,23,42,.95);
  }

  @keyframes ccFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ccFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ccBounce { 0% { transform: translateY(0); } 50% { transform: translateY(-2px); } 100% { transform: translateY(0); } }

  .cc-fade-in { animation: ccFadeIn 180ms ease-out; }
  .cc-fade-up { animation: ccFadeUp 240ms ease-out; }
  .cc-bounce{ animation: ccBounce 1.2s ease-in-out infinite; }

  .cc-clickable:active { transform: scale(0.98); }
  .cc-clickable { transition: transform 140ms ease, background-color 140ms ease, box-shadow 140ms ease; }

  .cc-scroll{ scrollbar-width: thin; }
  .cc-scroll::-webkit-scrollbar{ width: 8px; height: 8px; }
  .cc-scroll::-webkit-scrollbar-thumb{
    background: rgba(15, 23, 42, 0.18);
    border-radius: 999px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  .cc-scroll::-webkit-scrollbar-track{ background: transparent; }
`;