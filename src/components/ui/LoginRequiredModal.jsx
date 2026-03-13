import AppModal from "./AppModal";

function LockIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M7.5 10V8.2C7.5 5.6 9.6 3.5 12.2 3.5c2.6 0 4.7 2.1 4.7 4.7V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.7 10h10.6c.9 0 1.7.8 1.7 1.7v7.2c0 .9-.8 1.7-1.7 1.7H6.7c-.9 0-1.7-.8-1.7-1.7v-7.2c0-.9.8-1.7 1.7-1.7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M12 14v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * LoginRequiredModal
 * ✅ Reusable for:
 * - login-required blocks
 * - account pending blocks
 * - account disabled blocks
 *
 * Keeps the same UI design, but lets you override text/actions.
 */
export default function LoginRequiredModal({
  open,
  onClose,

  // Legacy props (still supported)
  onLogin,
  featureName = "this feature",

  // Content
  title = "LOGIN REQUIRED",
  titleId = "login-required-title",
  description,
  subtext,
  asideContent,

  // Buttons
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  hideSecondary = false,
}) {
  const resolvedDescription =
    description ?? (
      <>
        Please log in to access <span className="font-extrabold">{featureName}</span>.
      </>
    );

  const resolvedSubtext =
    subtext ??
    "Your activity and progress are saved only when you’re signed in.";

  const primaryText = primaryLabel ?? (onLogin ? "Login" : "Okay");
  const secondaryText = secondaryLabel ?? "Not now";

  const handlePrimary = onPrimary ?? onLogin ?? onClose;
  const handleSecondary = onSecondary ?? onClose;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      titleId={titleId}
      maxWidthClass={asideContent ? "max-w-[760px]" : "max-w-[640px]"}
    >
      <div className="p-5 sm:p-6 border-b border-black/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex items-start gap-3">
            <div className="h-10 w-10 rounded-[14px] border-2 border-black bg-[#B9FF66]/70 flex items-center justify-center shrink-0">
              <LockIcon className="h-5 w-5 text-black" />
            </div>

            <div className="min-w-0">
              <h2 id={titleId} className="text-[18px] sm:text-[20px] font-extrabold tracking-[0.12em]">
                {title}
              </h2>

              <div className="text-[13px] text-black/70 mt-2 leading-relaxed">
                {resolvedDescription}
              </div>

              {resolvedSubtext ? (
                <p className="text-[12px] text-black/55 mt-2">
                  {resolvedSubtext}
                </p>
              ) : null}
            </div>
          </div>

          {asideContent ? <div className="sm:pl-3">{asideContent}</div> : null}
        </div>
      </div>

      <div className="p-5 sm:p-6 flex items-center justify-end gap-3">
        {!hideSecondary ? (
          <button
            type="button"
            onClick={handleSecondary}
            className="px-5 py-2 text-[13px] font-extrabold rounded-[12px] border-2 border-black bg-white hover:bg-black/5
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
          >
            {secondaryText}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handlePrimary}
          className="px-5 py-2 text-[13px] font-extrabold rounded-[12px] border-2 border-black bg-black text-white
                     hover:opacity-90 active:scale-[0.99]
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
        >
          {primaryText}
        </button>
      </div>
    </AppModal>
  );
}
