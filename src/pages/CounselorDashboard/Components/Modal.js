// src/pages/CounselorDashboard/Components/Modal.js
export default function Modal({
  open,
  title,
  children,
  onClose,
  width = 520,
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: width,
          background: "#fff",
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.15)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title ? (
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(0,0,0,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 1000 }}>
              {title}
            </h3>

            <button
              onClick={() => onClose?.()}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 18,
                fontWeight: 900,
                cursor: "pointer",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* Body */}
        <div
          style={{
            padding: 16,
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
