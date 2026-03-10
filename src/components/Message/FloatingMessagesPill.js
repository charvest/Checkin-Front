// src/components/Message/FloatingMessagesPill.js
import React from "react";

export default function FloatingMessagesPill({
  accent = "#B9FF66",
  unread = 0,
  onClick,
  hidden = false,
  hasConversation = false,
}) {
  if (hidden) return null;

  const showBadge = hasConversation && unread > 0;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="Open Messages"
      title="Messages"
      style={{
        position: "fixed",
        zIndex: 10000,
        right: "calc(16px + env(safe-area-inset-right))",
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "rgba(255,255,255,0.90)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          height: 44,
          width: 44,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: `${accent}55`,
          color: "#141414",
          fontSize: 18,
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        💬
      </span>

      <div style={{ textAlign: "left", lineHeight: 1.1 }}>
        <div
          style={{
            fontFamily: "Nunito, sans-serif",
            fontWeight: 900,
            fontSize: 14.5,
            color: "#141414",
          }}
        >
          Messages
        </div>
        <div
          style={{
            fontFamily: "Lora, serif",
            fontWeight: 500,
            fontSize: 12.5,
            color: "rgba(20,20,20,0.70)",
          }}
        >
          {showBadge
            ? "You have new replies"
            : hasConversation
              ? "Continue conversation"
              : "Talk to a counselor"}
        </div>
      </div>

      {showBadge ? (
        <span
          style={{
            marginLeft: 2,
            padding: "2px 8px",
            borderRadius: 999,
            fontFamily: "Nunito, sans-serif",
            fontWeight: 900,
            fontSize: 12,
            color: "white",
            background: "#E53935",
          }}
        >
          {unread}
        </span>
      ) : null}
    </button>
  );
}
