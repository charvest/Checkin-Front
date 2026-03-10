import React, { useEffect, useMemo, useState } from "react";

// sections (create these files just like counselor)
import StudentLifecycle from "./Sections/StudentLifecycle";
import CounselorManagement from "./Sections/CounselorManagement";
import AssignmentsReassignment from "./Sections/AssignmentsReassignment";

/* ===================== THEME ===================== */
const BRAND = "#B9FF66"; // accent only

/* ===================== ENV HELPERS ===================== */
function isProductionEnv() {
  if (typeof process !== "undefined" && process?.env?.NODE_ENV) {
    return process.env.NODE_ENV === "production";
  }
  try {
    // eslint-disable-next-line no-new-func
    const meta = new Function("return import.meta")();
    return Boolean(meta?.env?.PROD);
  } catch {
    return false;
  }
}

/* ===================== SVG ICONS ===================== */
const IconMenu = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </svg>
);

const IconUsers = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconShuffle = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 3h5v5" />
    <path d="M4 20l8-8" />
    <path d="M21 3l-7 7" />
    <path d="M16 21h5v-5" />
    <path d="M4 4l6 6" />
    <path d="M21 21l-6-6" />
  </svg>
);

const IconBriefcase = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <path d="M2 13h20" />
  </svg>
);


const IconLogout = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

/* ===================== TABS ===================== */
const MAIN_TABS = [
  { key: "studentLifecycle", label: "Student Lifecycle", Icon: IconUsers },
  { key: "counselorManagement", label: "Counselor Management", Icon: IconBriefcase },
  { key: "assignments", label: "Analytics", Icon: IconShuffle },
];

const BOTTOM_TABS = [
 
  { key: "logout", label: "Logout", Icon: IconLogout },
];

const ALL_TABS = [...MAIN_TABS, ...BOTTOM_TABS];

function SidebarTooltip({ show, text }) {
  if (!show) return null;

  return (
    <span
      className={[
        "hidden sm:block",
        "pointer-events-none select-none",
        "absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[60]",
        "px-3 py-1.5 rounded-xl",
        "bg-slate-900 text-white text-[12px] font-extrabold whitespace-nowrap",
        "opacity-0 translate-x-1",
        "group-hover:opacity-100 group-hover:translate-x-0",
        "transition duration-150",
        "shadow-lg",
      ].join(" ")}
      role="tooltip"
    >
      {text}
    </span>
  );
}

function SidebarTabButton({ tab, activeTab, onClickTab, sidebarCollapsed }) {
  const active = tab.key === activeTab;

  return (
    <li className="relative group overflow-x-clip">
      <button
        type="button"
        onClick={() => onClickTab(tab.key)}
        aria-label={tab.label}
        className={[
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
          "text-sm font-extrabold transition",
          sidebarCollapsed ? "sm:justify-center sm:px-2" : "",
          active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
        ].join(" ")}
      >
        <tab.Icon
          className={["w-5 h-5 shrink-0", active ? "text-white" : "text-slate-500"].join(" ")}
        />

        <span className={sidebarCollapsed ? "hidden sm:hidden" : "flex-1 text-left"}>
          {tab.label}
        </span>

        {!sidebarCollapsed && active ? (
          <span className="w-2 h-2 rounded-full" style={{ background: BRAND }} />
        ) : null}
      </button>

      <SidebarTooltip show={sidebarCollapsed} text={tab.label} />
    </li>
  );
}

export default function AdminDashboard() {

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("studentLifecycle");

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen]);

  const onClickTab = (key) => {
    setActiveTab(key);
    setSidebarOpen(false);
  };

  const activeLabel = useMemo(
    () => ALL_TABS.find((t) => t.key === activeTab)?.label || "Dashboard",
    [activeTab]
  );

  const renderActiveSection = () => {
    switch (activeTab) {
      case "counselorManagement":
        return <CounselorManagement />;
      case "assignments":
        return <AssignmentsReassignment />;
    
      case "studentLifecycle":
      default:
        return <StudentLifecycle />;
    }
  };

  return (
    <div className="h-dvh overflow-hidden bg-slate-50 text-slate-900 font-[Nunito] flex flex-col">
      <style>{`
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="sm:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
            aria-label="Open sidebar"
          >
            <IconMenu className="w-5 h-5 text-slate-700" />
          </button>

          <div className="min-w-0">
            <div className="text-sm font-extrabold leading-5 truncate">Admin Dashboard</div>
            <div className="text-xs font-bold text-slate-500 truncate">{activeLabel}</div>
          </div>
        </div>
      </div>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={[
          "fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200",
          "transition-[transform,width] duration-200",
          "w-[85vw] max-w-[20rem]",
          sidebarCollapsed ? "sm:w-20" : "sm:w-72",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "sm:translate-x-0",
          "overflow-x-clip",
        ].join(" ")}
        aria-label="Sidebar"
      >
        <div className="h-full flex flex-col overflow-x-clip">
          <div
            className={[
              "border-b border-slate-200 shrink-0",
              sidebarCollapsed ? "px-3 pt-4 pb-3" : "px-5 pt-5 pb-4",
            ].join(" ")}
          >
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center justify-start gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((v) => !v)}
                  className="hidden sm:inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50"
                  aria-label="Expand sidebar"
                >
                  <IconMenu className="w-5 h-5 text-slate-700" />
                </button>

                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50"
                  aria-label="Close sidebar"
                >
                  <span className="text-slate-700 font-black">✕</span>
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-black tracking-tight truncate">
                    CheckIn • Admin
                  </div>
                  <div className="text-xs font-bold text-slate-500 mt-1 truncate" />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed((v) => !v)}
                    className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50"
                    aria-label="Collapse sidebar"
                  >
                    <IconMenu className="w-5 h-5 text-slate-700" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50"
                    aria-label="Close sidebar"
                  >
                    <span className="text-slate-700 font-black">✕</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <nav className="px-3 py-4 flex-1 min-h-0 overflow-y-auto overflow-x-clip">
            <div
              className={[
                "px-2 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider",
                sidebarCollapsed ? "hidden sm:block sm:text-center sm:px-0" : "",
              ].join(" ")}
            >
              {sidebarCollapsed ? "" : "Navigation"}
            </div>

            <ul className="mt-2 space-y-1">
              {MAIN_TABS.map((t) => (
                <SidebarTabButton
                  key={t.key}
                  tab={t}
                  activeTab={activeTab}
                  onClickTab={onClickTab}
                  sidebarCollapsed={sidebarCollapsed}
                />
              ))}
            </ul>
          </nav>

          <div className="px-3 pb-4 pt-2 shrink-0 border-t border-slate-200 overflow-x-clip">
            <ul className="space-y-1">
              {BOTTOM_TABS.map((t) => (
                <SidebarTabButton
                  key={t.key}
                  tab={t}
                  activeTab={activeTab}
                  onClickTab={onClickTab}
                  sidebarCollapsed={sidebarCollapsed}
                />
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <div
        className={[
          "flex-1 min-h-0 overflow-hidden transition-[margin] duration-200",
          sidebarCollapsed ? "sm:ml-20" : "sm:ml-72",
        ].join(" ")}
      >
        <div className="h-full min-h-0 p-4 sm:p-6 lg:p-8 flex flex-col">
          <header className="hidden sm:block mb-5 shrink-0">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight">
                  Admin Dashboard
                </h1>
                <p className="mt-1 text-sm font-bold text-slate-500">{activeLabel}</p>
              </div>

              <div
                className="h-2 w-40 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${BRAND}, rgba(185,255,102,0))`,
                }}
              />
            </div>
          </header>

          <main className="min-w-0 flex-1 min-h-0 overflow-auto no-scrollbar">
            {renderActiveSection()}
          </main>
        </div>
      </div>
    </div>
  );
}
