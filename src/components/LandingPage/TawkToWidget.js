import { useEffect } from "react";

const WIDGET_SRC = "https://embed.tawk.to/699b79bc8f3ea01c37046449/1ji3l72pu";

function findTawkContainer() {
  return (
    document.getElementById("tawkchat-container") ||
    document.querySelector('[id^="tawkchat-container"]') ||
    document.querySelector('[id*="tawkchat-container"]')
  );
}

function toCssUnit(v) {
  return typeof v === "number" ? `${v}px` : v;
}

export default function TawkToWidget({
  enabled = true,
  anchorSelector = "#landing-hero-illustration",
  anchorOffset = { x: 16, y: 16 },
  fallback = { bottom: 24, right: 24 },
  debug = false,
}) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    const log = (...args) => {
      if (debug) console.log("[tawk]", ...args);
    };

    const hide = () => {
      const el = findTawkContainer();
      if (el) el.style.display = "none";
      if (window.Tawk_API?.hideWidget) window.Tawk_API.hideWidget();
    };

    if (!enabled) {
      hide();
      return;
    }

    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    // Open it automatically once per tab session (prevents re-opening every refresh)
    window.Tawk_API.onLoad = function () {
      const KEY = "tawk_autopened";
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");

      window.Tawk_API.maximize();
    };

    if (!document.getElementById("tawkto-script")) {
      const script = document.createElement("script");
      script.id = "tawkto-script";
      script.type = "text/javascript";
      script.async = true;
      script.src = WIDGET_SRC;
      script.charset = "UTF-8";
      script.setAttribute("crossorigin", "*");

      script.onload = () => log("script loaded");
      script.onerror = () => log("script failed to load");

      const firstScript = document.getElementsByTagName("script")[0];
      if (firstScript?.parentNode)
        firstScript.parentNode.insertBefore(script, firstScript);
      else
        (
          document.body ||
          document.head ||
          document.documentElement
        ).appendChild(script);

      log("injecting script", WIDGET_SRC);
    } else {
      log("script already exists");
    }

    let stopped = false;

    const applyPosition = () => {
      const el = findTawkContainer();
      if (!el) return false;

      el.style.display = "";
      el.style.position = "fixed";
      el.style.zIndex = "2147483647";

      const anchor = anchorSelector
        ? document.querySelector(anchorSelector)
        : null;

      if (anchor) {
        const r = anchor.getBoundingClientRect();
        const isVisible =
          r.bottom > 0 &&
          r.top < window.innerHeight &&
          r.right > 0 &&
          r.left < window.innerWidth;

        if (isVisible) {
          const top = r.top + (anchorOffset?.y ?? 0);
          const right = window.innerWidth - r.right + (anchorOffset?.x ?? 0);

          el.style.top = toCssUnit(top);
          el.style.right = toCssUnit(right);
          el.style.bottom = "auto";
          el.style.left = "auto";
          return true;
        }
      }

      if (fallback?.bottom != null) {
        el.style.bottom = toCssUnit(fallback.bottom);
        el.style.top = "auto";
      }
      if (fallback?.right != null) {
        el.style.right = toCssUnit(fallback.right);
        el.style.left = "auto";
      }

      return true;
    };

    const observer = new MutationObserver(() => applyPosition());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    const onScrollOrResize = () => applyPosition();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    const loop = () => {
      if (stopped) return;
      if (!applyPosition()) setTimeout(loop, 250);
    };
    loop();

    return () => {
      stopped = true;
      observer.disconnect();
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [enabled, anchorSelector, anchorOffset, fallback, debug]);

  return null;
}
