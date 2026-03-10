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

export default function LoginRequiredModal({
  open,
  onClose,
  onLogin,
  featureName = "this feature",
  title = "LOGIN REQUIRED",
  titleId = "login-required-title",
}) {
  return (
    <AppModal open={open} onClose={onClose} titleId={titleId} maxWidthClass="max-w-[640px]">
      <div className="p-5 sm:p-6 border-b border-black/10">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-[14px] border-2 border-black bg-[#B9FF66]/70 flex items-center justify-center">
            <LockIcon className="h-5 w-5 text-black" />
          </div>

          <div>
            <h2 id={titleId} className="text-[18px] sm:text-[20px] font-extrabold tracking-[0.12em]">
              {title}
            </h2>
            <p className="text-[13px] text-black/70 mt-2">
              Please log in to access <span className="font-extrabold">{featureName}</span>.
            </p>
            <p className="text-[12px] text-black/55 mt-2">
              Your activity and progress are saved only when you’re signed in.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 text-[13px] font-extrabold rounded-[12px] border-2 border-black bg-white hover:bg-black/5
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
        >
          Not now
        </button>

        <button
          type="button"
          onClick={onLogin}
          className="px-5 py-2 text-[13px] font-extrabold rounded-[12px] border-2 border-black bg-black text-white
                     hover:opacity-90 active:scale-[0.99]
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
        >
          Login
        </button>
      </div>
    </AppModal>
  );
}
