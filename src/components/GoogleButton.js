// src/components/GoogleButton.js
import React from "react";

function Spinner({ size = 16 }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export default function GoogleButton({
  onClick,
  loading = false,
  disabled = false,
  className = "",
  label = "Login with Google",
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={[
        "w-full rounded-[14px] bg-white px-4 py-3 sm:py-[14px]",
        "text-[14px] sm:text-[15px] font-extrabold",
        "border border-black/10",
        "shadow-[0_10px_18px_rgba(0,0,0,0.10)]",
        "transition",
        "focus:outline-none focus:ring-2 focus:ring-black/15",
        isDisabled
          ? "opacity-70 cursor-not-allowed"
          : "hover:bg-black/5 active:translate-y-[1px] active:shadow-[0_9px_16px_rgba(0,0,0,0.10)]",
        className,
      ].join(" ")}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {loading ? (
          <Spinner size={16} />
        ) : (
          <span className="font-black text-black text-[16px] leading-none">G</span>
        )}
        {label}
      </span>
    </button>
  );
}
