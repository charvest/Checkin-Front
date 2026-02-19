// src/pages/CounselorDashboard/Components/PHQ9Card.jsx
function severity(total) {
  if (total <= 4) return { label: "Minimal", tone: "slate" };
  if (total <= 9) return { label: "Mild", tone: "amber" };
  if (total <= 14) return { label: "Moderate", tone: "amber" };
  if (total <= 19) return { label: "Moderately Severe", tone: "red" };
  return { label: "Severe", tone: "red" };
}

function toneClasses(tone) {
  const map = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    amber: "bg-amber-50 border-amber-100 text-amber-800",
    red: "bg-red-50 border-red-100 text-red-800",
  };
  return map[tone] || map.slate;
}

export default function PHQ9Card({ phq9 }) {
  if (!phq9) return null;

  const total = Number(phq9.total ?? 0);
  const sev = severity(total);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-black text-slate-900">PHQ-9</div>
          <div className="mt-1 text-xs font-bold text-slate-500">
            Submitted:{" "}
            <span className="text-slate-700 font-extrabold">
              {phq9.submittedAt || "—"}
            </span>
          </div>
        </div>

        <div
          className={[
            "rounded-full border px-3 py-1 text-xs font-extrabold",
            toneClasses(sev.tone),
          ].join(" ")}
        >
          {sev.label}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <div className="text-3xl font-black text-slate-900">{total}</div>
        <div className="text-sm font-bold text-slate-500">/ 27</div>
      </div>

      {Array.isArray(phq9.answers) && phq9.answers.length === 9 ? (
        <div className="mt-3">
          <div className="text-xs font-extrabold text-slate-600 mb-2">
            Answers (0–3)
          </div>
          <div className="grid grid-cols-9 gap-1">
            {phq9.answers.map((a, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-slate-200 bg-slate-50 text-center py-1 text-xs font-black text-slate-700"
                title={`Q${idx + 1}: ${a}`}
              >
                {a}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
