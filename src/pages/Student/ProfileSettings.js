// frontend/src/pages/Student/ProfileSettings.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../../utils/auth";

const PRIMARY_GREEN = "#B9FF66";
const GREEN_GLOW = "rgba(185, 255, 102, 0.22)";
const GREEN_SOFT = "rgba(185, 255, 102, 0.08)";

const TEXT_MAIN = "#0F172A";
const TEXT_MUTED = "#475569";
const TEXT_SOFT = "#64748B";

const DEFAULT_CAMPUS = "Arellano University Andres Bonifacio Campus";

const EMPTY_PROFILE = {
  firstName: "",
  lastName: "",
  studentNumber: "",
  email: "",
  campus: "",
  course: "",
  accountCreation: "",
  avatarUrl: "",
  roleLabel: "",
};

const SECTIONS = [
  {
    title: "Student Details",
    subtitle: "Personal information",
    items: [
      { label: "First Name", key: "firstName" },
      { label: "Last Name", key: "lastName" },
      {
        label: "Student Number",
        key: "studentNumber",
        mono: true,
        breakAll: true,
      },
      { label: "Email", key: "email", breakAll: true },
      {
        label: "Account Creation",
        key: "accountCreation",
        mono: true,
        breakAll: true,
      },
    ],
  },
  {
    title: "Academic Info",
    subtitle: "Campus & program",
    items: [
      { label: "Campus", key: "campus" },
      { label: "Course", key: "course", multiline: true, clampOnSmall: true },
    ],
  },
];

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
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/* ======================
   API BASE (Local + Render)
   - Uses REACT_APP_API_URL (ex: http://localhost:5000 or https://checkin-backend-4xic.onrender.com)
   - Falls back to relative /api/* for local CRA proxy setups
====================== */
const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");

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

/** Fetch the current user's profile from backend (JWT in Authorization header) */
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

      if (res.status === 401 || res.status === 403) {
        throw new Error("Not authorized");
      }

      if (!res.ok) {
        const msg = (
          data?.message ||
          raw ||
          "Failed to load profile."
        ).toString();
        throw new Error(msg);
      }

      // Some APIs return { user: {...} } — unwrap safely
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
  const uLower = String(username || "")
    .trim()
    .toLowerCase();
  const emailPrefix = String(email || "")
    .split("@")[0]
    ?.trim()
    .toLowerCase();

  // Exact match with username or email prefix = likely handle
  if (uLower && nLower === uLower) return true;
  if (emailPrefix && nLower === emailPrefix) return true;

  // No spaces + has digits = likely not a real first name
  if (!/\s/.test(n) && /\d/.test(n)) return true;

  return false;
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

  useEffect(() => {
    // Cleanup preview object URL
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const pickAvatarFile = () => {
    setAvatarError("");
    setAvatarSuccess("");
    fileInputRef.current?.click();
  };

  const onAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError("");
    setAvatarSuccess("");

    if (!file.type?.startsWith("image/")) {
      setAvatarError("Please select an image file (JPG/PNG/WebP).");
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
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

    const form = new FormData();
    // Support common backend field names
    form.append("avatar", pendingAvatarFile);
    form.append("file", pendingAvatarFile);

    const urls = [
      API_BASE ? `${API_BASE}/api/users/me/avatar` : "/api/users/me/avatar",
      API_BASE ? `${API_BASE}/api/users/avatar` : "/api/users/avatar",
      API_BASE ? `${API_BASE}/api/profile/avatar` : "/api/profile/avatar",
      API_BASE ? `${API_BASE}/api/auth/avatar` : "/api/auth/avatar",
    ];

    let lastErr = null;

    for (const url of urls) {
      for (const method of ["PUT", "POST"]) {
        try {
          const { res, data, raw } = await fetchJsonSafe(url, {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            body: form,
          });

          if (res.status === 404) continue;

          if (res.status === 401 || res.status === 403) {
            navigate("/login", { replace: true });
            return;
          }

          if (!res.ok) {
            const msg = (
              data?.message ||
              raw ||
              "Failed to upload photo."
            ).toString();
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

          setProfile((prev) => ({
            ...prev,
            avatarUrl: String(
              newAvatar || prev.avatarUrl || avatarPreviewUrl,
            ).trim(),
          }));

          setAvatarSuccess("Profile photo updated.");
          setPendingAvatarFile(null);

          // Keep preview if backend doesn't return a URL, else clear it.
          if (newAvatar) {
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
            setAvatarPreviewUrl("");
          }

          if (fileInputRef.current) fileInputRef.current.value = "";
          setAvatarUploading(false);
          return;
        } catch (err) {
          lastErr = err;
        }
      }
    }

    setAvatarUploading(false);
    setAvatarError(lastErr?.message || "Failed to upload photo.");
  };

  useEffect(() => {
    // If token missing, redirect
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

        // Fallback from fullName only when it looks like a real "First Last"
        const split = splitName(backendFull);
        let firstName = backendFirst || split.firstName || "";
        let lastName = backendLast || split.lastName || "";

        // If the backend sends an email-handle/username as "firstName" (common with older records),
        // don't show it as a real name.
        const firstLooksHandle = looksLikeHandle(
          firstName,
          backendUsername,
          backendEmail,
        );
        const fullLooksHandle = looksLikeHandle(
          backendFull,
          backendUsername,
          backendEmail,
        );

        // Case A: first/last missing and computed from fullName, but fullName is a handle
        if (!backendFirst && !backendLast && firstLooksHandle && !lastName) {
          firstName = "";
          lastName = "";
        }

        // Case B: backendFirst exists but is actually a handle and last name is missing
        if (backendFirst && firstLooksHandle && !backendLast) {
          // If fullName is a proper spaced name, split it instead
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

        const roleLabel = String(
          p?.roleLabel ||
            p?.role ||
            p?.userRole ||
            p?.accountType ||
            p?.type ||
            "Student",
        )
          .replace(/_/g, " ")
          .trim();

        setProfile({
          firstName,
          lastName,
          studentNumber: p?.studentNumber || "",
          email: backendEmail || "",
          campus,
          course: (p?.course || "").trim(),
          accountCreation: formatDate(
            p?.accountCreation || p?.createdAt || p?.created_on || "",
          ),
          avatarUrl,
          roleLabel,
        });
      } catch (e) {
        if (!alive) return;

        const msg = e?.message || "Failed to load profile";

        // If auth error, push to login
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

  const resolved = useMemo(() => {
    const data = profile || EMPTY_PROFILE;
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.map((it) => ({
        ...it,
        value: safeText(data[it.key]),
      })),
    }));
  }, [profile]);

  const displayName = useMemo(() => {
    const full = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return full || "—";
  }, [profile.firstName, profile.lastName]);

  const uiFields = useMemo(() => {
    return [
      { label: "Full Name", value: displayName },
      {
        label: "Student Number",
        value: safeText(profile.studentNumber),
        mono: true,
      },
      { label: "Email", value: safeText(profile.email), breakAll: true },
      { label: "Campus", value: safeText(profile.campus) },
      { label: "Course", value: safeText(profile.course), multiline: true },
      {
        label: "Account Creation",
        value: safeText(profile.accountCreation),
        mono: true,
      },
    ];
  }, [displayName, profile]);
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
        <div
          className="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-xl"
          role="region"
          aria-labelledby="profile-settings-title"
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ boxShadow: `0 0 0 6px ${GREEN_GLOW}` }}
            aria-hidden="true"
          />

          <div className="relative px-4 sm:px-7 lg:px-9 py-7 sm:py-9">
            <header className="max-w-3xl mx-auto sm:mx-0 text-center sm:text-left">
              <h1
                id="profile-settings-title"
                className="font-extrabold tracking-tight text-2xl sm:text-3xl lg:text-[34px] break-words leading-tight"
                style={{ fontFamily: "Nunito, sans-serif", color: TEXT_MAIN }}
              >
                Profile Settings
              </h1>

              <p
                className="mt-2.5 text-sm sm:text-base text-gray-600 break-words leading-relaxed"
                style={{ fontFamily: "Lora, serif", color: TEXT_MUTED }}
              >
                This information is{" "}
                <strong style={{ color: TEXT_MAIN }}>read-only</strong>.
                Corrections must be requested via the{" "}
                <strong style={{ color: TEXT_MAIN }}>Guidance Office</strong>.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 justify-center sm:justify-start">
                {loading && (
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-green-200/70 bg-green-50/60 px-3.5 py-1.5 text-xs sm:text-sm font-extrabold text-gray-700 whitespace-nowrap"
                    style={{
                      fontFamily: "Nunito, sans-serif",
                      boxShadow: `0 0 0 2px ${GREEN_GLOW}`,
                    }}
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
                  style={{
                    fontFamily: "Nunito, sans-serif",
                    boxShadow: `0 0 0 2px ${GREEN_GLOW}`,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PRIMARY_GREEN }}
                    aria-hidden="true"
                  />
                  System Locked
                </span>
              </div>
            </header>

            <main className="mt-8 sm:mt-9">
              <div className="rounded-xl border border-gray-200/70 bg-white overflow-hidden shadow-md">
                <div
                  className="h-1.5"
                  style={{
                    background: `linear-gradient(90deg, ${PRIMARY_GREEN} 0%, #84CC16 100%)`,
                  }}
                  aria-hidden="true"
                />

                <div className="px-3 sm:px-5 lg:px-6 py-5 sm:py-6">
                  {/* Profile header (avatar + name/email + edit button) */}
                  <div
                    className="rounded-xl border border-gray-200/70 overflow-hidden"
                    style={{
                      background: `linear-gradient(90deg, ${GREEN_SOFT} 0%, rgba(248,250,252,0.9) 55%, #FFFFFF 100%)`,
                    }}
                  >
                    <div className="px-4 sm:px-5 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div
                          className="relative h-14 w-14 rounded-full border border-gray-200 bg-slate-100 flex items-center justify-center shrink-0"
                          style={{ boxShadow: `0 0 0 3px ${GREEN_GLOW}` }}
                          aria-label="Profile avatar"
                        >
                          {avatarPreviewUrl || profile.avatarUrl ? (
                            <img
                              src={avatarPreviewUrl || profile.avatarUrl}
                              alt={`${displayName} profile`}
                              className="h-full w-full rounded-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span
                              className="text-base font-extrabold"
                              style={{
                                fontFamily: "Nunito, sans-serif",
                                color: TEXT_MAIN,
                              }}
                            >
                              {getInitials(profile.firstName, profile.lastName)}
                            </span>
                          )}

                          {/* small camera button */}
                          <button
                            type="button"
                            onClick={pickAvatarFile}
                            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center hover:bg-slate-50 active:scale-[0.98]"
                            aria-label="Change profile photo"
                          >
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M12 5l1.6 2H18a3 3 0 013 3v7a3 3 0 01-3 3H6a3 3 0 01-3-3v-7a3 3 0 013-3h4.4L12 5z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M12 18a4 4 0 100-8 4 4 0 000 8z"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                            </svg>
                          </button>

                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={onAvatarFileChange}
                          />
                        </div>

                        <div className="min-w-0">
                          <div
                            className="font-extrabold text-[15px] sm:text-base break-words leading-snug"
                            style={{
                              fontFamily: "Nunito, sans-serif",
                              color: TEXT_MAIN,
                            }}
                          >
                            {displayName}
                          </div>

                          <div
                            className="mt-0.5 text-xs sm:text-sm break-all leading-relaxed"
                            style={{
                              fontFamily: "Lora, serif",
                              color: TEXT_MUTED,
                            }}
                          >
                            {safeText(profile.email)}
                          </div>

                          {(profile.roleLabel || profile.campus) && (
                            <div
                              className="mt-1 text-[12px] break-words leading-relaxed"
                              style={{
                                fontFamily: "Lora, serif",
                                color: TEXT_SOFT,
                              }}
                            >
                              {(profile.roleLabel || "Student").toString()}
                              {profile.campus ? ` • ${profile.campus}` : ""}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:justify-end">
                        {pendingAvatarFile && (
                          <>
                            <button
                              type="button"
                              onClick={uploadAvatar}
                              className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-xs sm:text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                              style={{ fontFamily: "Nunito, sans-serif" }}
                              disabled={avatarUploading}
                            >
                              {avatarUploading ? <Spinner size={14} /> : null}
                              Upload
                            </button>

                            <button
                              type="button"
                              onClick={cancelAvatarChange}
                              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-gray-700 hover:bg-slate-50"
                              style={{ fontFamily: "Nunito, sans-serif" }}
                              disabled={avatarUploading}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {(avatarError || avatarSuccess) && (
                      <div
                        className="px-4 sm:px-5 pb-4"
                        style={{ fontFamily: "Nunito, sans-serif" }}
                        role={avatarError ? "alert" : "status"}
                      >
                        {avatarError ? (
                          <div className="rounded-[14px] border-2 border-black bg-red-50 px-4 py-3 text-[13px] text-black">
                            <span className="font-extrabold">Photo:</span>{" "}
                            {avatarError}
                          </div>
                        ) : (
                          <div className="rounded-[14px] border border-green-200/70 bg-green-50/60 px-4 py-3 text-[13px] text-gray-800">
                            <span className="font-extrabold">Photo:</span>{" "}
                            {avatarSuccess}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Form-like read-only fields */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    {uiFields.map((field) => (
                      <div key={field.label} className="min-w-0">
                        <div
                          className="text-xs font-extrabold uppercase tracking-wide text-gray-500"
                          style={{ fontFamily: "Nunito, sans-serif" }}
                        >
                          {field.label}
                        </div>

                        <div
                          className={[
                            "mt-1.5 rounded-lg border border-gray-200/70 bg-white px-3.5 py-3",
                            "shadow-sm min-w-0",
                          ].join(" ")}
                          style={{
                            background: GREEN_SOFT,
                            boxShadow: `0 0 0 2px rgba(15, 23, 42, 0.02)`,
                          }}
                        >
                          <div
                            className={[
                              "text-sm sm:text-[15px] font-extrabold",
                              field.mono ? "font-mono tracking-tight" : "",
                              field.breakAll ? "break-all" : "break-words",
                              field.multiline
                                ? "whitespace-normal"
                                : "truncate",
                            ].join(" ")}
                            style={{
                              fontFamily: "Nunito, sans-serif",
                              color: TEXT_MAIN,
                            }}
                            title={String(field.value || "")}
                          >
                            {field.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Keep your original section view as fallback if you want later:
                      - removed to match the requested "form-like" UI */}
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
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={TEXT_MAIN}
                    strokeWidth="2"
                  >
                    <path
                      d="M7 11V9C7 6.23858 9.23858 4 12 4C14.7614 4 17 6.23858 17 9V11"
                      strokeLinecap="round"
                    />
                    <path
                      d="M6.8 11H17.2C18.1193 11 18.8 11.6807 18.8 12.6V18.4C18.8 19.3193 18.1193 20 17.2 20H6.8C5.88067 20 5.2 19.3193 5.2 18.4V12.6C5.2 11.6807 5.88067 11 6.8 11Z"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <h3
                    className="font-extrabold text-base sm:text-lg break-words leading-tight"
                    style={{
                      fontFamily: "Nunito, sans-serif",
                      color: TEXT_MAIN,
                    }}
                  >
                    Guidance Office Only
                  </h3>
                  <p
                    className="mt-1.5 text-sm break-words leading-relaxed"
                    style={{ fontFamily: "Lora, serif", color: TEXT_MUTED }}
                  >
                    Report any incorrect information directly to the{" "}
                    <strong style={{ color: TEXT_MAIN }}>
                      Guidance Office
                    </strong>
                    .
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
