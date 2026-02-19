// src/pages/CounselorDashboard/Components/PasswordPromptModal.jsx
import { useEffect, useState } from "react";
import Modal from "./Modal";

export default function PasswordPromptModal({
  open,
  title = "Enter counselor password",
  onClose,
  onConfirm,
  helperText = "For privacy, identity access requires password verification.",
  confirmLabel = "Unlock",
}) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setPwd("");
      setErr("");
    }
  }, [open]);

  const submit = async () => {
    const value = pwd.trim();
    if (!value) {
      setErr("Password is required.");
      return;
    }
    try {
      const ok = await onConfirm?.(value);
      if (!ok) {
        setErr("Incorrect password.");
        return;
      }
      onClose?.();
    } catch {
      setErr("Verification failed. Try again.");
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose} width={520}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#475569" }}>
          {helperText}
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
            Password
          </div>
          <input
            type="password"
            value={pwd}
            onChange={(e) => {
              setPwd(e.target.value);
              setErr("");
            }}
            placeholder="••••••••"
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
              if (e.key === "Enter") submit();
            }}
          />
        </label>

        {err ? (
          <div style={{ fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>
            {err}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={() => onClose?.()}
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
            onClick={submit}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "#0f172a",
              color: "#fff",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 900,
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
