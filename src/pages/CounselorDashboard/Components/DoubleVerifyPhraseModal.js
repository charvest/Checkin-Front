// src/pages/CounselorDashboard/Components/DoubleVerifyPhraseModal.jsx
import { useEffect, useState } from "react";
import Modal from "./Modal";

export default function DoubleVerifyPhraseModal({
  open,
  onClose,
  onConfirm,
  phrase,
  title = "Double Verification",
  warningLine1 = "Are you sure you want to Delete this Account",
  warningLine2 = "if yes it will be gone forever",
  confirmLabel = "Confirm",
}) {
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setTyped("");
      setErr("");
    }
  }, [open]);

  const handleConfirm = async () => {
    const input = typed.trim();

    if (!input) {
      setErr("Please type the phrase to continue.");
      return;
    }

    if (input !== phrase) {
      setErr("Phrase does not match. Please type it exactly.");
      return;
    }

    setErr("");

    try {
      await onConfirm?.();
    } finally {
      onClose?.();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} width={560}>
      <div style={{ display: "grid", gap: 12 }}>
        {/* Warning */}
        <div style={{ fontSize: 14, fontWeight: 1000, color: "#7f1d1d" }}>
          {warningLine1}
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#b91c1c" }}>
          {warningLine2}
        </div>

        {/* Phrase instruction */}
        <div style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
          Type this exact phrase to confirm:
        </div>

        {/* Phrase box */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: 12,
            padding: "10px 12px",
            background: "#f8fafc",
            fontSize: 13,
            fontWeight: 900,
            color: "#0f172a",
            userSelect: "text",
          }}
        >
          {phrase}
        </div>

        {/* Input */}
        <input
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setErr("");
          }}
          placeholder="Type the phrase exactly..."
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            padding: "10px 12px",
            fontSize: 14,
            fontWeight: 800,
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
          }}
        />

        {/* Error */}
        {err ? (
          <div style={{ fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>
            {err}
          </div>
        ) : null}

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "#fff",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "#dc2626",
              color: "#fff",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 1000,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
