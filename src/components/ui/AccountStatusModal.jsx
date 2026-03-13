import { useEffect } from "react";
import { createPortal } from "react-dom";

function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

export default function AccountStatusModal({ open, status = "pending", onClose }) {
  useLockBodyScroll(open);

  if (!open) return null;

  const s = String(status || "").toLowerCase();

  const title = s === "terminated" ? "Account is terminated" : "Account is pending";
  const message =
    s === "terminated"
      ? "Account is terminated. Please contact the guidance office for further clarifications."
      : "Account is pending. Please contact the guidance office for further clarifications.";

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onClose?.()}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="p-5 sm:p-6">
          <div className="text-[18px] sm:text-[20px] font-extrabold text-slate-900">{title}</div>
          <div className="mt-2 text-[14px] sm:text-[15px] font-bold text-slate-600 leading-relaxed">{message}</div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="h-[42px] px-4 rounded-xl bg-slate-900 text-white text-[14px] font-extrabold border border-slate-900 hover:bg-slate-800 transition"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
