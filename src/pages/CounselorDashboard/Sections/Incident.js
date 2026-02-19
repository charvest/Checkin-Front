// src/pages/CounselorDashboard/Sections/Incident.jsx
import { useMemo, useState } from "react";

/**
 * ✅ Clean + readable Incidents UI
 * - Same rules you listed:
 *   - Profanity / death threats = hard block + warning
 *   - Unmask identity ONLY for investigation/incidents
 *   - Counselor sees only incidents in their scope (campus + grade + dept)
 * - STATIC for now, API later
 */

/* ===================== MOCK INCIDENTS ===================== */
const MOCK_INCIDENTS = [
  {
    id: "INC-1001",
    createdAt: "2026-01-10 09:12",
    type: "Death Threat",
    channel: "Ask Question",
    severity: "Critical",
    status: "Open",
    student: {
      isAnonymous: true,
      maskedLabel: "Anonymous Student",
      realName: "Juan Dela Cruz",
      studentId: "2023-004455",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    },
    counselorScope: {
      counselorId: "C-001",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    },
    messagePreview: "If you don’t reply I will hurt you…",
    actionTaken: "Hard blocked + warned student",
    notes: "",
  },
  {
    id: "INC-1002",
    createdAt: "2026-01-09 16:40",
    type: "Profanity",
    channel: "Ask Question",
    severity: "High",
    status: "Resolved",
    student: {
      isAnonymous: false,
      maskedLabel: "Student (Visible)",
      realName: "Maria Santos",
      studentId: "2023-008899",
      campus: "Main Campus",
      gradeLevel: "Grade 12",
      department: "STEM",
    },
    counselorScope: {
      counselorId: "C-002",
      campus: "Main Campus",
      gradeLevel: "Grade 12",
      department: "STEM",
    },
    messagePreview: "This is so f***ing stressful…",
    actionTaken: "Hard blocked + sent warning banner",
    notes: "Student apologized after warning.",
  },
];

/* ===================== UI HELPERS ===================== */
function Badge({ children, tone = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    red: "bg-red-50 text-red-800 border-red-100",
    rose: "bg-rose-50 text-rose-800 border-rose-100",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1",
        "text-[11px] font-extrabold",
        map[tone] || map.slate,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function severityTone(sev) {
  if (sev === "Critical") return "rose";
  if (sev === "High") return "amber";
  return "emerald";
}

function statusTone(status) {
  if (status === "Open") return "amber";
  if (status === "Resolved") return "emerald";
  return "slate";
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/40 p-4 grid place-items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/* ===================== MAIN ===================== */
export default function Incidents() {
  // In real app, counselor scope comes from logged-in counselor profile
  const COUNSELOR_SCOPE = useMemo(
    () => ({
      counselorId: "C-001",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    }),
    []
  );

  const [tab, setTab] = useState("Open"); // Open | Resolved | All
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  // Demo “approval” for unmask
  const [investigationApproved, setInvestigationApproved] = useState(false);

  const scopedIncidents = useMemo(() => {
    // ✅ only incidents within counselor scope (campus + grade + dept)
    const withinScope = MOCK_INCIDENTS.filter((inc) => {
      const s = inc.counselorScope;
      return (
        s.campus === COUNSELOR_SCOPE.campus &&
        s.gradeLevel === COUNSELOR_SCOPE.gradeLevel &&
        s.department === COUNSELOR_SCOPE.department
      );
    });

    const byTab =
      tab === "All"
        ? withinScope
        : withinScope.filter((i) => (tab === "Open" ? i.status === "Open" : i.status === "Resolved"));

    const bySearch = byTab.filter((i) => {
      const hay = `${i.id} ${i.type} ${i.channel} ${i.severity} ${i.messagePreview} ${i.createdAt}`
        .toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });

    return bySearch.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [COUNSELOR_SCOPE, tab, q]);

  const openCount = useMemo(
    () => scopedIncidents.filter((x) => x.status === "Open").length,
    [scopedIncidents]
  );

  const resolvedCount = useMemo(
    () => scopedIncidents.filter((x) => x.status === "Resolved").length,
    [scopedIncidents]
  );

  const closeModal = () => {
    setSelected(null);
    setInvestigationApproved(false);
  };

  const requestInvestigationApproval = () => {
    // Later: send to Admin/Supervisor via API + audit log
    setInvestigationApproved(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black tracking-tight">Incidents</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Threats/profanity are hard blocked. Identity can be unmasked only for investigation.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="amber">Open: {openCount}</Badge>
          <Badge tone="emerald">Resolved: {resolvedCount}</Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {["Open", "Resolved", "All"].map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "px-3 py-2 rounded-xl text-sm font-extrabold border transition",
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {t}
            </button>
          );
        })}

        <div className="flex-1 min-w-[240px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search incidents…"
            className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
          />
        </div>
      </div>

      {/* List */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="text-sm font-extrabold text-slate-700">
            Incidents <span className="text-slate-500">({scopedIncidents.length})</span>
          </div>
        </div>

        {scopedIncidents.length === 0 ? (
          <div className="px-4 py-6 text-sm font-semibold text-slate-500">
            No incidents found in your scope.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {scopedIncidents.map((i) => (
              <button
                key={i.id}
                onClick={() => setSelected(i)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50/70 transition"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-800">
                      {i.type}{" "}
                      <span className="text-slate-500 font-bold">• {i.channel}</span>
                    </div>

                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {i.id} • {i.createdAt} • Status:{" "}
                      <span className="font-extrabold text-slate-700">{i.status}</span>
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-600 line-clamp-2">
                      {i.messagePreview}
                    </div>

                    <div className="mt-2 text-xs font-semibold text-slate-500">
                      Action: <span className="font-extrabold text-slate-700">{i.actionTaken}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone={severityTone(i.severity)}>{i.severity}</Badge>
                    <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Details Modal */}
      <Modal open={!!selected} onClose={closeModal}>
        {selected ? (
          <div className="p-5 space-y-4">
            {/* Top */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-base font-black text-slate-900">
                  Incident • {selected.id}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  {selected.createdAt} • {selected.channel} •{" "}
                  <span className="text-slate-700">{selected.type}</span>
                </div>
              </div>

              <button
                onClick={closeModal}
                className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-extrabold text-slate-700">Message Preview</div>
                <div className="flex items-center gap-2">
                  <Badge tone={severityTone(selected.severity)}>{selected.severity}</Badge>
                  <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
                </div>
              </div>

              <div className="mt-2 text-sm font-semibold text-slate-700">
                “{selected.messagePreview}”
              </div>

              <div className="mt-2 text-xs font-semibold text-slate-500">
                Action taken:{" "}
                <span className="font-extrabold text-slate-700">{selected.actionTaken}</span>
              </div>
            </div>

            {/* Identity */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="text-sm font-extrabold text-slate-700">Student Identity</div>
              <div className="text-sm font-semibold text-slate-500">
                Anonymous identity can only be revealed after investigation approval.
              </div>

              <div className="text-sm font-semibold text-slate-700">
                <span className="text-slate-500 font-bold">Visible:</span>{" "}
                {selected.student.isAnonymous
                  ? selected.student.maskedLabel
                  : `${selected.student.realName} (${selected.student.studentId})`}
              </div>

              <div className="text-xs font-semibold text-slate-500">
                Scope:{" "}
                <span className="text-slate-700 font-extrabold">
                  {selected.student.campus} • {selected.student.gradeLevel} • {selected.student.department}
                </span>
              </div>

              {/* Unmask flow */}
              {selected.student.isAnonymous ? (
                <div className="pt-2">
                  {!investigationApproved ? (
                    <button
                      onClick={requestInvestigationApproval}
                      className="px-4 py-2.5 rounded-xl text-sm font-extrabold bg-slate-900 text-white hover:bg-slate-800"
                    >
                      Request Investigation Unmask
                    </button>
                  ) : (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                      <div className="text-sm font-extrabold text-emerald-800">
                        Investigation Approved
                      </div>
                      <div className="mt-1 text-sm font-semibold text-emerald-800">
                        Unmasked: {selected.student.realName} ({selected.student.studentId})
                      </div>
                      <div className="mt-1 text-xs font-semibold text-emerald-700">
                        (In backend: log who/when/why.)
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Notes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-extrabold text-slate-700 mb-2">
                Counselor Notes
              </div>
              <textarea
                defaultValue={selected.notes || ""}
                placeholder="Write investigation notes… (static for now)"
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
              />
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => alert("Later: Escalate to Admin/Supervisor + notifications")}
                className="px-4 py-2.5 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
              >
                Escalate to Admin
              </button>

              <button
                onClick={() => alert("Later: Mark as resolved via API")}
                className="px-4 py-2.5 rounded-xl text-sm font-extrabold bg-slate-900 text-white hover:bg-slate-800"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* helper if your tailwind doesn't have line-clamp */}
      <style>{`
        .line-clamp-2{
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
        }
      `}</style>
    </div>
  );
}
