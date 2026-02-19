// src/pages/CounselorDashboard/Sections/AccountSettings.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../../../utils/auth"; // adjust path if different

const BACKUP_KEY = "checkin:user_backup";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const localUser = useMemo(() => getUser?.() || null, []);
  const role = (localStorage.getItem("role") || "").trim() || "counselor";

  const [profile, setProfile] = useState({
    fullName: localUser?.fullName || localUser?.name || "Counselor",
    email: localUser?.email || "counselor@email.com",
    counselorId: localUser?.counselorId || "C-001",
    department: localUser?.department || "Guidance Office",
  });

  // ✅ removed sound + darkMode
  const [prefs, setPrefs] = useState(() =>
    safeParse(localStorage.getItem("checkin:counselor_prefs"), {
      notifications: true,
    })
  );

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // Delete account UI
  const [deleteText, setDeleteText] = useState("");
  const [dangerMsg, setDangerMsg] = useState("");

  useEffect(() => {
    localStorage.setItem("checkin:counselor_prefs", JSON.stringify(prefs));
  }, [prefs]);

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg("");

    try {
      const existing = safeParse(localStorage.getItem("user"), {});
      const merged = { ...existing, ...profile };
      localStorage.setItem("user", JSON.stringify(merged));
      setSavedMsg("Saved successfully.");
    } catch {
      setSavedMsg("Failed to save. Try again.");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(""), 2500);
    }
  };

  const backupAccount = () => {
    try {
      const user = safeParse(localStorage.getItem("user"), null);
      if (!user) {
        setSavedMsg("No user found to backup.");
        return;
      }
      localStorage.setItem(BACKUP_KEY, JSON.stringify(user));
      setSavedMsg("Account backup saved.");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch {
      setSavedMsg("Backup failed.");
      setTimeout(() => setSavedMsg(""), 2500);
    }
  };

  const restoreAccount = () => {
    try {
      const backup = safeParse(localStorage.getItem(BACKUP_KEY), null);
      if (!backup) {
        setSavedMsg("No backup found.");
        return;
      }
      localStorage.setItem("user", JSON.stringify(backup));
      setProfile((p) => ({
        ...p,
        fullName: backup.fullName || backup.name || p.fullName,
        email: backup.email || p.email,
        counselorId: backup.counselorId || p.counselorId,
        department: backup.department || p.department,
      }));
      setSavedMsg("Account restored from backup.");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch {
      setSavedMsg("Restore failed.");
      setTimeout(() => setSavedMsg(""), 2500);
    }
  };

  const canDelete = deleteText.trim().toUpperCase() === "DELETE";

  const deleteAccount = () => {
    setDangerMsg("");

    if (!canDelete) {
      setDangerMsg('Type "DELETE" to confirm.');
      return;
    }

    try {
      // Clear auth + user + counselor data
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");

      localStorage.removeItem("checkin:counselor_prefs");
      localStorage.removeItem("checkin:counselor_inbox_items");
      localStorage.removeItem("checkin:counselor_activity_log");
      localStorage.removeItem("checkin:user_backup");

      navigate("/login", { replace: true });
    } catch {
      setDangerMsg("Delete failed. Try again.");
    }
  };

  return (
    <section className="space-y-4">
      {/* Header (✅ removed green line) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight">
            Account Settings
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Update your profile details and preferences.
          </p>
        </div>
      </div>

      {/* Profile */}
      <form
        onSubmit={onSaveProfile}
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-black text-slate-900">Profile</div>
          <div className="text-xs font-extrabold text-slate-500">
            Role: <span className="text-slate-700">{role}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Field
            label="Full name"
            value={profile.fullName}
            onChange={(v) => setProfile((p) => ({ ...p, fullName: v }))}
            placeholder="Full name"
          />
          <Field
            label="Email"
            value={profile.email}
            onChange={(v) => setProfile((p) => ({ ...p, email: v }))}
            placeholder="Email"
            type="email"
          />
          <Field
            label="Counselor ID"
            value={profile.counselorId}
            onChange={(v) => setProfile((p) => ({ ...p, counselorId: v }))}
            placeholder="C-001"
          />
          <Field
            label="Department"
            value={profile.department}
            onChange={(v) => setProfile((p) => ({ ...p, department: v }))}
            placeholder="Guidance Office"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-bold text-slate-500">
            {savedMsg ? (
              <span className="text-slate-700 font-extrabold">{savedMsg}</span>
            ) : (
              "Changes are saved locally for now."
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className={[
              "inline-flex items-center justify-center rounded-xl px-4 py-2.5",
              "text-sm font-black border border-slate-200",
              "bg-slate-900 text-white hover:bg-slate-800 transition",
              saving ? "opacity-70 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>

        {/* Retrieve / Backup */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={backupAccount}
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
          >
            Backup Account
          </button>
          <button
            type="button"
            onClick={restoreAccount}
            className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
          >
            Restore Account
          </button>
        </div>
      </form>

      {/* Preferences (✅ only notifications) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="text-sm font-black text-slate-900">Preferences</div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Toggle
            label="Notifications"
            desc="Show alerts for new messages and requests."
            checked={prefs.notifications}
            onChange={(v) => setPrefs((p) => ({ ...p, notifications: v }))}
          />
        </div>
      </div>

      {/* ✅ Redesigned Danger Zone */}
      <div className="rounded-2xl border border-red-200 bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-black text-red-700">Danger Zone</div>
            <div className="mt-1 text-sm font-bold text-slate-600">
              This action permanently removes local counselor data:
              inbox, activity logs, preferences, and backup.
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <div className="text-xs font-extrabold text-red-700">
              Type <span className="text-red-900">DELETE</span> to enable
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <label className="block">
            <div className="text-xs font-extrabold text-slate-600">Confirmation</div>
            <input
              value={deleteText}
              onChange={(e) => {
                setDeleteText(e.target.value);
                setDangerMsg("");
              }}
              placeholder='Type "DELETE"'
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-red-50"
            />
          </label>

          {dangerMsg ? (
            <div className="text-xs font-extrabold text-red-700">{dangerMsg}</div>
          ) : (
            <div className="text-xs font-bold text-slate-500">
              This cannot be undone.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={!canDelete}
              className={[
                "h-11 px-4 rounded-xl text-sm font-black text-white transition",
                canDelete ? "bg-red-600 hover:bg-red-700" : "bg-red-300 cursor-not-allowed",
              ].join(" ")}
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <div className="text-xs font-extrabold text-slate-600">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          "mt-1 w-full rounded-xl border border-slate-200 bg-white",
          "px-3 py-2.5 text-sm font-bold text-slate-900",
          "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10",
        ].join(" ")}
      />
    </label>
  );
}

function Toggle({ label, desc, checked, onChange }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-900">{label}</div>
          <div className="mt-1 text-[12px] font-bold text-slate-500 leading-relaxed">
            {desc}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={[
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition",
            checked ? "bg-slate-900" : "bg-slate-200",
          ].join(" ")}
          aria-pressed={checked}
        >
          <span
            className={[
              "inline-block h-5 w-5 transform rounded-full bg-white transition",
              checked ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </div>
    </div>
  );
}
