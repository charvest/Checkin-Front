import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/apiFetch";
import { updateAuthUser, useAuth } from "../utils/auth";
import LoginRequiredModal from "../components/ui/LoginRequiredModal";

const MSG_PENDING =
  "account is pending please contact the guidance office for further clarifications";
const MSG_DISABLED =
  "account is disabled please contact the guidance office for further clarifications";

const VERIFICATION_LINK = "https://forms.gle/P8eLmEFaU2oqCsZP6";
const VERIFICATION_QR_SRC = "data:image/png;base64,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";

const PENDING_DESCRIPTION = (
  <>
    Your account is pending. To complete verification and activate your account,
    please contact the Guidance Office or{" "}
    <a
      href={VERIFICATION_LINK}
      target="_blank"
      rel="noreferrer"
      className="font-extrabold text-black underline underline-offset-2 hover:opacity-80"
    >
      verify your identity through this form
    </a>
    .
  </>
);

const PENDING_ASIDE = (
  <div className="w-full sm:w-[124px] shrink-0">
    <a
      href={VERIFICATION_LINK}
      target="_blank"
      rel="noreferrer"
      className="group block rounded-[16px] border border-black/10 bg-[#F7FBEF] p-2 hover:border-black/20"
      aria-label="Open student verification form"
      title="Open student verification form"
    >
      <img
        src={VERIFICATION_QR_SRC}
        alt="QR code for the student verification form"
        className="mx-auto h-[88px] w-[88px] rounded-[10px] bg-white object-contain"
      />
      <p className="mt-2 text-center text-[11px] font-bold leading-snug text-black/70">
        Scan to verify
      </p>
    </a>
  </div>
);

function normalizeStatus(value) {
  const raw = String(value || "active").trim().toLowerCase();
  if (raw === "terminated") return "disabled"; // legacy compatibility
  return raw || "active";
}

export default function RequireLoginModal({ featureName = "this feature" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthed, user } = useAuth();

  const [open, setOpen] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [resolvedStatus, setResolvedStatus] = useState(() => normalizeStatus(user?.status));

  const fromPath = useMemo(() => location.pathname, [location.pathname]);

  const role = String(user?.role || "").trim().toLowerCase();
  const isStudent = role === "student";

  useEffect(() => {
    setResolvedStatus(normalizeStatus(user?.status));
  }, [user?.status]);

  useEffect(() => {
    let cancelled = false;

    async function syncStudentStatus() {
      if (!isAuthed || !isStudent) {
        setIsCheckingStatus(false);
        return;
      }

      setIsCheckingStatus(true);
      try {
        const me = await apiFetch("/api/users/me");
        if (cancelled) return;

        const freshStatus = normalizeStatus(me?.status);
        setResolvedStatus(freshStatus);

        if (freshStatus !== normalizeStatus(user?.status)) {
          updateAuthUser({ status: freshStatus });
        }
      } catch {
        if (cancelled) return;
        setResolvedStatus(normalizeStatus(user?.status));
      } finally {
        if (!cancelled) setIsCheckingStatus(false);
      }
    }

    syncStudentStatus();
    return () => {
      cancelled = true;
    };
  }, [isAuthed, isStudent, user?._id, user?.id, user?.status]);

  const status = normalizeStatus(resolvedStatus);
  const isBlocked = isAuthed && isStudent && (status === "pending" || status === "disabled");

  useEffect(() => {
    if (!isAuthed) setOpen(true);
    else if (isCheckingStatus && isStudent) setOpen(false);
    else if (isBlocked) setOpen(true);
    else setOpen(false);
  }, [isAuthed, isBlocked, isCheckingStatus, isStudent]);

  if (isAuthed && !isStudent) return <Outlet />;

  // Prevent flashing the protected page while we verify the student's latest status from the DB.
  if (isAuthed && isStudent && isCheckingStatus) {
    return null;
  }

  // ✅ Allowed if logged in AND not blocked
  if (isAuthed && !isBlocked) return <Outlet />;

  const isLoginBlock = !isAuthed;
  const isPendingBlock = status === "pending";

  return (
    <LoginRequiredModal
      open={open}
      featureName={featureName}
      title={isLoginBlock ? "LOGIN REQUIRED" : isPendingBlock ? "ACCOUNT PENDING" : "ACCOUNT DISABLED"}
      description={
        isLoginBlock
          ? undefined
          : isPendingBlock
            ? PENDING_DESCRIPTION
            : MSG_DISABLED
      }
      subtext={isLoginBlock ? undefined : null}
      asideContent={isPendingBlock ? PENDING_ASIDE : null}
      hideSecondary={!isLoginBlock}
      primaryLabel={isLoginBlock ? "Login" : "Okay"}
      secondaryLabel="Not now"
      onClose={() => {
        setOpen(false);
        navigate("/", { replace: true });
      }}
      onPrimary={() => {
        setOpen(false);
        if (isLoginBlock) {
          navigate("/login", { replace: true, state: { from: fromPath } });
        } else {
          navigate("/", { replace: true });
        }
      }}
      onSecondary={() => {
        setOpen(false);
        navigate("/", { replace: true });
      }}
    />
  );
}
