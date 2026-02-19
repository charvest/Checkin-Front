// src/pages/CounselorDashboard/Sections/MeetRequests.jsx
import { useMemo, useState } from "react";

/* ===================== MOCK REQUESTS ===================== */
const MOCK_MEET_REQUESTS = [
  {
    id: "MEET-2001",
    status: "Pending",
    createdAt: "2026-01-10 08:30",
    date: "2026-01-12",
    time: "10:00 AM",
    mode: "Online",
    reason: "Academic stress",
    notes: "I feel overwhelmed with deadlines.",
    student: {
      name: "Maria Santos",
      studentId: "2023-008899",
      email: "mariasantos@gmail.com",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    },
    counselor: {
      counselorId: "C-001",
      name: "Counselor A",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    },
  },
  {
    id: "MEET-2002",
    status: "Approved",
    createdAt: "2026-01-09 14:05",
    date: "2026-01-10",
    time: "03:30 PM",
    mode: "In-person",
    reason: "Family / Relationships",
    notes: "Need advice about problems at home.",
    student: {
      name: "John Reyes",
      studentId: "2023-001122",
      email: "johnreyes@yahoo.com",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    },
    counselor: {
      counselorId: "C-001",
      name: "Counselor A",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    },
  },
  {
    id: "MEET-2003",
    status: "Disapproved",
    createdAt: "2026-01-08 09:10",
    date: "2026-01-09",
    time: "11:30 AM",
    mode: "Online",
    reason: "Other",
    notes: "I can’t attend that day anymore.",
    student: {
      name: "Anne Cruz",
      studentId: "2023-009911",
      email: "annecruz@gmail.com",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    },
    counselor: {
      counselorId: "C-001",
      name: "Counselor A",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    },
  },
];

/* ===================== UI HELPERS ===================== */
function Badge({ children, tone = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-100",
    red: "bg-red-50 text-red-800 border-red-100",
    gray: "bg-slate-50 text-slate-700 border-slate-200",
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

function statusTone(status) {
  if (status === "Pending") return "amber";
  if (status === "Approved") return "emerald";
  if (status === "Disapproved") return "red";
  if (status === "Completed") return "gray";
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
export default function MeetRequests() {
  const COUNSELOR_SCOPE = useMemo(
    () => ({
      counselorId: "C-001",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    }),
    [],
  );

  const [tab, setTab] = useState("Pending");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [decisionNote, setDecisionNote] = useState("");

  // ✅ NEW: required only if Online
  const [meetLink, setMeetLink] = useState("");
  const [meetLinkErr, setMeetLinkErr] = useState("");

  const scoped = useMemo(() => {
    const withinScope = MOCK_MEET_REQUESTS.filter((r) => {
      const c = r.counselor;
      return (
        c.counselorId === COUNSELOR_SCOPE.counselorId &&
        c.campus === COUNSELOR_SCOPE.campus &&
        c.gradeLevel === COUNSELOR_SCOPE.gradeLevel &&
        c.department === COUNSELOR_SCOPE.department
      );
    });

    const byTab =
      tab === "All" ? withinScope : withinScope.filter((r) => r.status === tab);

    const bySearch = byTab.filter((r) => {
      const hay =
        `${r.id} ${r.status} ${r.date} ${r.time} ${r.mode} ${r.reason} ` +
        `${r.student.name} ${r.student.studentId} ${r.student.email}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });

    return bySearch.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [COUNSELOR_SCOPE, tab, q]);

  const counts = useMemo(() => {
    const list = MOCK_MEET_REQUESTS.filter((r) => {
      const c = r.counselor;
      return (
        c.counselorId === COUNSELOR_SCOPE.counselorId &&
        c.campus === COUNSELOR_SCOPE.campus &&
        c.gradeLevel === COUNSELOR_SCOPE.gradeLevel &&
        c.department === COUNSELOR_SCOPE.department
      );
    });

    return {
      pending: list.filter((x) => x.status === "Pending").length,
      approved: list.filter((x) => x.status === "Approved").length,
      disapproved: list.filter((x) => x.status === "Disapproved").length,
    };
  }, [COUNSELOR_SCOPE]);

  const closeModal = () => {
    setSelected(null);
    setDecisionNote("");
    setMeetLink("");
    setMeetLinkErr("");
  };

  const validateMeetLinkIfOnline = () => {
    if (!selected) return true;
    if (selected.mode !== "Online") return true;

    const link = meetLink.trim();
    if (!link) {
      setMeetLinkErr("Google Meet link is required for Online sessions.");
      return false;
    }

    // light validation: must look like a URL
    const looksLikeUrl = /^https?:\/\/\S+$/i.test(link);
    if (!looksLikeUrl) {
      setMeetLinkErr(
        "Please enter a valid link (must start with http:// or https://).",
      );
      return false;
    }

    setMeetLinkErr("");
    return true;
  };

  const approve = () => {
    if (!selected) return;
    if (!validateMeetLinkIfOnline()) return;

    alert(
      `APPROVE (static)\n\nRequest: ${selected.id}\nStudent email: ${selected.student.email}` +
        (selected.mode === "Online"
          ? `\nGoogle Meet: ${meetLink.trim()}`
          : "") +
        `\n\nLater: backend sends email confirmation.`,
    );
    closeModal();
  };

  const disapprove = () => {
    alert(
      `DISAPPROVE (static)\n\nRequest: ${selected?.id}\nReason note: ${
        decisionNote || "—"
      }\nStudent email: ${selected?.student?.email}\n\nLater: backend sends email.`,
    );
    closeModal();
  };

  const TABS = [
    { key: "Pending", label: "Pending" },
    { key: "Approved", label: "Approved" },
    { key: "Disapproved", label: "Disapproved" },
    { key: "All", label: "All" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black tracking-tight">Meet Requests</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Students select a slot. Approve/Disapprove and send email
            confirmation (backend later).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="amber">Pending: {counts.pending}</Badge>
          <Badge tone="emerald">Approved: {counts.approved}</Badge>
          <Badge tone="red">Disapproved: {counts.disapproved}</Badge>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  "px-3 py-2 rounded-xl text-sm font-extrabold border transition",
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-[240px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by student, date, ID, email…"
            className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
          />
        </div>
      </div>

      {/* List */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="text-sm font-extrabold text-slate-700">
            Requests <span className="text-slate-500">({scoped.length})</span>
          </div>
        </div>

        {scoped.length === 0 ? (
          <div className="px-4 py-6 text-sm font-semibold text-slate-500">
            No meet requests in your scope.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {scoped.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelected(r);
                  setDecisionNote("");
                  setMeetLink("");
                  setMeetLinkErr("");
                }}
                className="w-full text-left px-4 py-3 hover:bg-slate-50/70 transition"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-800 truncate">
                      {r.student.name}
                      <span className="text-slate-500 font-bold">
                        {" "}
                        • {r.date} • {r.time} • {r.mode}
                      </span>
                    </div>

                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {r.id} • {r.reason} • {r.student.studentId}
                    </div>

                    {r.notes ? (
                      <div className="mt-2 text-sm font-semibold text-slate-600 line-clamp-2">
                        {r.notes}
                      </div>
                    ) : null}
                  </div>

                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      <Modal open={!!selected} onClose={closeModal}>
        {selected ? (
          <div className="p-5 space-y-4">
            {/* Top */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-base font-black text-slate-900">
                  Meet Request • {selected.id}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  Created: {selected.createdAt} • Status:{" "}
                  <span className="text-slate-700">{selected.status}</span>
                </div>
              </div>

              <button
                onClick={closeModal}
                className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Schedule */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-extrabold text-slate-700">
                  Schedule
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-700">
                  <span className="font-black">{selected.date}</span>{" "}
                  <span className="text-slate-500">•</span>{" "}
                  <span className="font-black">{selected.time}</span>{" "}
                  <span className="text-slate-500">•</span> {selected.mode}
                </div>
                <div className="mt-2 text-xs font-bold text-slate-500">
                  Reason:{" "}
                  <span className="text-slate-700">{selected.reason}</span>
                </div>
              </div>

              {/* Student */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-extrabold text-slate-700">
                  Student
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-700">
                  <span className="font-black">{selected.student.name}</span>{" "}
                  <span className="text-slate-500">
                    ({selected.student.studentId})
                  </span>
                </div>
                <div className="mt-2 text-xs font-bold text-slate-500">
                  Email:{" "}
                  <span className="text-slate-700">
                    {selected.student.email}
                  </span>
                </div>
                <div className="mt-2 text-xs font-bold text-slate-500">
                  Scope:{" "}
                  <span className="text-slate-700">
                    {selected.student.campus} • {selected.student.gradeLevel} •{" "}
                    {selected.student.department}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {selected.notes ? (
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-700">
                    Student Notes
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-700 whitespace-pre-wrap">
                    {selected.notes}
                  </div>
                </div>
              ) : null}

              {/* ✅ Decision */}
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-extrabold text-slate-700">
                  Decision
                </div>

                {selected.status === "Pending" ? (
                  <>
                    {/* ✅ NEW: Meet link required for Online */}
                    {selected.mode === "Online" ? (
                      <div className="mt-3">
                        <div className="text-xs font-extrabold text-slate-600 mb-2">
                          Google Meet Link{" "}
                          <span className="text-red-600">*</span>
                        </div>
                        <input
                          value={meetLink}
                          onChange={(e) => {
                            setMeetLink(e.target.value);
                            setMeetLinkErr("");
                          }}
                          placeholder="https://meet.google.com/xxx-xxxx-xxx"
                          className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
                        />
                        {meetLinkErr ? (
                          <div className="mt-2 text-xs font-extrabold text-red-700">
                            {meetLinkErr}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={approve}
                        className="px-4 py-2.5 rounded-xl text-sm font-extrabold bg-slate-900 text-white hover:bg-slate-800"
                      >
                        Approve + Email Student
                      </button>

                      <button
                        onClick={disapprove}
                        className="px-4 py-2.5 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
                      >
                        Disapprove + Email Student
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-extrabold text-slate-600 mb-2">
                        Optional note (shown in email)
                      </div>
                      <textarea
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder="Example: Please choose another slot or add more details…"
                        rows={3}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
                      />
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-sm font-semibold text-slate-500">
                    This request is{" "}
                    <span className="font-black">{selected.status}</span>.
                    Actions are disabled.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

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
