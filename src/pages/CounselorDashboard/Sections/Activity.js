// src/pages/CounselorDashboard/Sections/Activity.jsx
import { useMemo, useState } from "react";
import { getActivity } from "../counselor.api";

function Badge({ children, tone = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    red: "bg-red-50 text-red-800 border-red-100",
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

function toneForType(type) {
  if (type === "identity_unmasked") return "red";
  if (type === "incident_created") return "amber";
  if (type === "reply_sent") return "emerald";
  if (type === "unmask_denied") return "slate";
  return "slate";
}

export default function Activity() {
  const [items, setItems] = useState(() => getActivity());
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((x) => {
      const hay = `${x.type} ${x.label} ${x.refId} ${x.at} ${JSON.stringify(
        x.meta || {}
      )}`.toLowerCase();
      return hay.includes(query);
    });
  }, [items, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black tracking-tight">Student Activity</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Audit-style feed of actions (reply, incident creation, identity unlock).
          </p>
        </div>

        <button
          onClick={() => setItems(getActivity())}
          className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search activity…"
            className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
          />
        </div>
        <Badge tone="slate">Total: {filtered.length}</Badge>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="text-sm font-extrabold text-slate-700">Recent</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-sm font-semibold text-slate-500">
            No activity yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-800">
                      {a.label}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {a.at} • Ref:{" "}
                      <span className="font-extrabold text-slate-700">
                        {a.refId || "—"}
                      </span>
                    </div>
                    {a.meta ? (
                      <div className="mt-2 text-xs font-bold text-slate-500">
                        {JSON.stringify(a.meta)}
                      </div>
                    ) : null}
                  </div>

                  <Badge tone={toneForType(a.type)}>{a.type}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
