// frontend/src/pages/Student/ProfileSettings.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, updateAuthUser } from "../../utils/auth";

const PRIMARY_GREEN = "#B9FF66";
const GREEN_GLOW = "rgba(185, 255, 102, 0.22)";
const GREEN_SOFT = "rgba(185, 255, 102, 0.08)";

const TEXT_MAIN = "#0F172A";
const TEXT_MUTED = "#475569";
const TEXT_SOFT = "#64748B";

const DEFAULT_CAMPUS = "Arellano University Andres Bonifacio Campus=";

const EMPTY_PROFILE = {
  firstName: "",
  lastName: "",
  username: "",
  studentNumber: "",
  email: "",
  campus: "",
  course: "",
  accountCreation: "",
  avatarUrl: "",
  roleLabel: "",
};

function safeText(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function splitName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

function getInitials(firstName = "", lastName = "") {
  const f = String(firstName || "").trim();
  const l = String(lastName || "").trim();
  const first = f ? f[0] : "";
  const last = l ? l[0] : "";
  const initials = (first + last).toUpperCase();
  return initials || "U";
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return safeText(value);
    return d.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return safeText(value);
  }
}

function Spinner({ size = 18 }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function IconCamera({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/* ======================
   API BASE (Local + Render)
====================== */
const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");
const UPLOADS_ORIGIN = (process.env.REACT_APP_UPLOADS_URL || API_BASE || "http://localhost:5000").replace(/\/+$/, "");

function isAbsoluteUrl(u = "") {
  const s = String(u || "").trim().toLowerCase();
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:") || s.startsWith("blob:");
}

function joinOrigin(origin, path) {
  const o = String(origin || "").replace(/\/+$/, "");
  const p = String(path || "").trim();
  if (!o) return p;
  if (!p) return "";
  if (p.startsWith("/")) return `${o}${p}`;
  return `${o}/${p}`;
}

function withCacheBust(url, bustValue) {
  if (!url || !bustValue) return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("v", String(bustValue));
    return u.toString();
  } catch {
    const glue = url.includes("?") ? "&" : "?";
    return `${url}${glue}v=${encodeURIComponent(String(bustValue))}`;
  }
}

function normalizeAvatarSrc(rawUrl, bustValue) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  if (isAbsoluteUrl(raw)) return withCacheBust(raw, bustValue);

  const looksUploads = raw.startsWith("/uploads") || raw.startsWith("uploads/");
  const full = looksUploads ? joinOrigin(UPLOADS_ORIGIN, raw) : raw;
  return withCacheBust(full, bustValue);
}

async function fetchJsonSafe(url, options) {
  const res = await fetch(url, options);
  const raw = await res.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  return { res, data, raw };
}

async function fetchMyProfile() {
  const token = getToken();
  if (!token) throw new Error("Not authorized");

  const urls = [
    API_BASE ? `${API_BASE}/api/auth/me` : "/api/auth/me",
    API_BASE ? `${API_BASE}/api/users/me` : "/api/users/me",
    API_BASE ? `${API_BASE}/api/users/profile` : "/api/users/profile",
  ];

  let lastErr = null;

  for (const url of urls) {
    try {
      const { res, data, raw } = await fetchJsonSafe(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (res.status === 404) continue;

      if (res.status === 401 || res.status === 403) throw new Error("Not authorized");

      if (!res.ok) {
        const msg = (data?.message || raw || "Failed to load profile.").toString();
        throw new Error(msg);
      }

      return data?.user ?? data;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Failed to load profile.");
}

function looksLikeHandle(name, username, email) {
  const n = String(name || "").trim();
  if (!n) return false;

  const nLower = n.toLowerCase();
  const uLower = String(username || "").trim().toLowerCase();
  const emailPrefix = String(email || "").split("@")[0]?.trim().toLowerCase();

  if (uLower && nLower === uLower) return true;
  if (emailPrefix && nLower === emailPrefix) return true;
  if (!/\s/.test(n) && /\d/.test(n)) return true;

  return false;
}

function AvatarFeedback({ avatarError, avatarSuccess }) {
  if (!avatarError && !avatarSuccess) return null;

  return (
    <div className="w-full" style={{ fontFamily: "Nunito, sans-serif" }} role={avatarError ? "alert" : "status"}>
      {avatarError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          <span className="font-black">Photo:</span> {avatarError}
        </div>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-800">
          <span className="font-black">Photo:</span> {avatarSuccess}
        </div>
      )}
    </div>
  );
}

function AvatarActions({ pending, uploading, onUpload, onCancel }) {
  if (!pending) return null;

  return (
    <div className="flex items-center justify-center sm:justify-end gap-2">
      <button
        type="button"
        onClick={onUpload}
        className="rounded-xl border border-slate-900 bg-slate-900 px-5 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
        style={{ fontFamily: "Nunito, sans-serif" }}
        disabled={uploading}
      >
        {uploading ? <Spinner size={14} /> : null}
        Upload
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-800 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ fontFamily: "Nunito, sans-serif" }}
        disabled={uploading}
      >
        Cancel
      </button>
    </div>
  );
}

export default function ProfileSettings() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const fileInputRef = useRef(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");

  const [avatarBust, setAvatarBust] = useState(0);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [avatarRetry, setAvatarRetry] = useState(0);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const pickAvatarFile = () => {
    setAvatarError("");
    setAvatarSuccess("");
    setAvatarLoadFailed(false);
    setAvatarRetry(0);
    fileInputRef.current?.click();
  };

  const onAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError("");
    setAvatarSuccess("");
    setAvatarLoadFailed(false);
    setAvatarRetry(0);

    if (!file.type?.startsWith("image/")) {
      setAvatarError("Please select an image file (JPG/PNG/WebP).");
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setAvatarError("Image is too large. Please choose a file under 5MB.");
      return;
    }

    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    const url = URL.createObjectURL(file);

    setPendingAvatarFile(file);
    setAvatarPreviewUrl(url);
  };

  const cancelAvatarChange = () => {
    setAvatarError("");
    setAvatarSuccess("");
    setPendingAvatarFile(null);
    setAvatarLoadFailed(false);
    setAvatarRetry(0);

    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAvatar = async () => {
    if (!pendingAvatarFile) return;

    const token = getToken();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setAvatarUploading(true);
    setAvatarError("");
    setAvatarSuccess("");
    setAvatarLoadFailed(false);
    setAvatarRetry(0);

    const form = new FormData();
    form.append("avatar", pendingAvatarFile);

    const url = API_BASE ? `${API_BASE}/api/users/me/avatar` : "/api/users/me/avatar";

    try {
      const { res, data, raw } = await fetchJsonSafe(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: form,
      });

      if (res.status === 401 || res.status === 403) {
        navigate("/login", { replace: true });
        return;
      }

      if (!res.ok) {
        const msg = (data?.message || raw || "Failed to upload photo.").toString();
        throw new Error(msg);
      }

      const newAvatar =
        data?.avatarUrl ||
        data?.photoURL ||
        data?.photoUrl ||
        data?.profilePictureUrl ||
        data?.profilePicture ||
        data?.user?.avatarUrl ||
        data?.user?.photoURL ||
        data?.user?.profilePictureUrl ||
        "";

      const cleaned = String(newAvatar || "").trim();
      if (!cleaned) throw new Error("Upload succeeded but no avatar URL was returned.");

      setProfile((prev) => ({ ...prev, avatarUrl: cleaned }));

      try {
        updateAuthUser({ avatarUrl: cleaned });
      } catch {}

      setAvatarBust(Date.now());
      setAvatarLoadFailed(false);
      setAvatarRetry(0);

      setAvatarSuccess("Profile photo updated.");
      setPendingAvatarFile(null);

      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setAvatarError(err?.message || "Failed to upload photo.");
    } finally {
      setAvatarUploading(false);
    }
  };

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true });
      return;
    }

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setPageError("");

        const p = await fetchMyProfile();
        if (!alive) return;

        const backendFirst = (p?.firstName || "").trim();
        const backendLast = (p?.lastName || "").trim();
        const backendFull = (p?.fullName || "").trim();
        const backendUsername = (p?.username || "").trim();
        const backendEmail = (p?.email || "").trim();

        const split = splitName(backendFull);
        let firstName = backendFirst || split.firstName || "";
        let lastName = backendLast || split.lastName || "";

        const firstLooksHandle = looksLikeHandle(firstName, backendUsername, backendEmail);
        const fullLooksHandle = looksLikeHandle(backendFull, backendUsername, backendEmail);

        if (!backendFirst && !backendLast && firstLooksHandle && !lastName) {
          firstName = "";
          lastName = "";
        }

        if (backendFirst && firstLooksHandle && !backendLast) {
          if (backendFull && backendFull.includes(" ") && !fullLooksHandle) {
            const s2 = splitName(backendFull);
            firstName = s2.firstName;
            lastName = s2.lastName;
          } else {
            firstName = "";
            lastName = "";
          }
        }

        const campus = (p?.campus || "").trim() || DEFAULT_CAMPUS;

        const avatarUrl = String(
          p?.avatarUrl ||
            p?.profilePictureUrl ||
            p?.profilePicture ||
            p?.photoURL ||
            p?.photoUrl ||
            p?.imageUrl ||
            p?.image ||
            "",
        ).trim();

        const roleLabel = String(p?.roleLabel || p?.role || p?.userRole || p?.accountType || p?.type || "Student")
          .replace(/_/g, " ")
          .trim();

        setProfile({
          firstName,
          lastName,
          username: backendUsername || "",
          studentNumber: p?.studentNumber || "",
          email: backendEmail || "",
          campus,
          course: (p?.course || "").trim(),
          accountCreation: formatDate(p?.accountCreation || p?.createdAt || p?.created_on || ""),
          avatarUrl,
          roleLabel,
        });

        setAvatarBust(Date.now());
        setAvatarLoadFailed(false);
        setAvatarRetry(0);
      } catch (e) {
        if (!alive) return;

        const msg = e?.message || "Failed to load profile";

        if (String(msg).toLowerCase().includes("not authorized")) {
          navigate("/login", { replace: true });
          return;
        }

        setPageError(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  const displayName = useMemo(() => {
    const full = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
    return full || "—";
  }, [profile.firstName, profile.lastName]);

  const mobilePrimaryLabel = useMemo(() => {
    const u = String(profile.username || "").trim();
    return u || displayName;
  }, [profile.username, displayName]);

  const uiFields = useMemo(() => {
    return [
      { label: "Full Name", value: displayName },
      { label: "Student Number", value: safeText(profile.studentNumber), mono: true },
      { label: "Email", value: safeText(profile.email), breakAll: true },
      { label: "Campus", value: safeText(profile.campus) },
      { label: "Course", value: safeText(profile.course), multiline: true },
      { label: "Account Creation", value: safeText(profile.accountCreation), mono: true },
    ];
  }, [displayName, profile]);

  const avatarSrc = useMemo(() => {
    const raw = avatarPreviewUrl || profile.avatarUrl;
    return normalizeAvatarSrc(raw, avatarBust);
  }, [avatarPreviewUrl, profile.avatarUrl, avatarBust]);

  const handleAvatarError = () => {
    if (avatarPreviewUrl) {
      setAvatarLoadFailed(true);
      return;
    }

    if (avatarRetry < 2) {
      const next = avatarRetry + 1;
      setAvatarRetry(next);
      setTimeout(() => setAvatarBust(Date.now()), 650 * next);
      return;
    }

    setAvatarLoadFailed(true);
  };

  const handleAvatarLoad = () => {
    setAvatarLoadFailed(false);
    setAvatarRetry(0);
  };

  const showAvatarImage = Boolean(avatarSrc) && !avatarLoadFailed;

  return (
    <div
      className={[
        "min-h-[calc(100vh-82px)] w-full",
        "bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9]",
        "px-2 sm:px-6 lg:px-8 pb-10 flex justify-center",
        "pt-[max(2.75rem,env(safe-area-inset-top))] sm:pt-14 lg:pt-16",
      ].join(" ")}
    >
      <div className="w-full max-w-4xl xl:max-w-5xl">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-xl" role="region" aria-labelledby="profile-settings-title">
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `0 0 0 6px ${GREEN_GLOW}` }} aria-hidden="true" />

          <div className="relative px-4 sm:px-7 lg:px-9 py-7 sm:py-9">
            <header className="max-w-3xl mx-auto sm:mx-0 text-center sm:text-left">
              <h1
                id="profile-settings-title"
                className="font-extrabold tracking-tight text-2xl sm:text-3xl lg:text-[34px] break-words leading-tight"
                style={{ fontFamily: "Nunito, sans-serif", color: TEXT_MAIN }}
              >
                Profile Settings
              </h1>

              <p className="mt-2.5 text-sm sm:text-base break-words leading-relaxed" style={{ fontFamily: "Lora, serif", color: TEXT_MUTED }}>
                This information is <strong style={{ color: TEXT_MAIN }}>read-only</strong>. Corrections must be requested via the{" "}
                <strong style={{ color: TEXT_MAIN }}>Guidance Office</strong>.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 justify-center sm:justify-start">
                {loading && (
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-green-200/70 bg-green-50/60 px-3.5 py-1.5 text-xs sm:text-sm font-extrabold text-gray-700 whitespace-nowrap"
                    style={{ fontFamily: "Nunito, sans-serif", boxShadow: `0 0 0 2px ${GREEN_GLOW}` }}
                  >
                    <Spinner size={16} />
                    Loading profile…
                  </div>
                )}

                {pageError && !loading && (
                  <div className="rounded-[16px] border-2 border-black bg-red-50 px-4 py-3 text-[13px] text-black">
                    <span className="font-extrabold">Error:</span> {pageError}
                  </div>
                )}

                <span
                  className="inline-flex items-center gap-2 rounded-full border border-green-200/70 bg-green-50/60 px-3.5 py-1.5 text-xs sm:text-sm font-extrabold text-gray-700 whitespace-nowrap"
                  style={{ fontFamily: "Nunito, sans-serif", boxShadow: `0 0 0 2px ${GREEN_GLOW}` }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIMARY_GREEN }} aria-hidden="true" />
                  System Locked
                </span>
              </div>
            </header>

            <main className="mt-8 sm:mt-9">
              <div className="rounded-xl border border-gray-200/70 bg-white overflow-hidden shadow-md">
                <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${PRIMARY_GREEN} 0%, #84CC16 100%)` }} aria-hidden="true" />

                <div className="px-3 sm:px-5 lg:px-6 py-5 sm:py-6">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarFileChange} />

                  {/* ✅ PHONE ONLY: matches your screenshot, clean alignment */}
                  <div className="sm:hidden max-w-sm mx-auto rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-4 py-4 bg-slate-50 border-b border-slate-200">
                      <div className="text-base font-black text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>
                        Profile picture
                      </div>
                    </div>

                    <div className="p-5 flex flex-col items-center text-center gap-3">
                      <div
                        className={[
                          "group relative",
                          "h-[112px] w-[112px]",
                          "rounded-full p-[2px]",
                          "bg-gradient-to-br from-slate-900 via-slate-700 to-slate-300",
                          "shadow-[0_10px_28px_rgba(15,23,42,0.16)]",
                        ].join(" ")}
                      >
                        <div className="h-full w-full rounded-full bg-white p-[2px]">
                          <div className="relative h-full w-full rounded-full overflow-hidden bg-slate-50">
                            {showAvatarImage ? (
                              <img
                                key={avatarSrc}
                                src={avatarSrc}
                                alt={`${mobilePrimaryLabel} profile`}
                                className="h-full w-full object-cover rounded-full"
                                loading="lazy"
                                onError={handleAvatarError}
                                onLoad={handleAvatarLoad}
                                draggable={false}
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <div className="text-2xl font-black text-slate-800" style={{ fontFamily: "Nunito, sans-serif" }}>
                                  {getInitials(profile.firstName, profile.lastName)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* phone: always visible */}
                        <button
                          type="button"
                          onClick={pickAvatarFile}
                          className={[
                            "absolute bottom-1 right-1",
                            "h-9 w-9 rounded-full",
                            "bg-white border border-slate-200",
                            "shadow-[0_8px_20px_rgba(15,23,42,0.15)]",
                            "flex items-center justify-center",
                            "transition-all duration-200 ease-out",
                            "active:scale-[0.98]",
                            "focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10",
                          ].join(" ")}
                          aria-label="Change profile photo"
                          title="Change profile photo"
                        >
                          <IconCamera className="text-slate-900" />
                        </button>
                      </div>

                      <div className="pt-1">
                        <div className="text-base font-black text-slate-900 break-words" style={{ fontFamily: "Nunito, sans-serif" }}>
                          {mobilePrimaryLabel}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-600" style={{ fontFamily: "Nunito, sans-serif" }}>
                          {profile.roleLabel || "Student"}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-600 break-words" style={{ fontFamily: "Nunito, sans-serif" }}>
                          {safeText(profile.campus)}
                        </div>
                      </div>

                      <div className="w-full pt-2">
                        <AvatarActions pending={Boolean(pendingAvatarFile)} uploading={avatarUploading} onUpload={uploadAvatar} onCancel={cancelAvatarChange} />
                      </div>

                      <div className="w-full pt-1">
                        <AvatarFeedback avatarError={avatarError} avatarSuccess={avatarSuccess} />
                      </div>
                    </div>
                  </div>

                  {/* ✅ DESKTOP/LAPTOP: keep your original layout */}
                  <div
                    className="hidden sm:block rounded-xl border border-gray-200/70 overflow-hidden"
                    style={{
                      background: `linear-gradient(90deg, ${GREEN_SOFT} 0%, rgba(248,250,252,0.9) 55%, #FFFFFF 100%)`,
                    }}
                  >
                    <div className="px-4 sm:px-5 py-4 sm:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={[
                            "group relative rounded-full border border-gray-200 bg-slate-100",
                            "flex items-center justify-center shrink-0 overflow-hidden",
                            "h-24 w-24 lg:h-28 lg:w-28",
                          ].join(" ")}
                          style={{ boxShadow: `0 0 0 4px ${GREEN_GLOW}` }}
                          aria-label="Profile avatar"
                        >
                          {showAvatarImage ? (
                            <img
                              key={avatarSrc}
                              src={avatarSrc}
                              alt={`${displayName} profile`}
                              className="h-full w-full rounded-full object-cover"
                              loading="lazy"
                              onError={handleAvatarError}
                              onLoad={handleAvatarLoad}
                            />
                          ) : (
                            <span className="font-extrabold text-xl" style={{ fontFamily: "Nunito, sans-serif", color: TEXT_MAIN }}>
                              {getInitials(profile.firstName, profile.lastName)}
                            </span>
                          )}

                          <div className="absolute inset-0 rounded-full bg-slate-900/10 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />

                          {/* desktop: hover-only */}
                          <button
                            type="button"
                            onClick={pickAvatarFile}
                            className={[
                              "absolute bottom-2 right-2",
                              "h-10 w-10 rounded-full",
                              "bg-white border border-slate-200",
                              "shadow-[0_8px_20px_rgba(15,23,42,0.15)]",
                              "flex items-center justify-center",
                              "transition-all duration-200 ease-out",
                              "hover:bg-slate-50 active:scale-[0.98]",
                              "focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10",
                              "opacity-0 scale-95 translate-y-1 pointer-events-none",
                              "group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 group-hover:pointer-events-auto",
                              "focus-visible:opacity-100 focus-visible:scale-100 focus-visible:translate-y-0 focus-visible:pointer-events-auto",
                            ].join(" ")}
                            aria-label="Change profile photo"
                            title="Change profile photo"
                          >
                            <IconCamera className="text-slate-900" />
                          </button>
                        </div>

                        <div className="min-w-0">
                          <div className="font-extrabold text-base break-words leading-snug" style={{ fontFamily: "Nunito, sans-serif", color: TEXT_MAIN }}>
                            {displayName}
                          </div>

                          <div className="mt-0.5 text-sm break-all leading-relaxed" style={{ fontFamily: "Lora, serif", color: TEXT_MUTED }}>
                            {safeText(profile.email)}
                          </div>

                          {(profile.roleLabel || profile.campus) && (
                            <div className="mt-1 text-[12px] break-words leading-relaxed" style={{ fontFamily: "Lora, serif", color: TEXT_SOFT }}>
                              {(profile.roleLabel || "Student").toString()}
                              {profile.campus ? ` • ${profile.campus}` : ""}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <AvatarActions pending={Boolean(pendingAvatarFile)} uploading={avatarUploading} onUpload={uploadAvatar} onCancel={cancelAvatarChange} />
                        <div className="w-full max-w-[420px]">
                          <AvatarFeedback avatarError={avatarError} avatarSuccess={avatarSuccess} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    {uiFields.map((field) => (
                      <div key={field.label} className="min-w-0">
                        <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500" style={{ fontFamily: "Nunito, sans-serif" }}>
                          {field.label}
                        </div>

                        <div
                          className={["mt-1.5 rounded-lg border border-gray-200/70 bg-white px-3.5 py-3", "shadow-sm min-w-0"].join(" ")}
                          style={{ background: GREEN_SOFT, boxShadow: `0 0 0 2px rgba(15, 23, 42, 0.02)` }}
                        >
                          <div
                            className={[
                              "text-sm sm:text-[15px] font-extrabold",
                              field.mono ? "font-mono tracking-tight" : "",
                              field.breakAll ? "break-all" : "break-words",
                              field.multiline ? "whitespace-normal" : "truncate",
                            ].join(" ")}
                            style={{ fontFamily: "Nunito, sans-serif", color: TEXT_MAIN }}
                            title={String(field.value || "")}
                          >
                            {field.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </main>

            <div className="mt-8 sm:mt-10 flex justify-center">
              <div
                className="w-full max-w-3xl rounded-xl border border-green-200/50 bg-green-50/20 px-4 sm:px-6 py-5 sm:py-6 shadow-md flex flex-col sm:flex-row gap-4 sm:gap-5 items-start"
                style={{ boxShadow: `0 0 0 4px ${GREEN_GLOW}` }}
                role="region"
              >
                <div
                  className="h-10 w-10 rounded-lg border border-green-200 flex items-center justify-center shrink-0 bg-green-50/40"
                  style={{ boxShadow: `0 0 0 3px ${GREEN_GLOW}` }}
                  aria-hidden="true"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEXT_MAIN} strokeWidth="2">
                    <path d="M7 11V9C7 6.23858 9.23858 4 12 4C14.7614 4 17 6.23858 17 9V11" strokeLinecap="round" />
                    <path
                      d="M6.8 11H17.2C18.1193 11 18.8 11.6807 18.8 12.6V18.4C18.8 19.3193 18.1193 20 17.2 20H6.8C5.88067 20 5.2 19.3193 5.2 18.4V12.6C5.2 11.6807 5.88067 11 6.8 11Z"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <h3 className="font-extrabold text-base sm:text-lg break-words leading-tight" style={{ fontFamily: "Nunito, sans-serif", color: TEXT_MAIN }}>
                    Guidance Office Only
                  </h3>
                  <p className="mt-1.5 text-sm break-words leading-relaxed" style={{ fontFamily: "Lora, serif", color: TEXT_MUTED }}>
                    Report any incorrect information directly to the <strong style={{ color: TEXT_MAIN }}>Guidance Office</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}