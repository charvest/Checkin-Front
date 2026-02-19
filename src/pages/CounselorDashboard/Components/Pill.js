// src/pages/CounselorDashboard/Components/Pill.js
/**
 * Pill
 * Small status badge used across Counselor Dashboard
 *
 * Examples:
 * - <Pill label="Anonymous" type="info" />
 * - <Pill label="Pending" type="warning" />
 * - <Pill label="Approved" type="success" />
 * - <Pill label="Flagged" type="danger" />
 */

const STYLES = {
  default: {
    bg: "#F3F4F6",
    text: "#141414",
    border: "rgba(0,0,0,0.2)",
  },
  success: {
    bg: "rgba(185,255,102,0.5)",
    text: "#141414",
    border: "#000",
  },
  warning: {
    bg: "#FFF3CD",
    text: "#7A5D00",
    border: "#E6C200",
  },
  danger: {
    bg: "#FDE2E2",
    text: "#8A1C1C",
    border: "#C62828",
  },
  info: {
    bg: "#E8F0FE",
    text: "#1A3E8A",
    border: "#4F73FF",
  },
};

export default function Pill({ label, type = "default" }) {
  const style = STYLES[type] || STYLES.default;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      {label ?? ""}
    </span>
  );
}
