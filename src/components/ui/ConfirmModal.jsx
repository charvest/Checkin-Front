// src/components/ui/ConfirmModal.jsx
import AppModal from "./AppModal";

function Spinner({ size = 16 }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/**
 * ConfirmModal
 * - consistent with your TermsModal styling
 * - use as "alert" by hiding cancel and using one button
 */
export default function ConfirmModal({
  open,
  onClose,
  title = "NOTICE",
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  loading = false,
  hideCancel = false,
  titleId = "confirm-modal-title",
}) {
  return (
    <AppModal open={open} onClose={onClose} disableClose={loading} titleId={titleId} maxWidthClass="max-w-[620px]">
      <div className="p-5 sm:p-6 border-b border-black/10">
        <h2 id={titleId} className="text-[18px] sm:text-[20px] font-extrabold tracking-[0.12em]">
          {title}
        </h2>
        {message ? <p className="text-[13px] text-black/70 mt-2 leading-relaxed">{message}</p> : null}
      </div>

      <div className="p-5 sm:p-6 flex items-center justify-end gap-3">
        {!hideCancel && (
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2 text-[13px] font-extrabold rounded-[12px] border-2 border-black bg-white hover:bg-black/5
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 disabled:opacity-60"
          >
            {cancelText}
          </button>
        )}

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="px-5 py-2 text-[13px] font-extrabold rounded-[12px] border-2 border-black bg-black text-white
                     hover:opacity-90 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 disabled:opacity-60
                     flex items-center gap-2"
        >
          {loading ? (
            <>
              <Spinner />
              Working…
            </>
          ) : (
            confirmText
          )}
        </button>
      </div>
    </AppModal>
  );
}
