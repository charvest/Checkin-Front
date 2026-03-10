// src/components/ui/AppModal.jsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

function getFocusable(root) {
  if (!root) return [];
  const nodes = root.querySelectorAll(
    [
      'a[href]:not([tabindex="-1"])',
      "button:not([disabled]):not([tabindex='-1'])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",")
  );
  return Array.from(nodes).filter((el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
}

/**
 * AppModal (base)
 * - portal
 * - scroll lock
 * - focus trap
 * - ESC to close
 * - overlay click optional
 */
export default function AppModal({
  open,
  onClose,
  titleId = "app-modal-title",
  disableClose = false,
  maxWidthClass = "max-w-[760px]",
  children,
}) {
  const modalRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement;

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");

    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      rootAriaHidden: root?.getAttribute("aria-hidden"),
      rootInert: root?.inert,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    if (root) {
      root.setAttribute("aria-hidden", "true");
      if ("inert" in root) root.inert = true;
    }

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (!disableClose) {
          e.preventDefault();
          onClose?.();
        }
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusable(modalRef.current);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !modalRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    requestAnimationFrame(() => {
      const focusables = getFocusable(modalRef.current);
      (focusables[0] || modalRef.current)?.focus?.();
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown);

      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;

      if (root) {
        if (prev.rootAriaHidden == null) root.removeAttribute("aria-hidden");
        else root.setAttribute("aria-hidden", prev.rootAriaHidden);
        if ("inert" in root) root.inert = !!prev.rootInert;
      }

      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onClose, disableClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={() => {
          if (disableClose) return;
          onClose?.();
        }}
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${maxWidthClass} rounded-[22px] border-4 border-black bg-white shadow-[0_18px_0_rgba(0,0,0,0.18)] overflow-hidden`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
