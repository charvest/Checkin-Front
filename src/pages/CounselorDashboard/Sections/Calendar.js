// src/pages/CounselorDashboard/Sections/Calendar.jsx
import { useMemo, useState } from "react";

/**
 * ✅ Clean + readable Calendar/Schedule UI
 * - Same mock logic
 * - No doodle look (no thick borders/shadows)
 * - Better spacing + hierarchy
 * - Print still supported (clean print stylesheet)
 */

/* ===================== STATIC SESSIONS ===================== */
const MOCK_SESSIONS = [
  {
    id: "S-3101",
    type: "Meet",
    studentName: "Maria Santos",
    studentId: "2023-008899",
    campus: "Main Campus",
    gradeLevel: "Grade 12",
    department: "STEM",
    counselorId: "C-001",
    date: "2026-01-11",
    time: "2:00 PM – 2:30 PM",
    mode: "In-person",
    status: "Approved",
    notes: "Student requested personal discussion.",
  },
  {
    id: "S-3102",
    type: "Meet",
    studentName: "Juan Dela Cruz",
    studentId: "2023-004455",
    campus: "Main Campus",
    gradeLevel: "Grade 11",
    department: "ABM",
    counselorId: "C-001",
    date: "2026-01-12",
    time: "10:00 AM – 10:30 AM",
    mode: "Online",
    status: "Approved",
    notes: "Stress / workload concerns.",
  },
  {
    id: "S-3103",
    type: "Ask",
    studentName: "Hidden (Anonymous)",
    studentId: null,
    campus: "Main Campus",
    gradeLevel: "Grade 11",
    department: "HUMSS",
    counselorId: "C-001",
    date: "2026-01-10",
    time: "—",
    mode: "Message",
    status: "Pending",
    notes: "Awaiting counselor response.",
  },
];

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Badge({ children, tone = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
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
  if (status === "Approved") return "emerald";
  if (status === "Pending") return "amber";
  return "slate";
}

export default function Calendar() {
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const sessionsForDay = useMemo(() => {
    return MOCK_SESSIONS.filter((s) => s.date === selectedDate);
  }, [selectedDate]);

  const upcoming = useMemo(() => {
    return [...MOCK_SESSIONS]
      .filter((s) => s.date >= selectedDate)
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .slice(0, 8);
  }, [selectedDate]);

  const printSchedule = () => window.print();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black tracking-tight">Calendar / Schedule</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            View sessions by date and check upcoming appointments.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap calActions">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
          />

          <button
            onClick={printSchedule}
            className="h-11 px-4 rounded-xl text-sm font-extrabold bg-slate-900 text-white hover:bg-slate-800"
          >
            Print
          </button>
        </div>
      </div>

      {/* Day view */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="text-sm font-extrabold text-slate-700">
            Sessions on <span className="text-slate-500">{selectedDate}</span>
          </div>
        </div>

        <div className="p-4">
          {sessionsForDay.length === 0 ? (
            <div className="text-sm font-semibold text-slate-500">
              No sessions scheduled for this date.
            </div>
          ) : (
            <div className="grid gap-3">
              {sessionsForDay.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-800">
                        {s.type === "Meet" ? "Meeting" : "Ask Question"}{" "}
                        <span className="text-slate-500 font-bold">
                          • {s.time} • {s.mode} • {s.campus}
                        </span>
                      </div>

                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {s.studentId ? (
                          <>
                            Student:{" "}
                            <span className="font-extrabold text-slate-700">
                              {s.studentName} ({s.studentId})
                            </span>
                          </>
                        ) : (
                          <>
                            Student:{" "}
                            <span className="font-extrabold text-slate-700">
                              {s.studentName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                  </div>

                  {s.notes ? (
                    <div className="mt-3 text-sm font-semibold text-slate-600">
                      <span className="text-slate-500 font-bold">Notes:</span>{" "}
                      {s.notes}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Upcoming */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="text-sm font-extrabold text-slate-700">Upcoming</div>
        </div>

        <div className="p-4">
          {upcoming.length === 0 ? (
            <div className="text-sm font-semibold text-slate-500">
              No upcoming sessions.
            </div>
          ) : (
            <div className="grid gap-2">
              {upcoming.map((s) => (
                <div
                  key={s.id}
                  className={[
                    "rounded-2xl border p-3",
                    s.date === selectedDate
                      ? "border-slate-300 bg-slate-50"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-800">
                        {s.date}{" "}
                        <span className="text-slate-500 font-bold">•</span>{" "}
                        {s.type}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {s.studentId ? s.studentName : "Anonymous"} • {s.mode}
                      </div>
                    </div>

                    <div className="text-xs font-bold text-slate-500 whitespace-nowrap">
                      {s.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ✅ Print Design */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .calActions { display: none !important; }
          .no-print { display: none !important; }

          /* Keep sections clean for printing */
          section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
