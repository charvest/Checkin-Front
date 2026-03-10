// File: src/pages/AdminDashboard/Sections/AdminOverviewAnalytics.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Admin Dashboard Analytics (SVG only, no libs)
 * ✅ Students total: uses `students` prop if provided; else uses local seeded fallback (mirrors StudentLifecycle.jsx seed)
 * ✅ Counselors total: uses `counselors` prop if provided; else uses local seeded fallback (mirrors CounselorManagement.jsx initialCounselors)
 *
 * Updates requested:
 * ✅ Students by course: removed redundancy (percent shown once only)
 * ✅ Students by course: fade-right animation when pagination is clicked
 */

const COURSE_ORDER = [
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

const DEFAULT_DATA = {
  studentsTotal: 10000,
  studentsActive: 4720,
  studentsByCourse: [],
  counselorsTotal: 12,
  counselorsActive: 9,
  requestsPending: 34,
  requestsApproved: 18,
  requestsDone: 92,
  requestsCancelled: 7,
  requestsNoShows: 4,
};

const STATUS = {
  ACTIVE: "active",
  TERMINATED: "terminated",
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function fmtInt(n) {
  const v = Number.isFinite(n) ? n : 0;
  return Math.round(v).toLocaleString();
}
function pct(part, total) {
  const t = Math.max(1, Number(total) || 0);
  return Math.round(((Number(part) || 0) / t) * 100);
}
function timeAgo(msDiff) {
  const s = Math.max(0, Math.floor(msDiff / 1000));
  if (s < 20) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ICONS */
const Icons = {
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11Zm-8 0c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm0 2c-2.67 0-8 1.34-8 4v1h14v-1c0-2.66-5.33-4-6-4Zm8 0c-.34 0-.72.02-1.12.06 1.42.72 2.12 1.72 2.12 2.94v1h7v-1c0-2.66-5.33-4-8-4Z"
        fill="currentColor"
      />
    </svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3Zm0 18c-2.77-1.15-6-5.2-6-9V6.3l6-2.25 6 2.25V11c0 3.8-3.23 7.85-6 9Z"
        fill="currentColor"
      />
    </svg>
  ),
  refresh: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12a8 8 0 0 1-14.9 4h2.3a6 6 0 1 0 .1-7H7l3.5 3.5L9 14 3 8l6-6 1.6 1.5L7.2 7H9.1A8 8 0 0 1 20 12Z"
        fill="currentColor"
      />
    </svg>
  ),
};

function Pill({ children }) {
  return <span className="aol-pill">{children}</span>;
}

function Badge({ tone = "gray", children }) {
  const tones = {
    green: { bg: "rgba(15,23,42,.06)", bd: "rgba(15,23,42,.18)", fg: "var(--aol-theme)" },
    blue: { bg: "rgba(15,23,42,.06)", bd: "rgba(15,23,42,.18)", fg: "var(--aol-theme)" },
    purple: { bg: "rgba(15,23,42,.06)", bd: "rgba(15,23,42,.18)", fg: "var(--aol-theme)" },
    gray: { bg: "rgba(15,23,42,.06)", bd: "rgba(15,23,42,.18)", fg: "var(--aol-theme)" },
  };
  const t = tones[tone] || tones.gray;

  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 999,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        color: t.fg,
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
      }}
    >
      {children}
    </div>
  );
}

function MetricCard({ icon, tone, value, label, sub, progressPct }) {
  const pctVal = clamp(Number(progressPct ?? 0), 0, 100);

  return (
    <div className="aol-card" tabIndex={0}>
      <div className="aol-card-top">
        <div className="aol-card-left">
          <Badge tone={tone}>{icon}</Badge>
          <div className="aol-card-meta">
            <div className="aol-card-label">{label}</div>
            {sub ? <div className="aol-card-sub">{sub}</div> : null}
          </div>
        </div>
        <div className="aol-card-value">{value}</div>
      </div>

      {Number.isFinite(progressPct) ? (
        <div className="aol-progress" aria-hidden="true">
          <div className="aol-progress-fill" style={{ width: `${pctVal}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Legend({ items, activeIndex, onHoverIndex, lockedIndex, onToggleLock }) {
  return (
    <div className="aol-legend">
      {items.map((it, idx) => {
        const isActive = activeIndex === idx;
        const isLocked = lockedIndex === idx;

        return (
          <button
            type="button"
            key={it.label}
            className={`aol-legend-btn ${isActive ? "is-active" : ""} ${isLocked ? "is-locked" : ""}`}
            onMouseEnter={() => onHoverIndex(idx)}
            onMouseLeave={() => onHoverIndex(null)}
            onFocus={() => onHoverIndex(idx)}
            onBlur={() => onHoverIndex(null)}
            onClick={() => onToggleLock(idx)}
          >
            <span className="aol-legend-left">
              <span className="aol-dot" style={{ background: it.color }} />
              <span className="aol-legend-text">{it.label}</span>
              {isLocked ? <span className="aol-lock-pill">Selected</span> : null}
            </span>

            <span className="aol-legend-num">{fmtInt(it.value)}</span>
          </button>
        );
      })}
    </div>
  );
}

function MultiDonut({ segments, activeIndex, onHoverIndex, lockedIndex, onToggleLock, centerTop, centerBottom }) {
  const total = Math.max(1, segments.reduce((a, s) => a + (Number(s.value) || 0), 0));

  const r = 52;
  const baseStroke = 16;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="aol-donut" role="img" aria-label="Requests status donut chart">
      <svg className="aol-donut-svg" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} stroke="#E5E7EB" strokeWidth={baseStroke} fill="none" />

        {segments.map((seg, idx) => {
          const v = Math.max(0, Number(seg.value) || 0);
          const dash = (v / total) * c;
          const isActive = activeIndex === idx;

          const strokeOpacity = activeIndex == null ? seg.opacity : isActive ? 1 : 0.18;
          const strokeWidth = activeIndex == null ? baseStroke : isActive ? baseStroke + 4 : baseStroke - 2;

          const el = (
            <circle
              key={idx}
              cx="80"
              cy="80"
              r={r}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
              className="aol-donut-seg"
              style={{ opacity: strokeOpacity, transition: "opacity .15s ease, stroke-width .15s ease, filter .15s ease" }}
              onMouseEnter={() => onHoverIndex(idx)}
              onMouseLeave={() => onHoverIndex(null)}
              onClick={() => onToggleLock(idx)}
            />
          );

          offset += dash;
          return el;
        })}

        <text x="80" y="78" textAnchor="middle" className="aol-donut-top">
          {centerTop}
        </text>
        <text x="80" y="102" textAnchor="middle" className="aol-donut-bottom">
          {centerBottom}
        </text>
      </svg>
    </div>
  );
}

/**
 * Mini list bars (Courses)
 * ✅ Removed redundancy: do NOT show percent twice (meta + bubble)
 * ✅ Fix: on mobile, bubble no longer overlaps the count; label position clamped away from extreme edges
 */
function MiniPopulationBars({ items, hoveredKey, setHoveredKey, studentsTotal }) {
  const denom = Math.max(1, Number(studentsTotal) || 0);

  return (
    <div className="aol-campus">
      {items.map((it) => {
        const count = Math.max(0, Number(it.count) || 0);
        const sharePct = (count / denom) * 100;
        const pctW = clamp(sharePct, 0, 100);

        const isHover = hoveredKey === it.key;

        const markerLeft = clamp(pctW, 0, 100);
        const labelLeft = clamp(markerLeft, 6, 94);

        const labelAlign = labelLeft < 14 ? "left" : labelLeft > 86 ? "right" : "center";

        return (
          <div
            key={it.key}
            className={`aol-campus-row ${isHover ? "is-hover" : ""}`}
            onMouseEnter={() => setHoveredKey(it.key)}
            onMouseLeave={() => setHoveredKey(null)}
          >
            <div className="aol-campus-left">
              <div className="aol-campus-name" title={it.key}>
                {it.key}
              </div>
              <div className="aol-campus-meta">{fmtInt(count)}</div>
            </div>

            <div className="aol-campus-track" aria-hidden="true">
              <div
                className="aol-campus-fill"
                style={{
                  width: `${pctW}%`,
                  opacity: hoveredKey == null ? 0.82 : isHover ? 1 : 0.22,
                }}
              />

              <div
                className="aol-campus-marker"
                style={{
                  left: `${markerLeft}%`,
                  opacity: hoveredKey == null ? 0.9 : isHover ? 1 : 0.25,
                }}
              />

              <div
                className={`aol-campus-pct aol-campus-pct--${labelAlign}`}
                style={{
                  left: `${labelLeft}%`,
                  opacity: hoveredKey == null ? 0.9 : isHover ? 1 : 0.25,
                }}
              >
                {sharePct.toFixed(1)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===== SINGLE-FILE CONNECTORS (mirrors your other files) ===== */
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
// 1) FIX: seedCounselors() -> add status so active% + UI line are correct
function seedCounselors() {
  return [
    {
      _id: "c1",
      fullName: "Angela Ramos",
      counselorId: "C-0001",
      email: "angela.ramos@checkin.edu.ph",
      status: STATUS.ACTIVE,
      createdAt: "2024-08-15T08:10:00.000Z",
    },
    {
      _id: "c2",
      fullName: "Jerome Villanueva",
      counselorId: "C-0002",
      email: "jerome.villanueva@checkin.edu.ph",
      status: STATUS.ACTIVE,
      createdAt: "2024-07-02T10:20:00.000Z",
    },
    {
      _id: "c3",
      fullName: "Mika Santos",
      counselorId: "C-0003",
      email: "mika.santos@checkin.edu.ph",
      status: STATUS.ACTIVE,
      createdAt: "2024-06-10T03:30:00.000Z",
    },
    {
      _id: "c4",
      fullName: "Paolo Reyes",
      counselorId: "C-0004",
      email: "paolo.reyes@checkin.edu.ph",
      status: STATUS.ACTIVE,
      createdAt: "2024-03-11T11:15:00.000Z",
    },
  ];
}

// 2) FIX: Counselors MetricCard line -> show active/inactive (not repeating total)

function deriveStudentStats({ students, fallbackTotal, fallbackActive }) {
  if (Array.isArray(students)) {
    const total = students.length;
    const active = students.reduce((acc, s) => {
      const status = String(s?.status ?? "").toLowerCase();
      const isActive = typeof s?.isActive === "boolean" ? s.isActive : status === "active" || status === "enrolled";
      return acc + (isActive ? 1 : 0);
    }, 0);
    return { total, active, inactive: Math.max(0, total - active), source: "students-prop" };
  }

  const total = Number(fallbackTotal ?? 0);
  const active = Number(fallbackActive ?? 0);
  return { total, active, inactive: Math.max(0, total - active), source: "fallback" };
}

function deriveCounselorStats({ counselors, fallbackTotal, fallbackActive }) {
  if (Array.isArray(counselors)) {
    const total = counselors.length;
    const active = counselors.reduce((acc, c) => {
      const status = String(c?.status ?? "").toLowerCase();
      const isActive = typeof c?.isActive === "boolean" ? c.isActive : status === "active";
      return acc + (isActive ? 1 : 0);
    }, 0);
    return { total, active, inactive: Math.max(0, total - active), source: "counselors-prop" };
  }

  const total = Number(fallbackTotal ?? 0);
  const active = Number(fallbackActive ?? 0);
  return { total, active, inactive: Math.max(0, total - active), source: "fallback" };
}

/* MAIN */
export default function AdminOverviewAnalytics({
  data = DEFAULT_DATA,
  title = "Admin Dashboard",
  subtitle = "Quick totals + monitoring overview",
  clockTickMs = 15000,
  students = null,
  counselors = null,
  onRefresh = null,
  coursesPageSize = 5,
}) {
  const [lockedStatusIndex, setLockedStatusIndex] = useState(null);
  const [hoverStatusIndex, setHoverStatusIndex] = useState(null);
  const activeStatusIndex = lockedStatusIndex ?? hoverStatusIndex;

  const [hoveredCourse, setHoveredCourse] = useState(null);
  const [coursePage, setCoursePage] = useState(0);
  const [courseAnimKey, setCourseAnimKey] = useState(0);

  const [now, setNow] = useState(Date.now());
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [studentsLocal, setStudentsLocal] = useState(null);
  const [counselorsLocal, setCounselorsLocal] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), Math.max(1000, clockTickMs));
    return () => clearInterval(id);
  }, [clockTickMs]);

  useEffect(() => {
    setLastUpdatedAt(Date.now());
  }, [data, students, counselors]);

  useEffect(() => {
    if (!Array.isArray(students)) setStudentsLocal(seedStudents());
    if (!Array.isArray(counselors)) setCounselorsLocal(seedCounselors());
  }, [students, counselors]);

  const resolvedStudents = Array.isArray(students) ? students : studentsLocal;
  const resolvedCounselors = Array.isArray(counselors) ? counselors : counselorsLocal;

  const stats = useMemo(() => {
    const studentStats = deriveStudentStats({
      students: resolvedStudents,
      fallbackTotal: data?.studentsTotal,
      fallbackActive: data?.studentsActive,
    });

    const counselorStats = deriveCounselorStats({
      counselors: resolvedCounselors,
      fallbackTotal: data?.counselorsTotal,
      fallbackActive: data?.counselorsActive,
    });

    const pending = Number(data?.requestsPending ?? 0);
    const approved = Number(data?.requestsApproved ?? 0);
    const disapproved = Number(data?.requestsDone ?? 0);
    const cancelled = Number(data?.requestsCancelled ?? 0);
    const noShows = Number(data?.requestsNoShows ?? 0);

    const totalRequests = pending + approved + disapproved + cancelled;

    const rawCourses = Array.isArray(data?.studentsByCourse)
      ? data.studentsByCourse.map((x) => ({
          key: String(x.key ?? "Unknown"),
          count: Math.max(0, Number(x.count ?? 0)),
        }))
      : [];

    const byKey = new Map(rawCourses.map((c) => [c.key, c.count]));
    const ordered = COURSE_ORDER.map((name) => ({ key: name, count: byKey.get(name) ?? 0 }));
    const extras = rawCourses.filter((c) => !COURSE_ORDER.includes(c.key)).sort((a, b) => b.count - a.count);
    const coursesTop = [...ordered, ...extras];

    const theme = "var(--aol-theme)";
    const donutSegments = [
      { label: "Pending", value: pending, color: theme, opacity: 0.28 },
      { label: "Approved", value: approved, color: theme, opacity: 0.48 },
      { label: "Disapproved", value: disapproved, color: theme, opacity: 0.78 },
      { label: "Cancelled", value: cancelled, color: theme, opacity: 0.22 },
    ];
    const donutLegend = donutSegments.map((s) => ({ label: s.label, value: s.value, color: s.color }));

    return {
      studentsTotal: studentStats.total,
      studentsActive: studentStats.active,
      studentsInactive: studentStats.inactive,
      activeStudentPct: pct(studentStats.active, studentStats.total),

      counselorsTotal: counselorStats.total,
      counselorsActive: counselorStats.active,
      counselorsInactive: counselorStats.inactive,
      activeCounselorPct: pct(counselorStats.active, counselorStats.total),

      pending,
      approved,
      disapproved,
      cancelled,
      noShows,
      totalRequests,

      coursesTop,
      donutSegments,
      donutLegend,
    };
  }, [data, resolvedStudents, resolvedCounselors]);

  const donutCenter = useMemo(() => {
    if (activeStatusIndex == null) return { top: fmtInt(stats.totalRequests), bottom: "Overall" };
    const seg = stats.donutSegments[activeStatusIndex];
    if (!seg) return { top: fmtInt(stats.totalRequests), bottom: "total requests" };
    return { top: fmtInt(seg.value), bottom: seg.label };
  }, [activeStatusIndex, stats.totalRequests, stats.donutSegments]);

  const updatedClock = useMemo(() => {
    const t = new Date(lastUpdatedAt);
    return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastUpdatedAt]);

  const updatedAgo = useMemo(() => timeAgo(now - lastUpdatedAt), [now, lastUpdatedAt]);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    const t = Date.now();
    setIsRefreshing(true);
    setLastUpdatedAt(t);
    setNow(t);

    try {
      if (!Array.isArray(students)) setStudentsLocal(seedStudents());
      if (!Array.isArray(counselors)) setCounselorsLocal(seedCounselors());
      if (typeof onRefresh === "function") await onRefresh();
    } finally {
      window.setTimeout(() => setIsRefreshing(false), 650);
    }
  };

  const toggleLock = (idx) => setLockedStatusIndex((prev) => (prev === idx ? null : idx));

  const totalCoursePages = useMemo(() => {
    const size = Math.max(1, Number(coursesPageSize) || 5);
    return Math.max(1, Math.ceil((stats.coursesTop?.length || 0) / size));
  }, [stats.coursesTop, coursesPageSize]);

  useEffect(() => {
    setCoursePage((p) => clamp(p, 0, totalCoursePages - 1));
  }, [totalCoursePages]);

  const pagedCourses = useMemo(() => {
    const size = Math.max(1, Number(coursesPageSize) || 5);
    const start = coursePage * size;
    return (stats.coursesTop || []).slice(start, start + size);
  }, [stats.coursesTop, coursePage, coursesPageSize]);

  const canPrev = coursePage > 0;
  const canNext = coursePage < totalCoursePages - 1;

  useEffect(() => {
    setCourseAnimKey((k) => k + 1);
  }, [coursePage]);

  return (
    <div className="aol-wrap">
      <div className="aol-head">
        <div className="aol-head-left">
          <div className="aol-title">{title}</div>
          <div className="aol-sub">{subtitle}</div>

          <div className="aol-head-pills">
            <Pill>
              <span className="aol-live-dot" aria-hidden="true" /> Live view
            </Pill>
            <Pill>
              Last updated: <b style={{ color: "#111827" }}>{updatedClock}</b> <span className="aol-muted">({updatedAgo})</span>
            </Pill>
          </div>
        </div>

        <button type="button" className="aol-refresh" onClick={handleManualRefresh} aria-label="Refresh" disabled={isRefreshing}>
          <span className={`aol-refresh-ico ${isRefreshing ? "is-spin" : ""}`}>{Icons.refresh}</span>
          <span className="aol-refresh-text">{isRefreshing ? "Refreshing" : "Refresh"}</span>
        </button>
      </div>

      <div className="aol-grid">
        <MetricCard
          tone="blue"
          icon={Icons.users}
          value={fmtInt(stats.studentsTotal)}
          label="Students"
          sub={`${fmtInt(stats.studentsTotal)} in Student Lifecycle`}
          progressPct={stats.activeStudentPct}
        />
        <MetricCard
          tone="green"
          icon={Icons.shield}
          value={fmtInt(stats.studentsActive)}
          label="Active students"
          sub={`${fmtInt(stats.studentsInactive)} inactive`}
          progressPct={stats.activeStudentPct}
        />

        <MetricCard
          tone="purple"
          icon={Icons.users}
          value={fmtInt(stats.counselorsTotal)}
          label="Counselors"
          sub={`${fmtInt(stats.counselorsTotal)} in Counselor Management`}
          progressPct={stats.activeCounselorPct}
        />
      </div>

      <div className="aol-graphs">
        <div className="aol-graph-card">
          <div className="aol-graph-head">
            <div>
              <div className="aol-graph-title">Requests status</div>
              <div className="aol-graph-sub">Hover previews. Tap/click locks selection.</div>
            </div>
            <Pill>
              No-shows: <b style={{ color: "#111827" }}>{fmtInt(stats.noShows)}</b>
            </Pill>
          </div>

          <div className="aol-graph-body">
            <MultiDonut
              segments={stats.donutSegments}
              activeIndex={activeStatusIndex}
              onHoverIndex={setHoverStatusIndex}
              lockedIndex={lockedStatusIndex}
              onToggleLock={toggleLock}
              centerTop={donutCenter.top}
              centerBottom={donutCenter.bottom}
            />
            <Legend
              items={stats.donutLegend}
              activeIndex={activeStatusIndex}
              onHoverIndex={setHoverStatusIndex}
              lockedIndex={lockedStatusIndex}
              onToggleLock={toggleLock}
            />
          </div>
        </div>

        <div className="aol-graph-card aol-course-card">
          <div className="aol-graph-head">
            <div>
              <div className="aol-graph-title">Students by course</div>
              <div className="aol-graph-sub">Showing {Math.min(coursesPageSize, stats.coursesTop.length)} per page</div>
            </div>
          </div>

          <div className="aol-course-body" key={courseAnimKey}>
            <div className="aol-fade-right">
              {pagedCourses.length ? (
                <MiniPopulationBars
                  items={pagedCourses}
                  hoveredKey={hoveredCourse}
                  setHoveredKey={setHoveredCourse}
                  studentsTotal={stats.studentsTotal}
                />
              ) : (
                <div className="aol-muted" style={{ marginTop: 10 }}>
                  —
                </div>
              )}
            </div>
          </div>

          <div className="aol-course-footer">
            <div className="aol-pager" role="navigation" aria-label="Courses pagination">
              <button type="button" className="aol-pager-btn" onClick={() => setCoursePage((p) => Math.max(0, p - 1))} disabled={!canPrev}>
                Prev
              </button>
              <span className="aol-pager-info">
                Page <b>{coursePage + 1}</b> / {totalCoursePages}
              </span>
              <button
                type="button"
                className="aol-pager-btn"
                onClick={() => setCoursePage((p) => Math.min(totalCoursePages - 1, p + 1))}
                disabled={!canNext}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .aol-wrap{
          --aol-theme: #0F172A;
          background:#fff;
          border:1px solid #E5E7EB;
          border-radius:18px;
          padding:16px;
          margin-bottom:14px;
          position:relative;
          overflow:hidden;
        }
        .aol-wrap:before{
          content:"";
          position:absolute;
          inset:-2px;
          background:
            radial-gradient(700px 240px at 10% 0%, rgba(15,23,42,.10), transparent 60%),
            radial-gradient(560px 220px at 90% 0%, rgba(15,23,42,.08), transparent 55%),
            radial-gradient(560px 240px at 50% 100%, rgba(15,23,42,.06), transparent 60%);
          pointer-events:none;
        }
        .aol-wrap > *{ position:relative; }

        .aol-head{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          margin-bottom:14px;
          flex-wrap: wrap;
        }
        .aol-head-left{ min-width: 0; flex: 1 1 auto; }
        .aol-title{ font-size:18px; font-weight:950; color:#111827; line-height:1.2; }
        .aol-sub{ font-size:12px; color:#6B7280; margin-top:4px; }

        .aol-head-pills{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .aol-pill{
          display:inline-flex; align-items:center; gap:8px;
          font-size:12px; padding:6px 10px; border-radius:999px;
          border:1px solid #E5E7EB; background:#F9FAFB; color:#374151; white-space:nowrap;
        }
        .aol-live-dot{
          width:8px; height:8px; border-radius:999px; background: var(--aol-theme);
          box-shadow: 0 0 0 0 rgba(15,23,42,.35);
          animation: aolPulse 1.6s ease infinite;
        }
        @keyframes aolPulse{
          0%{ box-shadow: 0 0 0 0 rgba(15,23,42,.28); }
          70%{ box-shadow: 0 0 0 10px rgba(15,23,42,0); }
          100%{ box-shadow: 0 0 0 0 rgba(15,23,42,0); }
        }

        .aol-refresh{
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          background: var(--aol-theme); color:#fff;
          border:1px solid rgba(255,255,255,.14);
          border-radius:12px; padding:10px 12px;
          font-size:12px; font-weight:850;
          cursor:pointer;
          transition: transform .12s ease, opacity .12s ease;
          flex: 0 0 auto;
          margin-left: auto;
          white-space: nowrap;
        }
        .aol-refresh:disabled{ opacity:.75; cursor:not-allowed; }
        .aol-refresh:hover:not(:disabled){ transform: translateY(-1px); opacity:.96; }
        .aol-refresh-ico{ display:grid; place-items:center; }
        .aol-refresh-ico.is-spin{ animation: aolSpin .65s linear infinite; transform-origin: 50% 50%; }
        @keyframes aolSpin{ from{ transform: rotate(0deg); } to{ transform: rotate(360deg); } }

        .aol-grid{
          display:grid;
          gap:12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-bottom:14px;
        }
        .aol-card{
          background:#fff;
          border:1px solid #E5E7EB;
          border-radius:16px;
          padding:12px;
          box-shadow: 0 1px 0 rgba(17,24,39,.03);
          transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
          outline:none;
        }
        .aol-card:hover,
        .aol-card:focus{
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(17,24,39,.07);
          border-color:#D1D5DB;
        }
        .aol-card-top{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .aol-card-left{ display:flex; align-items:center; gap:10px; min-width:0; }
        .aol-card-label{ font-size:12px; font-weight:900; color:#111827; }
        .aol-card-sub{ font-size:12px; color:#6B7280; margin-top:3px; }
        .aol-card-value{ font-size:24px; font-weight:950; color:#111827; }

        .aol-progress{
          margin-top:10px;
          height:8px;
          border-radius:999px;
          background:#F3F4F6;
          border:1px solid #E5E7EB;
          overflow:hidden;
        }
        .aol-progress-fill{
          height:100%;
          border-radius:999px;
          background: linear-gradient(90deg, rgba(15,23,42,.65), rgba(15,23,42,1));
          transform-origin:left center;
          animation: aolGrowX .6s ease both;
        }
        @keyframes aolGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }

        .aol-graphs{
          display:grid;
          gap:12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-bottom:12px;
        }
        .aol-graph-card{
          background:#fff;
          border:1px solid #E5E7EB;
          border-radius:18px;
          padding:14px;
          transition: box-shadow .15s ease, border-color .15s ease;
        }
        .aol-graph-card:hover{
          border-color:#D1D5DB;
          box-shadow: 0 12px 28px rgba(17,24,39,.06);
        }
        .aol-graph-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .aol-graph-title{ font-size:14px; font-weight:950; color:#111827; }
        .aol-graph-sub{ font-size:12px; color:#6B7280; margin-top:4px; }

        .aol-graph-body{
          display:flex;
          gap:16px;
          align-items:center;
          margin-top:12px;
        }

        .aol-donut{ min-width: 220px; display:grid; place-items:center; }
        .aol-donut-svg{ width:220px; height:220px; }
        .aol-donut-seg{ cursor:pointer; }
        .aol-donut-seg:hover{ filter: brightness(1.06); }
        .aol-donut-top{ font-size: 24px !important; font-weight: 950; fill:#111827; }
        .aol-donut-bottom{ font-size: 14px !important; font-weight: 900; fill:#6B7280; }

        .aol-legend{ width:100%; display:grid; gap:8px; padding-top:6px; }
        .aol-legend-btn{
          text-align:left;
          display:flex; align-items:center; justify-content:space-between;
          gap:10px;
          border:1px solid #E5E7EB;
          border-radius:14px;
          padding:12px 12px;
          background:#fff;
          cursor:pointer;
          transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
          outline:none;
        }
        .aol-legend-btn:hover,
        .aol-legend-btn:focus{
          transform: translateY(-1px);
          border-color:#D1D5DB;
          box-shadow: 0 10px 24px rgba(17,24,39,.06);
        }
        .aol-legend-btn.is-active{
          border-color: rgba(15,23,42,.25);
          box-shadow: 0 12px 26px rgba(15,23,42,.10);
        }
        .aol-legend-btn.is-locked{
          border-color: rgba(15,23,42,.35);
          box-shadow: 0 12px 26px rgba(15,23,42,.14);
        }
        .aol-legend-left{ display:inline-flex; align-items:center; gap:10px; min-width:0; }
        .aol-dot{ width:10px; height:10px; border-radius:999px; border:1px solid rgba(0,0,0,.06); }
        .aol-legend-text{ flex:1; font-size:12px; color:#6B7280; }
        .aol-legend-num{ font-size:13px; font-weight:950; color:#111827; }
        .aol-lock-pill{
          font-size: 11px;
          font-weight: 900;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid #E5E7EB;
          background: #F9FAFB;
          color: #111827;
          flex: 0 0 auto;
        }

        .aol-pager{
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding:6px 8px;
          border:1px solid #E5E7EB;
          border-radius:999px;
          background:#F9FAFB;
          flex: 0 0 auto;
          white-space: nowrap;
        }
        .aol-pager-info{ font-size:12px; color:#374151; }
        .aol-pager-btn{
          border:1px solid #E5E7EB;
          background:#fff;
          color:#111827;
          font-size:12px;
          font-weight:900;
          padding:6px 10px;
          border-radius:999px;
          cursor:pointer;
          transition: transform .12s ease, opacity .12s ease, border-color .12s ease;
        }
        .aol-pager-btn:disabled{ opacity:.55; cursor:not-allowed; }
        .aol-pager-btn:hover:not(:disabled){ transform: translateY(-1px); border-color:#D1D5DB; }

        .aol-course-card{
          display:flex;
          flex-direction:column;
          min-height: 100%;
        }
        .aol-course-body{
          flex: 1 1 auto;
        }
        .aol-course-footer{
          margin-top:auto;
          padding-top:12px;
          display:flex;
          justify-content:flex-end;
        }

        .aol-campus{ margin-top:12px; display:grid; gap:10px; }
        .aol-campus-row{
          display:grid;
          grid-template-columns: 1fr 1.35fr;
          gap:12px;
          align-items:center;
          padding:10px 10px;
          border-radius:14px;
          border:1px solid #F3F4F6;
          background: rgba(249,250,251,.6);
          transition: transform .12s ease, border-color .12s ease, background .12s ease;
        }
        .aol-campus-row:hover{ transform: translateY(-1px); border-color:#E5E7EB; background:#fff; }

        .aol-campus-name{
          font-size:12px; font-weight:900; color:#111827;
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
          max-width: none;
          line-height: 1.25;
          word-break: break-word;
        }
        .aol-campus-meta{ font-size:12px; color:#6B7280; margin-top:2px; }

        .aol-campus-track{
          position:relative;
          height:12px;
          background:#F3F4F6;
          border:1px solid #E5E7EB;
          border-radius:999px;
          overflow:visible;
        }

        .aol-campus-fill{
          height:100%;
          border-radius:999px;
          background: var(--aol-theme);
          transform-origin:left center;
          animation: aolGrowX .6s ease both;
          transition: opacity .12s ease;
          filter: saturate(1.05);
        }

        .aol-campus-marker{
          position:absolute;
          top:50%;
          width:10px;
          height:10px;
          border-radius:999px;
          background: var(--aol-theme);
          transform: translate(-50%, -50%);
          border:2px solid #fff;
          box-shadow: 0 8px 18px rgba(17,24,39,.12);
          transition: opacity .12s ease;
          pointer-events:none;
        }

        .aol-campus-pct{
          position:absolute;
          top:-26px;
          transform: translateX(-50%);
          font-size:11px;
          font-weight:950;
          color:#111827;
          background:#fff;
          border:1px solid #E5E7EB;
          border-radius:999px;
          padding:4px 8px;
          box-shadow: 0 10px 22px rgba(17,24,39,.06);
          white-space:nowrap;
          transition: opacity .12s ease;
          pointer-events:none;
        }
        .aol-campus-pct--left{ transform: translateX(0%); }
        .aol-campus-pct--right{ transform: translateX(-100%); }

        @keyframes aolFadeRight {
          from { opacity: 0; transform: translateX(-14px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .aol-fade-right{
          animation: aolFadeRight 220ms ease both;
          will-change: transform, opacity;
        }

        .aol-muted{ color:#9CA3AF; }

        @media (max-width: 980px){
          .aol-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .aol-graphs{ grid-template-columns: 1fr; }
        }
        @media (max-width: 520px){
          .aol-grid{ grid-template-columns: 1fr; }
          .aol-wrap{ padding:12px; }
          .aol-graph-body{ flex-direction:column; align-items:stretch; }
          .aol-campus-row{ grid-template-columns: 1fr; }
          .aol-campus-track{ margin-top: 18px; }
          .aol-refresh{ width:100%; justify-content:center; }
          .aol-pager{ width:100%; justify-content:space-between; }
          .aol-course-footer{ justify-content:stretch; }
          .aol-graph-head{ flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
