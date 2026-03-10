// src/pages/CounselorDashboard/Sections/AccountSettings.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getUser, updateAuthUser } from "../../../utils/auth";
import { apiFetch, getApiBaseUrl } from "../../../api/apiFetch";

const STORAGE_USER_KEY = "user";

/* ===================== STATIC CAMPUS ===================== */
/** ✅ Campus is fixed (non-editable) */
const STATIC_CAMPUS = "Andres Bonifacio Campus";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB (match backend limit)
const AVATAR_SIZE_PX = 256;
const AVATAR_QUALITY = 0.9;

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readUser() {
  if (!canUseStorage()) return {};
  return safeParse(window.localStorage.getItem(STORAGE_USER_KEY), {});
}

function writeUser(value) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(value));
}

function validate(profile) {
  const errors = {};
  if (!String(profile.fullName || "").trim()) errors.fullName = "Required";
  // Campus is fixed, but keep validation guard in case storage/user object is malformed.
  if (!String(profile.campus || "").trim()) errors.campus = "Required";
  return errors;
}

function getInitials(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  const a = parts[0]?.[0] || "U";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (a + b).toUpperCase();
}

function resolveAvatarSrc(src) {
  const s = String(src || "").trim();
  if (!s) return "";
  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  // If backend returns /uploads/..., prefix it with API base (works on Vercel + Render + localhost)
  if (s.startsWith("/uploads/")) {
    const base = getApiBaseUrl();
    return base ? `${base}${s}` : s;
  }

  return s;
}


function validateImageFile(file) {
  if (!file) return "No file selected.";
  if (!String(file.type || "").startsWith("image/")) return "Please select an image file.";
  if (file.size > MAX_AVATAR_BYTES) return "Image is too large (max 2MB).";
  return "";
}

function fileToImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image."));
    };
    img.src = url;
  });
}

/**
 * Resizes and center-crops to a square dataURL.
 */
async function fileToAvatarDataUrl(file, sizePx = AVATAR_SIZE_PX, quality = AVATAR_QUALITY) {
  const img = await fileToImageElement(file);

  const srcW = img.naturalWidth || img.width || 1;
  const srcH = img.naturalHeight || img.height || 1;

  const side = Math.min(srcW, srcH);
  const sx = Math.floor((srcW - side) / 2);
  const sy = Math.floor((srcH - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, sizePx, sizePx);

  return canvas.toDataURL("image/jpeg", quality);
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);

    onChange();

    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

/* ===================== ICONS ===================== */
function IconUser({ className = "" }) {
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
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconBuilding({ className = "" }) {
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
      <path d="M3 21h18" />
      <path d="M6 21V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14" />
      <path d="M9 9h.01M9 12h.01M9 15h.01" />
      <path d="M15 9h.01M15 12h.01M15 15h.01" />
    </svg>
  );
}

function IconMail({ className = "" }) {
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
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function IconId({ className = "" }) {
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
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 10h8" />
      <path d="M8 14h6" />
    </svg>
  );
}

function IconChevronDown({ className = "" }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LockIcon({ className = "" }) {
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
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
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

/* ===================== PAGE ===================== */
export default function AccountSettings() {
  const localUser = useMemo(() => getUser?.() || null, []);
  const storedUser = useMemo(() => readUser(), []);

  const initialSavedProfile = useMemo(() => {
    const avatarDataUrl =
      localUser?.avatarDataUrl ||
      localUser?.avatarUrl ||
      localUser?.photoUrl ||
      storedUser?.avatarDataUrl ||
      storedUser?.avatarUrl ||
      storedUser?.photoUrl ||
      "";

    return {
      fullName: localUser?.fullName || localUser?.name || storedUser?.fullName || storedUser?.name || "",
      email: localUser?.email || storedUser?.email || "",
      counselorId: localUser?.counselorId || storedUser?.counselorId || "",
      // ✅ Campus is forced to static (user cannot edit)
      campus: STATIC_CAMPUS,
      avatarDataUrl,
    };
  }, [localUser, storedUser]);

  const [savedProfile, setSavedProfile] = useState(initialSavedProfile);
  const [draft, setDraft] = useState(initialSavedProfile);

  const msgTimerRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [errors, setErrors] = useState({});

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null); // selected file for upload
  const [avatarError, setAvatarError] = useState("");

  const isXxs = useMediaQuery("(max-width: 360px)");
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    if (isXxs) setAdminOpen(true);
  }, [isXxs]);

  useEffect(() => {
    return () => {
      if (msgTimerRef.current) window.clearTimeout(msgTimerRef.current);
    };
  }, []);

  // ✅ Campus is not editable; don't include it in dirty-check
  const isDirty =
    String(draft.fullName || "").trim() !== String(savedProfile.fullName || "").trim() ||
    String(draft.avatarDataUrl || "") !== String(savedProfile.avatarDataUrl || "");

  const showMsg = (text) => {
    setSavedMsg(text);
    if (msgTimerRef.current) window.clearTimeout(msgTimerRef.current);
    msgTimerRef.current = window.setTimeout(() => setSavedMsg(""), 2500);
  };

  const onPickAvatar = async (file) => {
    setAvatarError("");
    const err = validateImageFile(file);
    if (err) {
      setAvatarError(err);
      return;
    }

    setAvatarBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file, AVATAR_SIZE_PX, AVATAR_QUALITY);
      setAvatarFile(file);
      setDraft((p) => ({ ...p, avatarDataUrl: dataUrl }));
    } catch {
      setAvatarError("Failed to process image.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setSavedMsg("");

    // ✅ Ensure campus always stays the static value
    const safeDraft = { ...draft, campus: STATIC_CAMPUS };

    const nextErrors = validate(safeDraft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      showMsg("Please check the required fields.");
      return;
    }

    if (!isDirty) {
      showMsg("No changes to save.");
      return;
    }

    const role = String(localUser?.role || storedUser?.role || "");
    const isCounselor = /^counselor$/i.test(role);

    setSaving(true);
    try {
      let uploadedAvatarUrl = "";

      // ✅ Upload avatar to backend ONLY if a new file was selected
      if (avatarFile) {
        if (!isCounselor) {
          setAvatarError("Only counselors can upload a profile picture here.");
          throw new Error("Upload not allowed.");
        }

        const fd = new FormData();
        fd.append("avatar", avatarFile);

        const resp = await apiFetch("/api/users/me/counselor/avatar", {
          method: "PUT",
          body: fd,
        });

        uploadedAvatarUrl = resp?.avatarUrl || resp?.user?.avatarUrl || "";
        if (!uploadedAvatarUrl) {
          throw new Error("Upload succeeded but no avatar URL was returned.");
        }

        // Store the server path (e.g. /uploads/avatars/...)
        safeDraft.avatarDataUrl = uploadedAvatarUrl;
      }

      const existing = readUser();
      const nextSaved = { ...existing, ...safeDraft };

      // Keep both keys for compatibility with other UI parts
      if (uploadedAvatarUrl) {
        nextSaved.avatarUrl = uploadedAvatarUrl;
        nextSaved.avatarDataUrl = uploadedAvatarUrl;

        // Update global auth user so Navbar/other UI updates instantly
        updateAuthUser({ avatarUrl: uploadedAvatarUrl });
      }

      writeUser(nextSaved);
      setSavedProfile(safeDraft);
      setDraft(safeDraft);
      setAvatarFile(null);

      showMsg("Saved.");
    } catch (err) {
      showMsg(err?.message || "Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled = saving || !isDirty;

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900">Account Settings</h2>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base font-semibold text-slate-600">Update your profile details.</p>
      </div>

      <form
        onSubmit={onSaveProfile}
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 pb-28 sm:pb-24 xl:pb-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm sm:text-lg font-black text-slate-900"></div>

          <button
            type="submit"
            disabled={saveDisabled}
            className={[
              "hidden xl:inline-flex items-center justify-center rounded-xl border border-slate-200 transition",
              "h-12 px-6 text-base font-black",
              saveDisabled
                ? "bg-slate-200 text-slate-700 cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-slate-800",
            ].join(" ")}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>

        <div className="mt-4 sm:mt-5">
          <AvatarCompact
            fullName={draft.fullName}
            campus={draft.campus}
            avatarDataUrl={resolveAvatarSrc(draft.avatarDataUrl)}
            busy={avatarBusy}
            error={avatarError}
            onPick={onPickAvatar}
            canEdit={/^counselor$/i.test(String((localUser?.role || storedUser?.role || "") || ""))}
          />
        </div>

        <div className="mt-4 sm:mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Field
            label="Full name"
            value={draft.fullName}
            onChange={(v) => {
              setDraft((p) => ({ ...p, fullName: v }));
              setErrors((er) => ({ ...er, fullName: "" }));
            }}
            placeholder="Full name"
            helper="Use your official name."
            error={errors.fullName}
            icon={<IconUser className="text-slate-500" />}
          />

          {/* ✅ Campus is STATIC (no dropdown, no editing) */}
          <Field
            label="Campus"
            value={STATIC_CAMPUS}
            placeholder={STATIC_CAMPUS}
            readOnly
            helper=""
            error={errors.campus}
            icon={<IconBuilding className="text-slate-500" />}
          />
        </div>

        <div className="hidden xl:block mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-base font-black text-slate-900">Admin-managed</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">
                Email and Counselor ID are managed by Admin.
              </div>
            </div>

            <div className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <LockIcon className="text-slate-700" />
              <div className="text-sm font-extrabold text-slate-700">Managed by Admin</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Field
              label="Email"
              value={draft.email}
              placeholder="Set by Admin"
              type="email"
              readOnly
              helper="Contact Admin to update."
              icon={<IconMail className="text-slate-500" />}
            />

            <Field
              label="Counselor ID"
              value={draft.counselorId}
              placeholder="Set by Admin"
              readOnly
              helper="Contact Admin to update."
              icon={<IconId className="text-slate-500" />}
            />
          </div>
        </div>

        <details
          open={adminOpen}
          onToggle={(e) => setAdminOpen(e.currentTarget.open)}
          className="xl:hidden mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 max-[360px]:p-3"
        >
          <summary className="list-none cursor-pointer select-none">
            <div className="flex items-center justify-between gap-3 max-[360px]:items-start max-[360px]:gap-2">
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-900">Admin-managed</div>
                <div className="mt-1 text-xs font-bold text-slate-600">Email &amp; Counselor ID</div>
              </div>

              <div className="shrink-0 inline-flex items-center gap-2 text-slate-700 max-[360px]:gap-1">
                <span className="text-xs font-extrabold max-[360px]:hidden">View</span>
                <IconChevronDown className="text-slate-700" />
              </div>
            </div>
          </summary>

          <div className="mt-4 grid grid-cols-1 gap-4 max-[360px]:gap-3">
            <Field
              label="Email"
              value={draft.email}
              placeholder="Set by Admin"
              type="email"
              readOnly
              helper="Contact Admin to update."
              icon={<IconMail className="text-slate-500" />}
            />

            <Field
              label="Counselor ID"
              value={draft.counselorId}
              placeholder="Set by Admin"
              readOnly
              helper="Contact Admin to update."
              icon={<IconId className="text-slate-500" />}
            />
          </div>
        </details>

        <div className="hidden xl:flex mt-6 items-center justify-between gap-4 flex-wrap">
          <div className="text-sm font-semibold text-slate-700">
            {savedMsg ? <span className="text-slate-900 font-black">{savedMsg}</span> : "Saved on this device."}
          </div>

          <div className="text-sm font-semibold text-slate-600">{isDirty ? "Unsaved changes" : "Up to date"}</div>
        </div>

        <div className="xl:hidden mt-5 -mx-4 sm:-mx-6 px-4 sm:px-6">
          <div className="sticky bottom-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 text-xs font-bold text-slate-600">
                {savedMsg ? savedMsg : isDirty ? "Unsaved changes" : "Up to date"}
              </div>

              <button
                type="submit"
                disabled={saveDisabled}
                className={[
                  "w-full inline-flex items-center justify-center rounded-xl border border-slate-200 transition",
                  "h-12 px-6 text-base font-black",
                  saveDisabled
                    ? "bg-slate-200 text-slate-700 cursor-not-allowed"
                    : "bg-slate-900 text-white hover:bg-slate-800",
                ].join(" ")}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

/* ===================== AVATAR (shows SAVED only) ===================== */
function AvatarCompact({ fullName, campus, avatarDataUrl, busy, error, onPick, canEdit = true }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const initials = getInitials(fullName);
  const displayName = String(fullName || "").trim() || "—";
  const campusText = String(campus || "").trim() || "—";

  const openPicker = () => {
    if (busy || !canEdit) return;
    inputRef.current?.click?.();
  };

  const handleFile = (file) => {
    if (!file || busy || !canEdit) return;
    onPick?.(file);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 sm:px-5 py-4 bg-slate-50 border-b border-slate-200">
        <div className="text-base sm:text-lg font-black text-slate-900">Profile picture</div>
      </div>

      <div className="p-4 sm:p-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={!canEdit}
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            handleFile(file);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />

        <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left gap-4 sm:gap-5">
          <div
            className={[
              "group relative",
              "h-[104px] w-[104px] sm:h-[112px] sm:w-[112px]",
              "rounded-full p-[2px]",
              "bg-gradient-to-br from-slate-900 via-slate-700 to-slate-300",
              "shadow-[0_10px_28px_rgba(15,23,42,0.16)]",
              "transition-transform duration-150",
              busy ? "opacity-80" : "hover:scale-[1.01]",
              dragOver ? "ring-4 ring-slate-900/10" : "",
              "mx-auto sm:mx-0",
            ].join(" ")}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              const file = e.dataTransfer?.files?.[0] || null;
              handleFile(file);
            }}
          >
            <div className="h-full w-full rounded-full bg-white p-[2px]">
              <div className="relative h-full w-full rounded-full overflow-hidden bg-slate-50">
                {avatarDataUrl ? (
                  <img
                    src={avatarDataUrl}
                    alt="Profile"
                    className="h-full w-full object-cover rounded-full"
                    draggable={false}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="text-2xl font-black text-slate-800">{initials}</div>
                  </div>
                )}

                <div className="absolute inset-0 rounded-full bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <button
              type="button"
              disabled={busy || !canEdit}
              onClick={openPicker}
              className={[
                "absolute bottom-1 right-1",
                "h-9 w-9 rounded-full",
                "bg-white border border-slate-200",
                "shadow-[0_8px_20px_rgba(15,23,42,0.15)]",
                "flex items-center justify-center",
                "transition-all duration-200 ease-out",
                busy ? "cursor-not-allowed opacity-60" : "hover:bg-slate-50",
                "xl:opacity-0 xl:pointer-events-none xl:translate-y-1 xl:scale-95",
                "xl:group-hover:opacity-100 xl:group-hover:pointer-events-auto xl:group-hover:translate-y-0 xl:group-hover:scale-100",
                "focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10",
              ].join(" ")}
              aria-label="Change profile picture"
              title="Change profile picture"
            >
              <IconCamera className="text-slate-900" />
            </button>

            {busy ? (
              <div className="absolute inset-0 rounded-full bg-white/65 flex items-center justify-center">
                <div className="text-[11px] font-black text-slate-800">Processing…</div>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex flex-col items-center sm:items-start">
            <div className="text-base sm:text-lg font-black text-slate-900 break-words">{displayName}</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">Guidance Counselor</div>
            <div className="mt-1 text-sm font-semibold text-slate-600 break-words">{campusText}</div>
            {error ? <div className="mt-2 text-sm font-extrabold text-red-700">{error}</div> : null}
            {!canEdit ? (
              <div className="mt-2 text-xs font-extrabold text-slate-600">
                Only counselors can change the profile picture here.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== CONTROLS ===================== */
function Field({ label, value, onChange, placeholder, type = "text", readOnly = false, helper, error, icon }) {
  const hasError = Boolean(error);
  const helperId = helper ? `${label.replace(/\s+/g, "-").toLowerCase()}-help` : undefined;

  return (
    <label className="block">
      <div className="flex items-end justify-between gap-3">
        <div className="text-sm font-extrabold text-slate-800">{label}</div>
        {hasError ? <div className="text-xs font-black text-red-700">{error}</div> : null}
      </div>

      <div
        className={[
          "mt-2 flex items-center gap-2 rounded-xl border px-3 max-[360px]:px-2",
          "min-h-12 h-12 max-[360px]:h-auto max-[360px]:py-2 max-[360px]:items-start",
          readOnly ? "bg-slate-100" : "bg-white",
          hasError
            ? "border-red-200 focus-within:ring-4 focus-within:ring-red-50"
            : "border-slate-200 focus-within:ring-4 focus-within:ring-slate-900/10",
        ].join(" ")}
      >
        {icon ? <span className="shrink-0 mt-[1px]">{icon}</span> : null}
        <input
          type={type}
          value={value}
          onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          aria-readonly={readOnly}
          aria-invalid={hasError}
          aria-describedby={helperId}
          className={[
            "w-full bg-transparent outline-none",
            "text-[15px] sm:text-base font-semibold leading-snug",
            readOnly ? "text-slate-900 cursor-not-allowed" : "text-slate-900",
            "placeholder:text-slate-500",
          ].join(" ")}
        />
      </div>

      {helper ? (
        <div id={helperId} className="mt-2 text-xs font-semibold text-slate-600">
          {helper}
        </div>
      ) : null}
    </label>
  );
}
