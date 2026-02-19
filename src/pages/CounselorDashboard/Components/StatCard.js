// src/pages/CounselorDashboard/Components/StatCard.jsx

export default function StatCard({
  label,
  value,
  highlight = false,
  description,
}) {
  return (
    <div
      className={[
        "rounded-2xl border bg-white p-4",
        "flex flex-col gap-2",
        highlight
          ? "border-slate-300 bg-slate-50"
          : "border-slate-200",
      ].join(" ")}
    >
      {/* Label */}
      <div className="text-sm font-semibold text-slate-500">
        {label}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900">
          {value}
        </span>

        {highlight ? (
          <span className="text-xs font-extrabold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
            Needs attention
          </span>
        ) : null}
      </div>

      {/* Optional helper text */}
      {description ? (
        <div className="text-xs font-medium text-slate-500 leading-snug">
          {description}
        </div>
      ) : null}
    </div>
  );
}
