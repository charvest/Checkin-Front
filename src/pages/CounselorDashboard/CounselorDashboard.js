// src/pages/CounselorDashboard/CounselorDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getCounselorDashboardStats } from "./counselor.api";

// sections (make sure these paths match your folders exactly)
import Inbox from "./Sections/Inbox";
import MeetRequests from "./Sections/MeetRequests";
import Calendar from "./Sections/Calendar";
import Incidents from "./Sections/Incident";
import AccountSettings from "./Sections/AccountSettings";
import Logout from "./Sections/Logout";

// ✅ NEW SECTION
import StudentAccounts from "./Sections/StudentAccounts";

// components
import StatCard from "./Components/StatCard";

/* ===================== THEME ===================== */
const BRAND = "#B9FF66"; // accent only

/* ===================== SVG ICONS ===================== */
const IconMenu = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M5 7h14M5 12h14M5 17h10" />
  </svg>
);

const IconInbox = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5 7h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z" />
  </svg>
);

const IconMeet = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconCalendar = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <path d="M3 10h18" />
  </svg>
);

const IconIncident = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M3 21h18L12 3 3 21z" />
  </svg>
);

const IconSettings = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
    <path d="M19.4 15a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L12.9 2h-3.8L8.7 4.9a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.8 7.8 0 0 0-.1 1 7.8 7.8 0 0 0 .1 1l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.9h3.8l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6z" />
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
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

// ✅ NEW ICON FOR STUDENT ACCOUNTS TAB
const IconUsers = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/* ===================== TABS ===================== */
const TABS = [
  { key: "inbox", label: "Inbox", Icon: IconInbox },
  { key: "meet", label: "Meet Requests", Icon: IconMeet },
  { key: "calendar", label: "Calendar", Icon: IconCalendar },
  { key: "incidents", label: "Incidents", Icon: IconIncident },

  // ✅ NEW TAB
  { key: "students", label: "Student Accounts", Icon: IconUsers },

  { key: "settings", label: "Account Settings", Icon: IconSettings },
  { key: "logout", label: "Logout", Icon: IconLogout },
];

export default function CounselorDashboard() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");

  const [stats, setStats] = useState({
    pendingAsk: 0,
    pendingMeet: 0,
    todaysSessions: 0,
    openIncidents: 0,
  });

  /* ===================== ROLE GUARD (DEV-SAFE) ===================== */
  useEffect(() => {
    const role = (localStorage.getItem("role") || "").trim().toLowerCase();
    const isProd =
      typeof import.meta !== "undefined"
        ? import.meta.env?.PROD
        : process.env.NODE_ENV === "production";

    if (isProd && role !== "counselor") {
      navigate("/unauthorized", { replace: true });
    }
  }, [navigate]);

  /* ===================== LOAD STATS ===================== */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getCounselorDashboardStats({ counselorId: "C-001" });
        if (mounted) setStats(data);
      } catch (e) {
        console.error("Failed to load counselor stats:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onClickTab = (key) => {
    setActiveTab(key);
    setSidebarOpen(false);
  };

  const activeLabel = useMemo(() => {
    return TABS.find((t) => t.key === activeTab)?.label || "Dashboard";
  }, [activeTab]);

  const renderActiveSection = () => {
    switch (activeTab) {
      case "meet":
        return <MeetRequests />;

      case "calendar":
        return <Calendar />;

      case "incidents":
        return <Incidents />;

      // ✅ NEW
      case "students":
        return <StudentAccounts />;

      case "settings":
        return <AccountSettings />;

      case "logout":
        return <Logout />;

      case "inbox":
      default:
        return <Inbox />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-[Nunito]">
      {/* Mobile top bar */}
      <div className="sm:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
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
            <div className="text-sm font-extrabold leading-5 truncate">
              Counselor Dashboard
            </div>
            <div className="text-xs font-bold text-slate-500 truncate">
              {activeLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay (mobile) */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={[
          "fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-slate-200",
          "transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "sm:translate-x-0",
        ].join(" ")}
        aria-label="Sidebar"
      >
        <div className="h-full overflow-y-auto">
          {/* Sidebar header */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-black tracking-tight">
                  CheckIn • Counselor
                </div>
                <div className="text-xs font-bold text-slate-500 mt-1">
                  Clean navigation for faster work
                </div>
              </div>

              {/* close button only on mobile */}
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

          {/* Nav */}
          <nav className="px-3 py-4">
            <div className="px-2 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Navigation
            </div>

            <ul className="mt-2 space-y-1">
              {TABS.map((t) => {
                const active = t.key === activeTab;
                return (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => onClickTab(t.key)}
                      className={[
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
                        "text-sm font-extrabold transition",
                        active
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      <t.Icon
                        className={[
                          "w-5 h-5 shrink-0",
                          active ? "text-white" : "text-slate-500",
                        ].join(" ")}
                      />
                      <span className="flex-1 text-left">{t.label}</span>

                      {active ? (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: BRAND }}
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-xs font-extrabold text-slate-700">
                Privacy rule
              </div>
              <div className="mt-1 text-[12px] font-bold text-slate-500 leading-relaxed">
                Anonymous identity can only be unmasked after an incident is
                created and investigation is approved.
              </div>
            </div>
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="sm:ml-72">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Desktop header */}
          <header className="hidden sm:block mb-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight">
                  Counselor Dashboard
                </h1>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {activeLabel}
                </p>
              </div>

              <div
                className="h-2 w-40 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${BRAND}, rgba(185,255,102,0))`,
                }}
              />
            </div>
          </header>

          {/* Summary Cards (hide when on Logout) */}
          {activeTab !== "logout" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
              <StatCard label="Pending Questions" value={stats.pendingAsk} />
              <StatCard label="Meet Requests" value={stats.pendingMeet} />
              <StatCard label="Today's Sessions" value={stats.todaysSessions} />
              <StatCard
                label="Open Incidents"
                value={stats.openIncidents}
                highlight
              />
            </div>
          ) : null}

          {/* Main section */}
          <main className="min-w-0">{renderActiveSection()}</main>
        </div>
      </div>
    </div>
  );
}
