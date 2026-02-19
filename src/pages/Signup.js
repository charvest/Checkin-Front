// src/pages/Signup.js  (SINGLE FILE: DomeGallery + Signup)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useGesture } from "@use-gesture/react";
import PrimaryButton from "../components/PrimaryButton";
import { signInWithGoogle } from "../auth";

import poster1 from "../assets/poster1.png";
import poster2 from "../assets/poster2.png";
import poster3 from "../assets/poster3.png";
import poster4 from "../assets/poster4.png";
import poster5 from "../assets/poster5.png";
import poster6 from "../assets/poster6.png";
import poster7 from "../assets/poster7.png";
import poster8 from "../assets/poster8.png";

import GoogleButton from "../components/GoogleButton";


/* ======================
   DOME GALLERY (LOCAL)
====================== */

const DG_DEFAULT_IMAGES = [
  { src: poster1, alt: "Abstract art" },
  { src: poster2, alt: "Modern sculpture" },
  { src: poster3, alt: "Modern" },
  { src: poster4, alt: "Modern Poster4" },
  { src: poster5, alt: "Modern Poster5" },
  { src: poster6, alt: "Modern Poster6" },
  { src: poster7, alt: "Modern Poster7" },
  { src: poster8, alt: "Modern Poster8" },
];

const dgClamp = (v, min, max) => Math.min(Math.max(v, min), max);
const dgWrapAngleSigned = (deg) => {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a - 180;
};

function dgBuildItems(pool, seg) {
  const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2);
  const evenYs = [-4, -2, 0, 2, 4];
  const oddYs = [-3, -1, 1, 3, 5];

  const coords = xCols.flatMap((x, c) => {
    const ys = c % 2 === 0 ? evenYs : oddYs;
    return ys.map((y) => ({ x, y, sizeX: 2, sizeY: 2 }));
  });

  const totalSlots = coords.length;
  if (!pool?.length) return coords.map((c) => ({ ...c, src: "", alt: "" }));

  const normalizedImages = pool.map((image) => {
    if (typeof image === "string") return { src: image, alt: "" };
    return { src: image?.src || "", alt: image?.alt || "" };
  });

  const usedImages = Array.from(
    { length: totalSlots },
    (_, i) => normalizedImages[i % normalizedImages.length],
  );

  for (let i = 1; i < usedImages.length; i++) {
    if (usedImages[i].src === usedImages[i - 1].src) {
      for (let j = i + 1; j < usedImages.length; j++) {
        if (usedImages[j].src !== usedImages[i].src) {
          const tmp = usedImages[i];
          usedImages[i] = usedImages[j];
          usedImages[j] = tmp;
          break;
        }
      }
    }
  }

  return coords.map((c, i) => ({
    ...c,
    src: usedImages[i].src,
    alt: usedImages[i].alt,
  }));
}

function DomeGallery({
  images = DG_DEFAULT_IMAGES,
  fit = 3,
  fitBasis = "min",
  minRadius = 150,
  maxRadius = 350,
  padFactor = 0.12,
  maxVerticalRotationDeg = 6,
  dragSensitivity = 20,
  enlargeTransitionMs = 260,
  segments = 20,
  dragDampening = 2,
  openedImageBorderRadius = "18px",
  imageBorderRadius = "18px",
  grayscale = false,
  colorFilter = "saturate(1.15) contrast(1.06)",
  autoRotate = false,
  autoRotateDegPerSec = 10,
  autoRotateIdleDelayMs = 1000,
  disableInteractionMaxWidth = 1024,
  viewerFrameShiftEnabled = true,

  className = "",
  showBackdrop = true,
  showVignette = true,
}) {
  const rootRef = useRef(null);
  const mainRef = useRef(null);
  const sphereRef = useRef(null);
  const frameRef = useRef(null);
  const viewerRef = useRef(null);
  const scrimRef = useRef(null);

  const rotationRef = useRef({ x: 0, y: 0 });
  const startRotRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef(null);

  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const inertiaRAF = useRef(null);
  const pointerTypeRef = useRef("mouse");

  const openingRef = useRef(false);
  const focusedElRef = useRef(null);
  const openStartedAtRef = useRef(0);

  const enlargeStateRef = useRef({ overlay: null });

  const autoRAF = useRef(null);
  const lastTsRef = useRef(0);
  const pauseUntilRef = useRef(0);

  const items = useMemo(
    () => dgBuildItems(images, segments),
    [images, segments],
  );

  const [interactionsDisabled, setInteractionsDisabled] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    const mqSmall = window.matchMedia(
      `(max-width: ${disableInteractionMaxWidth}px)`,
    );
    const mqTouch = window.matchMedia("(hover: none) and (pointer: coarse)");
    return mqSmall.matches || mqTouch.matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mqSmall = window.matchMedia(
      `(max-width: ${disableInteractionMaxWidth}px)`,
    );
    const mqTouch = window.matchMedia("(hover: none) and (pointer: coarse)");
    const recompute = () =>
      setInteractionsDisabled(mqSmall.matches || mqTouch.matches);

    if (mqSmall.addEventListener) mqSmall.addEventListener("change", recompute);
    else mqSmall.addListener(recompute);

    if (mqTouch.addEventListener) mqTouch.addEventListener("change", recompute);
    else mqTouch.addListener(recompute);

    recompute();

    return () => {
      if (mqSmall.removeEventListener)
        mqSmall.removeEventListener("change", recompute);
      else mqSmall.removeListener(recompute);

      if (mqTouch.removeEventListener)
        mqTouch.removeEventListener("change", recompute);
      else mqTouch.removeListener(recompute);
    };
  }, [disableInteractionMaxWidth]);

  const applyTransform = useCallback((xDeg, yDeg) => {
    const el = sphereRef.current;
    if (!el) return;
    el.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      if (!entries?.length || !entries[0]?.contentRect) return;

      const cr = entries[0].contentRect;
      const w = Math.max(1, cr.width);
      const h = Math.max(1, cr.height);
      const minDim = Math.min(w, h);
      const aspect = w / h;

      let basis;
      switch (fitBasis) {
        case "min":
          basis = minDim;
          break;
        case "max":
          basis = Math.max(w, h);
          break;
        case "width":
          basis = w;
          break;
        case "height":
          basis = h;
          break;
        default:
          basis = aspect >= 1.3 ? w : minDim;
      }

      let radius = basis * fit;
      radius = Math.min(radius, h * 1.28);
      radius = dgClamp(radius, minRadius, maxRadius);

      const viewerPad = Math.max(10, Math.round(minDim * padFactor));

      root.style.setProperty("--radius", `${Math.round(radius)}px`);
      root.style.setProperty("--viewer-pad", `${viewerPad}px`);
      root.style.setProperty("--tile-radius", imageBorderRadius);
      root.style.setProperty("--enlarge-radius", openedImageBorderRadius);
      root.style.setProperty(
        "--image-filter",
        grayscale ? "grayscale(1)" : "none",
      );
      root.style.setProperty("--color-filter", colorFilter);

      applyTransform(rotationRef.current.x, rotationRef.current.y);
    });

    ro.observe(root);
    return () => ro.disconnect();
  }, [
    applyTransform,
    fit,
    fitBasis,
    minRadius,
    maxRadius,
    padFactor,
    grayscale,
    imageBorderRadius,
    openedImageBorderRadius,
    colorFilter,
  ]);

  const stopInertia = useCallback(() => {
    if (!inertiaRAF.current) return;
    cancelAnimationFrame(inertiaRAF.current);
    inertiaRAF.current = null;
  }, []);

  const startInertia = useCallback(
    (vx, vy) => {
      const MAX_V = 1.4;
      let vX = dgClamp(vx, -MAX_V, MAX_V) * 80;
      let vY = dgClamp(vy, -MAX_V, MAX_V) * 80;

      let frames = 0;
      const d = dgClamp(dragDampening ?? 0.6, 0, 1);
      const frictionMul = 0.94 + 0.055 * d;
      const stopThreshold = 0.015 - 0.01 * d;
      const maxFrames = Math.round(90 + 270 * d);

      const step = () => {
        vX *= frictionMul;
        vY *= frictionMul;

        if (Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold) {
          inertiaRAF.current = null;
          return;
        }
        if (++frames > maxFrames) {
          inertiaRAF.current = null;
          return;
        }

        const nextX = dgClamp(
          rotationRef.current.x - vY / 200,
          -maxVerticalRotationDeg,
          maxVerticalRotationDeg,
        );
        const nextY = dgWrapAngleSigned(rotationRef.current.y + vX / 200);

        rotationRef.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);

        inertiaRAF.current = requestAnimationFrame(step);
      };

      stopInertia();
      inertiaRAF.current = requestAnimationFrame(step);
    },
    [applyTransform, dragDampening, maxVerticalRotationDeg, stopInertia],
  );

  const cleanupEnlarge = useCallback(() => {
    const st = enlargeStateRef.current;
    if (st.overlay?.parentElement) st.overlay.remove();

    const el = focusedElRef.current;
    if (el) el.style.visibility = "";

    enlargeStateRef.current = { overlay: null };
    focusedElRef.current = null;
    openingRef.current = false;
    rootRef.current?.removeAttribute("data-enlarging");
  }, []);

  const closeEnlarge = useCallback(() => {
    if (performance.now() - openStartedAtRef.current < 180) return;

    const overlay = enlargeStateRef.current.overlay;
    const el = focusedElRef.current;

    if (!overlay) {
      cleanupEnlarge();
      return;
    }

    overlay.style.transition = `transform ${enlargeTransitionMs}ms ease, opacity ${enlargeTransitionMs}ms ease`;
    overlay.style.opacity = "0";
    overlay.style.transform = "translate(0px, 0px) scale(0.94)";

    window.setTimeout(() => {
      if (el) el.style.visibility = "";
      cleanupEnlarge();
      pauseUntilRef.current = performance.now() + autoRotateIdleDelayMs;
    }, enlargeTransitionMs + 40);
  }, [cleanupEnlarge, enlargeTransitionMs, autoRotateIdleDelayMs]);

  const openAnchoredModal = useCallback(
    (parent, el) => {
      const rootEl = rootRef.current;
      const rootR = rootEl?.getBoundingClientRect();
      if (!rootR) return;

      const frameR = frameRef.current?.getBoundingClientRect();

      const cs = getComputedStyle(rootEl);
      const padStr = cs.getPropertyValue("--viewer-pad") || "40";
      const viewerPad = dgClamp(parseInt(padStr, 10) || 40, 10, 120);

      const safeInset = 12;
      const safeMinX = viewerFrameShiftEnabled
        ? rootR.left + rootR.width / 2 + safeInset
        : rootR.left + safeInset;
      const safeMaxX = rootR.right - safeInset;
      const safeMaxY = rootR.bottom - safeInset;
      const safeMinY = rootR.top + safeInset;

      const safeW = Math.max(1, safeMaxX - safeMinX);
      const safeH = Math.max(1, safeMaxY - safeMinY);

      const desiredFromFrame =
        frameR && frameR.width > 0 && frameR.height > 0
          ? Math.min(frameR.width, frameR.height)
          : Math.min(rootR.width, rootR.height);
      const desiredFromViewport =
        Math.min(window.innerWidth, window.innerHeight) - viewerPad * 2;

      let size = Math.min(
        desiredFromFrame,
        desiredFromViewport,
        safeW,
        safeH,
        900,
      );
      size = Math.max(size, 320);

      const centerX = frameR
        ? frameR.left + frameR.width / 2
        : safeMinX + safeW / 2;
      const centerY = frameR
        ? frameR.top + frameR.height / 2
        : safeMinY + safeH / 2;

      let left = Math.round(centerX - size / 2 - rootR.left);
      let top = Math.round(centerY - size / 2 - rootR.top);

      const minLeft = Math.round(safeMinX - rootR.left);
      const maxLeft = Math.round(safeMaxX - rootR.left - size);
      const minTop = Math.round(safeMinY - rootR.top);
      const maxTop = Math.round(safeMaxY - rootR.top - size);

      left = dgClamp(left, minLeft, Math.max(minLeft, maxLeft));
      top = dgClamp(top, minTop, Math.max(minTop, maxTop));

      const overlay = document.createElement("div");
      overlay.className = "dg-enlarge dg-enlarge--anchored";
      overlay.style.position = "absolute";
      overlay.style.left = `${left}px`;
      overlay.style.top = `${top}px`;
      overlay.style.width = `${Math.round(size)}px`;
      overlay.style.height = `${Math.round(size)}px`;
      overlay.style.opacity = "0";
      overlay.style.zIndex = "30";
      overlay.style.willChange = "transform, opacity";
      overlay.style.transformOrigin = "50% 50%";
      overlay.style.borderRadius = `var(--enlarge-radius, ${openedImageBorderRadius})`;
      overlay.style.overflow = "hidden";
      overlay.style.pointerEvents = "auto";
      overlay.style.transform = "translate(0px, 0px) scale(0.94)";
      overlay.style.boxShadow = "none";
      overlay.style.background = "transparent";

      const rawSrc = parent?.dataset?.src || el.querySelector("img")?.src || "";
      const rawAlt = parent?.dataset?.alt || el.querySelector("img")?.alt || "";

      const img = document.createElement("img");
      img.src = rawSrc;
      img.alt = rawAlt;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
      img.style.background = "transparent";
      img.style.filter = `${grayscale ? "grayscale(1)" : "none"} ${colorFilter}`;
      overlay.appendChild(img);

      overlay.addEventListener("click", (e) => {
        e.stopPropagation();
        closeEnlarge();
      });

      viewerRef.current?.appendChild(overlay);

      enlargeStateRef.current = { overlay };
      rootRef.current?.setAttribute("data-enlarging", "true");

      requestAnimationFrame(() => {
        overlay.style.transition = `transform ${enlargeTransitionMs}ms ease, opacity ${enlargeTransitionMs}ms ease`;
        overlay.style.opacity = "1";
        overlay.style.transform = "translate(0px, 0px) scale(1)";
        window.setTimeout(() => {
          openingRef.current = false;
        }, enlargeTransitionMs + 30);
      });
    },
    [
      closeEnlarge,
      colorFilter,
      enlargeTransitionMs,
      grayscale,
      openedImageBorderRadius,
      viewerFrameShiftEnabled,
    ],
  );

  const openItemFromElement = useCallback(
    (el) => {
      if (!el || openingRef.current || focusedElRef.current) return;
      if (interactionsDisabled) return;

      openingRef.current = true;
      openStartedAtRef.current = performance.now();
      pauseUntilRef.current = performance.now() + autoRotateIdleDelayMs;

      const parent = el.parentElement;
      if (!parent) {
        openingRef.current = false;
        return;
      }

      focusedElRef.current = el;
      openAnchoredModal(parent, el);
    },
    [autoRotateIdleDelayMs, interactionsDisabled, openAnchoredModal],
  );

  useGesture(
    {
      onDragStart: ({ event }) => {
        if (interactionsDisabled) return;
        if (focusedElRef.current) return;

        stopInertia();
        pointerTypeRef.current = event.pointerType || "mouse";

        draggingRef.current = true;
        movedRef.current = false;

        startRotRef.current = { ...rotationRef.current };
        startPosRef.current = { x: event.clientX, y: event.clientY };

        pauseUntilRef.current = performance.now() + autoRotateIdleDelayMs;
      },

      onDrag: ({
        event,
        last,
        velocity: velArr = [0, 0],
        direction: dirArr = [0, 0],
        movement,
      }) => {
        if (interactionsDisabled) return;
        if (
          focusedElRef.current ||
          !draggingRef.current ||
          !startPosRef.current
        )
          return;

        const dxTotal = event.clientX - startPosRef.current.x;
        const dyTotal = event.clientY - startPosRef.current.y;

        const absX = Math.abs(dxTotal);
        const absY = Math.abs(dyTotal);

        const touch = pointerTypeRef.current === "touch";
        const likelyScroll = touch && absY > absX * 1.25 && absY > 8;

        if (!movedRef.current) {
          const dist2 = dxTotal * dxTotal + dyTotal * dyTotal;
          if (dist2 > 16 * 16) movedRef.current = true;
        }

        if (!likelyScroll) {
          if (touch) event.preventDefault();

          const nextX = dgClamp(
            startRotRef.current.x - dyTotal / dragSensitivity,
            -maxVerticalRotationDeg,
            maxVerticalRotationDeg,
          );
          const nextY = startRotRef.current.y + dxTotal / dragSensitivity;

          const cur = rotationRef.current;
          if (cur.x !== nextX || cur.y !== nextY) {
            rotationRef.current = { x: nextX, y: nextY };
            applyTransform(nextX, nextY);
          }
        }

        if (!last) return;

        draggingRef.current = false;

        let [vMagX, vMagY] = velArr;
        const [dirX, dirY] = dirArr;
        let vx = vMagX * dirX;
        let vy = vMagY * dirY;

        if (
          Math.abs(vx) < 0.001 &&
          Math.abs(vy) < 0.001 &&
          Array.isArray(movement)
        ) {
          const [mx, my] = movement;
          vx = (mx / dragSensitivity) * 0.02;
          vy = (my / dragSensitivity) * 0.02;
        }

        if (!likelyScroll && (Math.abs(vx) > 0.005 || Math.abs(vy) > 0.005)) {
          startInertia(vx, vy);
        }

        startPosRef.current = null;
        movedRef.current = false;
        pauseUntilRef.current = performance.now() + autoRotateIdleDelayMs;
      },
    },
    {
      target: mainRef,
      eventOptions: { passive: false },
      drag: { filterTaps: true, threshold: 6 },
    },
  );

  useEffect(() => {
    const scrim = scrimRef.current;
    if (!scrim) return;

    const onClick = () => closeEnlarge();
    scrim.addEventListener("click", onClick);

    const onKey = (e) => {
      if (e.key === "Escape") closeEnlarge();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      scrim.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [closeEnlarge]);

  useEffect(() => {
    if (!autoRotate) return;

    const tick = (ts) => {
      autoRAF.current = requestAnimationFrame(tick);

      if (!sphereRef.current) return;

      if (!interactionsDisabled) {
        if (draggingRef.current) return;
        if (focusedElRef.current) return;
        if (openingRef.current) return;

        const now = performance.now();
        if (now < pauseUntilRef.current) return;
      }

      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      const delta = autoRotateDegPerSec * dt;
      const nextY = dgWrapAngleSigned(rotationRef.current.y + delta);

      rotationRef.current = { ...rotationRef.current, y: nextY };
      applyTransform(rotationRef.current.x, rotationRef.current.y);
    };

    autoRAF.current = requestAnimationFrame(tick);
    return () => {
      if (autoRAF.current) cancelAnimationFrame(autoRAF.current);
      autoRAF.current = null;
      lastTsRef.current = 0;
    };
  }, [autoRotate, autoRotateDegPerSec, applyTransform, interactionsDisabled]);

  const cssStyles = `
    .sphere-root {
      --radius: 520px;
      --viewer-pad: 40px;
      --circ: calc(var(--radius) * 3.14);
      --rot-y: calc((360deg / var(--segments-x)) / 2);
      --rot-x: calc((360deg / var(--segments-y)) / 2);
      --item-width: calc(var(--circ) / var(--segments-x));
      --item-height: calc(var(--circ) / var(--segments-y));
      --tile-radius: 26px;
      --enlarge-radius: 22px;
      --image-filter: none;
      --color-filter: saturate(1.15) contrast(1.06);
    }

    .sphere-root * { box-sizing: border-box; }
    .sphere, .sphere-item, .item__image { transform-style: preserve-3d; }

    .dg-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background: ${
        showBackdrop
          ? `
        radial-gradient(1100px 720px at 16% 16%,
          rgba(185,255,102,0.62) 0%,
          rgba(214,255,173,0.38) 32%,
          rgba(255,255,255,0.00) 70%
        ),
        radial-gradient(980px 720px at 78% 40%,
          rgba(214,255,173,0.44) 0%,
          rgba(236,255,223,0.24) 38%,
          rgba(255,255,255,0.00) 72%
        ),
        radial-gradient(900px 700px at 50% 55%,
          rgba(255,255,255,1) 0%,
          rgba(250,252,248,1) 58%,
          rgba(245,250,244,1) 100%
        );
      `
          : "none"
      };
    }

    .dg-bg::after{
      content:"";
      position:absolute;
      inset:0;
      pointer-events:none;
      opacity: ${showBackdrop ? ".35" : "0"};
      background:
        radial-gradient(circle at 1px 1px, rgba(0,0,0,0.10) 1px, rgba(0,0,0,0) 1.6px);
      background-size: 22px 22px;
      mix-blend-mode: soft-light;
    }

    .stage {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      position: absolute;
      inset: 0;
      margin: auto;
      perspective: calc(var(--radius) * 2);
      perspective-origin: 50% 46%;
      z-index: 2;
    }

    .sphere {
      transform: translateZ(calc(var(--radius) * -1));
      will-change: transform;
      position: absolute;
    }

    .sphere-item {
      width: calc(var(--item-width) * var(--item-size-x));
      height: calc(var(--item-height) * var(--item-size-y));
      position: absolute;
      top: -999px; bottom: -999px; left: -999px; right: -999px;
      margin: auto;
      transform-origin: 50% 50%;
      backface-visibility: hidden;
      transition: transform 300ms;
      transform:
        rotateY(calc(var(--rot-y) * (var(--offset-x) + ((var(--item-size-x) - 1) / 2)) + var(--rot-y-delta, 0deg)))
        rotateX(calc(var(--rot-x) * (var(--offset-y) - ((var(--item-size-y) - 1) / 2)) + var(--rot-x-delta, 0deg)))
        translateZ(var(--radius));
    }

    .item__image {
      position: absolute;
      inset: clamp(3px, 0.8vw, 6px);
      border-radius: var(--tile-radius, 12px);
      overflow: hidden;
      cursor: pointer;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      pointer-events: auto;
      transform: translateZ(0);
      box-shadow: 0 14px 30px rgba(0,0,0,.16);
      outline: none;
      background: rgba(255,255,255,.92);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .sphere-root[data-interactions="off"] .item__image {
      cursor: default;
      pointer-events: none;
      box-shadow: 0 14px 30px rgba(0,0,0,.14);
    }

    @media (hover: hover) and (pointer: fine) {
      .sphere-root:not([data-interactions="off"]) .item__image:hover {
        transform: translateZ(0) scale(1.025);
        box-shadow: 0 20px 44px rgba(0,0,0,.20);
      }
    }

    .sphere-root:not([data-interactions="off"]) .item__image:active { transform: translateZ(0) scale(0.99); }

    .item__image:focus-visible {
      outline: 3px solid rgba(0,0,0,.20);
      outline-offset: 3px;
    }

    .dg-tile-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
      filter: var(--image-filter) var(--color-filter);
    }

    .viewer { pointer-events: none; }
    .sphere-root[data-enlarging="true"] .viewer { pointer-events: auto; }

    .scrim {
      background: transparent !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    .sphere-root[data-enlarging="true"] .scrim {
      opacity: 1 !important;
      pointer-events: auto !important;
      cursor: zoom-out;
    }

    .dg-vignette {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      background:
        radial-gradient(circle at 50% 50%,
          rgba(255,255,255,0.00) 58%,
          rgba(185,255,102,0.12) 78%,
          rgba(185,255,102,0.26) 100%
        );
      opacity: ${showVignette ? "1" : "0"};
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
      <div
        ref={rootRef}
        className={`sphere-root relative w-full h-full ${className}`}
        data-interactions={interactionsDisabled ? "off" : "on"}
        style={{
          ["--segments-x"]: segments,
          ["--segments-y"]: segments,
          ["--tile-radius"]: imageBorderRadius,
          ["--enlarge-radius"]: openedImageBorderRadius,
          ["--image-filter"]: grayscale ? "grayscale(1)" : "none",
          ["--color-filter"]: colorFilter,
        }}
      >
        <main
          ref={mainRef}
          className="absolute inset-0 grid place-items-center overflow-hidden select-none bg-transparent"
          style={{
            touchAction: interactionsDisabled ? "auto" : "pan-y",
            WebkitUserSelect: "none",
          }}
        >
          <div className="dg-bg" />

          <div className="stage">
            <div ref={sphereRef} className="sphere">
              {items.map((it, i) => (
                <div
                  key={`${it.x},${it.y},${i}`}
                  className="sphere-item absolute m-auto"
                  data-src={it.src}
                  data-alt={it.alt}
                  data-offset-x={it.x}
                  data-offset-y={it.y}
                  data-size-x={it.sizeX}
                  data-size-y={it.sizeY}
                  style={{
                    ["--offset-x"]: it.x,
                    ["--offset-y"]: it.y,
                    ["--item-size-x"]: it.sizeX,
                    ["--item-size-y"]: it.sizeY,
                  }}
                >
                  <div
                    className="item__image absolute block overflow-hidden"
                    role={interactionsDisabled ? undefined : "button"}
                    tabIndex={interactionsDisabled ? -1 : 0}
                    aria-label={it.alt || "Open image"}
                    onClick={(e) => {
                      if (interactionsDisabled) return;
                      if (draggingRef.current) return;
                      if (openingRef.current) return;
                      openItemFromElement(e.currentTarget);
                    }}
                    onKeyDown={(e) => {
                      if (interactionsDisabled) return;
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      if (draggingRef.current) return;
                      if (openingRef.current) return;
                      openItemFromElement(e.currentTarget);
                    }}
                  >
                    <img
                      src={it.src}
                      draggable={false}
                      alt={it.alt}
                      className="dg-tile-img"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {showVignette ? <div className="dg-vignette" /> : null}

          <div
            ref={viewerRef}
            className="viewer absolute inset-0 z-20 flex items-center justify-center"
            style={{ padding: "var(--viewer-pad)" }}
          >
            <div
              ref={scrimRef}
              className="scrim absolute inset-0 z-10 opacity-0 transition-opacity duration-300"
            />

            <div
              ref={frameRef}
              className="viewer-frame h-full aspect-square flex pointer-events-none"
              style={{
                marginLeft: viewerFrameShiftEnabled ? "50%" : "0%",
                transform: viewerFrameShiftEnabled
                  ? "translateX(clamp(0px, 3vw, 70px))"
                  : "translateX(0px)",
              }}
            />
          </div>
        </main>
      </div>
    </>
  );
}

/* ======================
   SIGNUP PAGE
====================== */

const COURSES = [
  "Bachelor of Science in Nursing",
  "Bachelor of Elementary Education (SPED)",
  "Bachelor of Physical Education",
  "Bachelor of Secondary Education",
  "Bachelor of Science in Business Administration (BSBA)",
  "Bachelor of Science in Accounting Information System",
  "Bachelor of Science in Information Technology",
  "Bachelor of Science in Computer Science",
  "Bachelor of Science in Hospitality Management (BSHM)",
  "Bachelor of Science in Tourism Management (BSTM)",
  "Bachelor of Science in Criminology",
  "Bachelor of Arts in English Language",
  "Bachelor of Arts in Psychology",
  "Bachelor of Arts in Political Science",
];

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

/* ======================
   GOOGLE CTA BUTTON (LOCAL)
   - Signup page should say "Sign up with Google"
   - We keep it local so Login page can still use its own Google button text
====================== */

function GoogleGIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.15 0 5.98 1.09 8.22 2.88l6.14-6.14C34.45 2.6 29.59 0.5 24 0.5 14.62 0.5 6.51 5.88 2.61 13.72l7.22 5.61C11.6 13.58 17.3 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.65-.15-3.23-.43-4.77H24v9.04h12.6c-.54 2.9-2.16 5.36-4.6 7.02l7.05 5.45c4.12-3.8 6.45-9.4 6.45-16.74z"
      />
      <path
        fill="#FBBC05"
        d="M9.83 28.67a14.5 14.5 0 0 1 0-9.34l-7.22-5.61a23.9 23.9 0 0 0 0 20.56l7.22-5.61z"
      />
      <path
        fill="#34A853"
        d="M24 47.5c5.59 0 10.3-1.85 13.73-5.03l-7.05-5.45c-1.96 1.32-4.47 2.1-6.68 2.1-6.7 0-12.4-4.08-14.17-9.83l-7.22 5.61C6.51 42.12 14.62 47.5 24 47.5z"
      />
    </svg>
  );
}

function GoogleCTAButton({ onClick, loading, label = "Sign up with Google" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`w-full rounded-[14px] border-2 border-black bg-white px-4 py-3 sm:py-[14px] text-[14px] sm:text-[15px] font-extrabold
        shadow-[0_16px_0_rgba(0,0,0,0.12)] transition
        ${loading ? "opacity-70 cursor-not-allowed" : "hover:bg-black/5 active:translate-y-[1px] active:shadow-[0_15px_0_rgba(0,0,0,0.12)]"}` }
    >
      <span className="inline-flex items-center justify-center gap-2">
        {loading ? <Spinner size={16} /> : <GoogleGIcon size={16} />}
        {label}
      </span>
    </button>
  );
}

/* ======================
   OR DIVIDER (LOCAL)
====================== */

function OrDivider({ text = "OR" }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="h-[2px] flex-1 bg-black/15" />
      <span className="text-[11px] sm:text-[12px] font-extrabold tracking-[0.22em] text-black/55">
        {text}
      </span>
      <div className="h-[2px] flex-1 bg-black/15" />
    </div>
  );
}

/* ======================
   FORM INPUTS (LOCAL)
====================== */

function EyeIcon({ open }) {
  return open ? (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M6.2 6.2C3.8 8 2 12 2 12s3.5 7 10 7c2 0 3.7-.5 5.1-1.3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 4.2C10.6 4.1 11.3 4 12 4c6.5 0 10 8 10 8s-1.2 2.7-3.4 4.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatFieldError(errorText) {
  if (!errorText) return "";
  const norm = String(errorText).trim();
  if (/^must be filled out/i.test(norm) && !norm.endsWith("*"))
    return `${norm}*`;
  return norm;
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  paired = false,
  errorText,
  rightSlot,
  rightSlotWidth = 44,
  maxLength,
  inputMode,
  autoComplete,
  spellCheck = false,
  autoCapitalize = "none",
  name,
  onBlur,
}) {
  const normError = formatFieldError(errorText);
  const isEmpty = !String(value || "").trim();

  const showInlineRequired =
    Boolean(normError) && /^must be filled out/i.test(normError) && isEmpty;

  const topError = showInlineRequired ? "" : normError;

  const errorId = useMemo(() => {
    const safe = String(label || "field")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `err-${safe}`;
  }, [label]);

  return (
    <div className="w-full">
      <div
        className={`mb-1 min-w-0 flex items-end justify-between gap-3 overflow-visible ${
          paired ? "sm:h-[32px]" : ""
        }`}
      >
        <span className="block text-[13px] font-extrabold text-black/90 whitespace-nowrap">
          {label}
        </span>

        {topError ? (
          <span className="min-w-0 max-w-[72%] text-[11px] sm:text-[12px] font-extrabold text-red-600 text-right whitespace-normal break-words leading-tight relative z-10">
            {topError}
          </span>
        ) : null}
      </div> 

      {normError ? (
        <span id={errorId} className="sr-only">
          {normError}
        </span>
      ) : null}

      <div className="relative">
        <input
          value={value}
          onChange={onChange}
          type={type}
          disabled={disabled}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete={autoComplete}
          spellCheck={spellCheck}
          autoCapitalize={autoCapitalize}
          name={name}
          onBlur={onBlur}
          aria-invalid={Boolean(normError)}
          aria-describedby={normError ? errorId : undefined}
          placeholder={showInlineRequired ? normError : undefined}
          className={`
            w-full rounded-[14px] border-2 bg-white
            px-4 py-3 sm:py-[14px]
            text-[14px] sm:text-[15px]
            focus:outline-none focus:ring-2 focus:ring-black/20
            placeholder:text-red-600 placeholder:font-extrabold placeholder:opacity-100
            ${disabled ? "opacity-60 cursor-not-allowed" : ""}
            ${normError ? "border-red-600" : "border-black"}
          `}
          style={{
            paddingRight: rightSlot ? rightSlotWidth + 12 : undefined,
          }}
        />

        {rightSlot ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {rightSlot}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  disabled,
  paired = false,
  errorText,
  maxLength,
  autoComplete,
}) {
  const [show, setShow] = useState(false);

  return (
    <FieldInput
      label={label}
      value={value}
      onChange={onChange}
      type={show ? "text" : "password"}
      disabled={disabled}
      paired={paired}
      maxLength={maxLength}
      autoComplete={autoComplete}
      errorText={errorText}
      rightSlotWidth={54}
      rightSlot={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="h-10 w-10 rounded-[14px] grid place-items-center hover:bg-black/5"
          aria-label={show ? "Hide password" : "Show password"}
        >
          <span className="text-black/70">
            <EyeIcon open={show} />
          </span>
        </button>
      }
    />
  );
}

/* ======================
   TERMS MODAL
====================== */

function TermsModal({ open, onClose, onAgree, agreed, setAgreed, loading }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
      style={{
        paddingTop: "max(12px, env(safe-area-inset-top))",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className="relative w-full max-w-[760px] rounded-[22px] border-4 border-black bg-white shadow-[0_18px_0_rgba(0,0,0,0.18)] overflow-hidden flex flex-col"
        style={{ maxHeight: "min(90dvh, 860px)" }}
      >
        <div className="p-5 sm:p-6 border-b border-black/10 bg-white shrink-0">
          <h2 className="text-[18px] sm:text-[20px] font-extrabold tracking-[0.12em]">
            TERMS & CONDITIONS
          </h2>
          <p className="text-[13px] text-black/60 mt-2">
            Please review and accept to create your account.
          </p>
        </div>

        <div
          className="p-5 sm:p-6 flex-1 min-h-0 overflow-y-auto text-[13px] sm:text-[14px] leading-relaxed text-black/75"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <p className="font-bold text-black/80 mb-2">Summary</p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              CheckIn supports student well-being using journaling and PHQ-9
              self-assessment.
            </li>
            <li>
              CheckIn is <span className="font-semibold">not</span> a diagnostic
              tool and does not replace professional care.
            </li>
            <li>
              Use the platform respectfully. Do not attempt unauthorized access
              or misuse.
            </li>
            <li>
              If you are in immediate danger, contact emergency services or your
              local hotline.
            </li>
          </ul>

          <div className="mt-5">
            <p className="font-bold text-black/80 mb-2">Full Terms</p>
            <p className="mb-3">
              By creating an account and using CheckIn, you agree to use the
              platform only for lawful and appropriate purposes.
            </p>
            <p className="mb-3">
              CheckIn may store and process information you provide to deliver
              features and improve performance.
            </p>
            <p className="mb-3">
              CheckIn is provided “as is.” We cannot guarantee uninterrupted
              availability.
            </p>
            <p>
              We may update these terms when necessary. Continued use
              constitutes acceptance of updated terms.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 border-t border-black/10 bg-white shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <label className="flex items-center gap-2 text-[13px] font-bold">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="accent-greenBorder"
            />
            I agree to the Terms & Conditions
          </label>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-[13px] font-extrabold rounded-[14px] border-2 border-black bg-white hover:bg-black/5"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!agreed || loading}
              onClick={onAgree}
              className={`px-5 py-2 text-[13px] font-extrabold rounded-[14px] border-2 border-black flex items-center gap-2 justify-center ${
                agreed
                  ? "bg-black text-white hover:opacity-90"
                  : "bg-black/30 text-white cursor-not-allowed"
              }`}
            >
              {loading ? (
                <>
                  <Spinner />
                  Loading
                </>
              ) : (
                "Agree & Continue"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================
   COURSE DROPDOWN
====================== */

function CourseDropdown({ label, value, onChange, options, disabled, errorText }) {
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0, maxHeight: 280 });

  const normError = formatFieldError(errorText);
  const isEmpty = !String(value || "").trim();

  const showInlineRequired =
    Boolean(normError) && /^must be filled out/i.test(normError) && isEmpty;

  const topError = showInlineRequired ? "" : normError;
  const selectedLabel = value || "Select your course";

  useEffect(() => setMounted(true), []);

  const computePos = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const gap = 10;
    const viewportPad = 10;

    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPad;
    const spaceAbove = rect.top - gap - viewportPad;

    const desiredMax = 340;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;

    const maxHeight = Math.max(
      200,
      Math.min(desiredMax, openUp ? spaceAbove : spaceBelow),
    );

    const top = openUp
      ? Math.max(viewportPad, rect.top - gap - maxHeight)
      : Math.min(window.innerHeight - viewportPad - maxHeight, rect.bottom + gap);

    const left = Math.min(
      Math.max(viewportPad, rect.left),
      window.innerWidth - viewportPad - rect.width,
    );

    setPos({ left, top, width: rect.width, maxHeight });
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    computePos();

    const onDocDown = (e) => {
      const wrap = wrapRef.current;
      const menu = menuRef.current;
      const t = e.target;
      if (wrap && wrap.contains(t)) return;
      if (menu && menu.contains(t)) return;
      close();
    };

    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    const onResize = () => computePos();
    const onScroll = () => computePos();

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close, computePos]);

  const handlePick = (opt) => {
    onChange({ target: { value: opt } });
    close();
  };

  const menu = open ? (
    <div
      ref={menuRef}
      role="listbox"
      className="z-[9999] rounded-[14px] border-2 border-black bg-white shadow-[0_16px_0_rgba(0,0,0,0.14)] overflow-hidden"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: pos.width,
        maxHeight: pos.maxHeight,
        overscrollBehavior: "contain",
      }}
    >
      <div
        className="h-full overflow-y-auto"
        style={{ maxHeight: pos.maxHeight, WebkitOverflowScrolling: "touch" }}
      >
        <button
          type="button"
          onClick={() => handlePick("")}
          className={`w-full text-left px-4 py-3 text-[14px] hover:bg-black/5 ${
            !value ? "font-extrabold" : "font-semibold"
          }`}
        >
          Select your course
        </button>

        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => handlePick(opt)}
              className={`w-full text-left px-4 py-3 text-[14px] hover:bg-black/5 ${
                active ? "bg-black text-white hover:bg-black" : "text-black"
              }`}
              style={{ overflowWrap: "anywhere" }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="mb-1 min-w-0 flex items-end justify-between gap-3 overflow-visible">
        <span className="block text-[13px] font-extrabold text-black/90 whitespace-nowrap">
          {label}
        </span>

        {topError ? (
          <span className="min-w-0 max-w-[72%] text-[11px] sm:text-[12px] font-extrabold text-red-600 text-right whitespace-normal break-words leading-tight relative z-10">
            {topError}
          </span>
        ) : null}
      </div>

      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
          }}
          className={`
            relative w-full text-left rounded-[14px] border-2 bg-white
            px-4 pr-11 py-3 sm:py-[14px]
            text-[14px] sm:text-[15px] leading-snug
            focus:outline-none focus:ring-2 focus:ring-black/20
            ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
            ${normError ? "border-red-600" : "border-black"}
          `}
        >
          <span
            className={`block ${
              showInlineRequired
                ? "text-red-600 font-extrabold"
                : value
                  ? "text-black"
                  : "text-black/50"
            }`}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {showInlineRequired ? normError : selectedLabel}
          </span>

          <span
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black transition-transform duration-150 ${
              open ? "rotate-180" : "rotate-0"
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>

      {mounted ? createPortal(menu, document.body) : null}
    </div>
  );
}

/* ======================
   NETWORK
====================== */

const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");

async function fetchJsonSafe(url, options) {
  const res = await fetch(url, options);
  const raw = await res.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  return { res, data, raw };
}

/* ======================
   INPUT RULES (ANTI-XSS + LIMITS)
   - Inline-only: we sanitize onChange and show field errors inline
====================== */

const INPUT_LIMITS = {
  firstName: 50,
  lastName: 50,
  email: 254,
  username: 24,
  studentNumber: 8, // "00-00000"
  password: 64,
  confirmPassword: 64,
};

function stripDangerousChars(v) {
  return String(v ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>`]/g, "");
}

function sanitizeNameValue(raw, maxLen) {
  const original = String(raw ?? "");
  const cleaned = stripDangerousChars(original).replace(
    /[^A-Za-zÀ-ÖØ-öø-ÿ'\-\s]/g,
    "",
  );
  const trimmed = cleaned.replace(/\s{2,}/g, " ").slice(0, maxLen);
  const hadBad =
    trimmed.length !== stripDangerousChars(original).length ||
    /[^A-Za-zÀ-ÖØ-öø-ÿ'\-\s]/.test(stripDangerousChars(original));
  return {
    value: trimmed,
    error: hadBad
      ? "Only letters, spaces, apostrophe (') and hyphen (-) are allowed."
      : "",
  };
}

function sanitizeUsernameValue(raw, maxLen) {
  const original = String(raw ?? "");
  const cleanedBase = stripDangerousChars(original).replace(/\s+/g, "");
  const cleaned = cleanedBase.replace(/[^A-Za-z0-9._]/g, "").slice(0, maxLen);
  const hadBad = cleaned !== cleanedBase;
  return {
    value: cleaned,
    error: hadBad
      ? "Only letters, numbers, dot (.) and underscore (_) are allowed."
      : "",
  };
}

function sanitizeEmailValue(raw, maxLen) {
  const original = String(raw ?? "");
  const cleanedBase = stripDangerousChars(original).replace(/\s+/g, "");
  const cleaned = cleanedBase.slice(0, maxLen);
  const hadBad = cleaned !== cleanedBase;
  return {
    value: cleaned,
    error: hadBad ? "Email contains invalid characters." : "",
  };
}

// ✅ dash appears immediately after 2 digits if user types "-"
function formatStudentNumber(raw) {
  const s = String(raw ?? "");
  const digits = s.replace(/\D/g, "").slice(0, 7);

  const hasDash = s.includes("-");
  const endsWithDash = s.endsWith("-");

  if (digits.length === 2 && (hasDash || endsWithDash)) return `${digits}-`;
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function sanitizeStudentNumberValue(raw, maxLen) {
  const original = String(raw ?? "");
  const base = stripDangerousChars(original);
  const hadForbidden = /[^0-9\-\s]/.test(base);
  const formatted = formatStudentNumber(base).slice(0, maxLen);
  return {
    value: formatted,
    error: hadForbidden ? "Student number can only contain numbers and a dash (-)." : "",
  };
}

function applyInputRules(key, rawValue) {
  const raw = String(rawValue ?? "");
  switch (key) {
    case "firstName":
      return sanitizeNameValue(raw, INPUT_LIMITS.firstName);
    case "lastName":
      return sanitizeNameValue(raw, INPUT_LIMITS.lastName);
    case "username":
      return sanitizeUsernameValue(raw, INPUT_LIMITS.username);
    case "email":
      return sanitizeEmailValue(raw, INPUT_LIMITS.email);
    case "studentNumber":
      return sanitizeStudentNumberValue(raw, INPUT_LIMITS.studentNumber);
    case "password":
      return {
        value: stripDangerousChars(raw).slice(0, INPUT_LIMITS.password),
        error: "",
      };
    case "confirmPassword":
      return {
        value: stripDangerousChars(raw).slice(0, INPUT_LIMITS.confirmPassword),
        error: "",
      };
    default:
      return { value: stripDangerousChars(raw), error: "" };
  }
}

function isValidEmailFormat(email) {
  const v = String(email ?? "").trim();
  if (!v) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v);
}

function isValidStudentNumberFormat(v) {
  return /^[0-9]{2}-[0-9]{5}$/.test(String(v ?? "").trim());
}

/* ======================
   SIGNUP PAGE
====================== */

export default function Signup() {
  const navigate = useNavigate();

  // Inline-only banners (no modals / no toasts)
  const [formBanner, setFormBanner] = useState(null);
  const clearBanner = useCallback(() => setFormBanner(null), []);
  const showBanner = useCallback((variant, title, message) => {
    setFormBanner({ variant, title, message });
  }, []);
  const showErrorBanner = useCallback(
    (message) => showBanner("error", "Error", message),
    [showBanner],
  );

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    studentNumber: "",
    course: "",
    password: "",
    confirmPassword: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [googleInlineError, setGoogleInlineError] = useState("");

  // ✅ if /availability does not exist, stop calling it (prevents endless 404 spam)
  const availabilityRef = useRef({ supported: true });

  const setField = (key) => (e) => {
    const raw = e?.target?.value ?? "";
    const { value: nextVal, error } = applyInputRules(key, raw);

    setForm((p) => ({ ...p, [key]: nextVal }));

    setFieldErrors((prev) => {
      const copy = { ...prev };
      if (copy[key]) delete copy[key];
      if (error) copy[key] = error;
      return copy;
    });

    clearBanner();
    setGoogleInlineError("");
  };

  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);

  const pendingActionRef = useRef(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");

    const prev = {
      htmlOverflowY: html.style.overflowY,
      bodyOverflowY: body.style.overflowY,
      bodyOverflowX: body.style.overflowX,
      rootOverflowY: root?.style.overflowY,
    };

    html.style.overflowY = "auto";
    body.style.overflowY = "auto";
    body.style.overflowX = prev.bodyOverflowX || "hidden";
    if (root) root.style.overflowY = prev.rootOverflowY || "visible";

    return () => {
      html.style.overflowY = prev.htmlOverflowY;
      body.style.overflowY = prev.bodyOverflowY;
      body.style.overflowX = prev.bodyOverflowX;
      if (root) root.style.overflowY = prev.rootOverflowY ?? "";
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("termsAccepted") === "true";
    setTermsAccepted(saved);
    setTermsChecked(false);
  }, []);

  /* ======================
     LIVE AVAILABILITY CHECKS (INLINE ONLY)
  ====================== */

  const liveRef = useRef({
    usernameTimer: null,
    emailTimer: null,
    studentTimer: null,
    usernameAbort: null,
    emailAbort: null,
    studentAbort: null,
  });

  const clearIfMatches = useCallback((field, matchText) => {
    setFieldErrors((prev) => {
      if (prev?.[field] !== matchText) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  }, []);

  const setTakenInline = useCallback((field, message) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  // Username live check
  useEffect(() => {
    const v = (form.username || "").trim();
    const TAKEN = "Username is taken.";

    if (!availabilityRef.current.supported) return;

    if (v.length < 6) {
      clearIfMatches("username", TAKEN);
      return;
    }

    if (fieldErrors.username && fieldErrors.username !== TAKEN) return;
    if (!API_BASE) return;

    if (liveRef.current.usernameTimer) {
      clearTimeout(liveRef.current.usernameTimer);
      liveRef.current.usernameTimer = null;
    }
    if (liveRef.current.usernameAbort) {
      liveRef.current.usernameAbort.abort();
      liveRef.current.usernameAbort = null;
    }

    const ac = new AbortController();
    liveRef.current.usernameAbort = ac;

    liveRef.current.usernameTimer = window.setTimeout(async () => {
      const valueAtCall = v;

      try {
        const { res, data } = await fetchJsonSafe(
          `${API_BASE}/api/auth/availability?username=${encodeURIComponent(valueAtCall)}`,
          { method: "GET", signal: ac.signal },
        );

        if (res.status === 404) {
          availabilityRef.current.supported = false;
          return;
        }

        if ((form.username || "").trim() !== valueAtCall) return;

        if (res.ok) {
          const available = data?.usernameAvailable !== false;
          if (!available) setTakenInline("username", TAKEN);
          else clearIfMatches("username", TAKEN);
        }
      } catch {
        // ignore
      }
    }, 450);

    return () => {
      if (liveRef.current.usernameTimer) {
        clearTimeout(liveRef.current.usernameTimer);
        liveRef.current.usernameTimer = null;
      }
      if (liveRef.current.usernameAbort) {
        liveRef.current.usernameAbort.abort();
        liveRef.current.usernameAbort = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.username]);

  // Email live check
  useEffect(() => {
    const v = (form.email || "").trim();
    const TAKEN = "Email is taken.";

    if (!availabilityRef.current.supported) return;

    if (!isValidEmailFormat(v)) {
      clearIfMatches("email", TAKEN);
      return;
    }

    if (fieldErrors.email && fieldErrors.email !== TAKEN) return;
    if (!API_BASE) return;

    if (liveRef.current.emailTimer) {
      clearTimeout(liveRef.current.emailTimer);
      liveRef.current.emailTimer = null;
    }
    if (liveRef.current.emailAbort) {
      liveRef.current.emailAbort.abort();
      liveRef.current.emailAbort = null;
    }

    const ac = new AbortController();
    liveRef.current.emailAbort = ac;

    liveRef.current.emailTimer = window.setTimeout(async () => {
      const valueAtCall = v;

      try {
        const { res, data } = await fetchJsonSafe(
          `${API_BASE}/api/auth/availability?email=${encodeURIComponent(valueAtCall)}`,
          { method: "GET", signal: ac.signal },
        );

        if (res.status === 404) {
          availabilityRef.current.supported = false;
          return;
        }

        if ((form.email || "").trim() !== valueAtCall) return;

        if (res.ok) {
          const available = data?.emailAvailable !== false;
          if (!available) setTakenInline("email", TAKEN);
          else clearIfMatches("email", TAKEN);
        }
      } catch {
        // ignore
      }
    }, 450);

    return () => {
      if (liveRef.current.emailTimer) {
        clearTimeout(liveRef.current.emailTimer);
        liveRef.current.emailTimer = null;
      }
      if (liveRef.current.emailAbort) {
        liveRef.current.emailAbort.abort();
        liveRef.current.emailAbort = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email]);

  // Student number live check
  useEffect(() => {
    const v = (form.studentNumber || "").trim();
    const TAKEN = "Student number is taken.";

    if (!availabilityRef.current.supported) return;

    if (!isValidStudentNumberFormat(v)) {
      clearIfMatches("studentNumber", TAKEN);
      return;
    }

    if (fieldErrors.studentNumber && fieldErrors.studentNumber !== TAKEN) return;
    if (!API_BASE) return;

    if (liveRef.current.studentTimer) {
      clearTimeout(liveRef.current.studentTimer);
      liveRef.current.studentTimer = null;
    }
    if (liveRef.current.studentAbort) {
      liveRef.current.studentAbort.abort();
      liveRef.current.studentAbort = null;
    }

    const ac = new AbortController();
    liveRef.current.studentAbort = ac;

    liveRef.current.studentTimer = window.setTimeout(async () => {
      const valueAtCall = v;

      try {
        const { res, data } = await fetchJsonSafe(
          `${API_BASE}/api/auth/availability?studentNumber=${encodeURIComponent(valueAtCall)}`,
          { method: "GET", signal: ac.signal },
        );

        if (res.status === 404) {
          availabilityRef.current.supported = false;
          return;
        }

        if ((form.studentNumber || "").trim() !== valueAtCall) return;

        if (res.ok) {
          const available = data?.studentNumberAvailable !== false;
          if (!available) setTakenInline("studentNumber", TAKEN);
          else clearIfMatches("studentNumber", TAKEN);
        }
      } catch {
        // ignore
      }
    }, 450);

    return () => {
      if (liveRef.current.studentTimer) {
        clearTimeout(liveRef.current.studentTimer);
        liveRef.current.studentTimer = null;
      }
      if (liveRef.current.studentAbort) {
        liveRef.current.studentAbort.abort();
        liveRef.current.studentAbort = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.studentNumber]);

  const runPendingIfAny = () => {
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    if (typeof pending === "function") pending();
  };

  const handleAgreeTerms = () => {
    setTermsLoading(true);
    setTimeout(() => {
      localStorage.setItem("termsAccepted", "true");
      setTermsAccepted(true);
      setTermsChecked(false);
      setShowTerms(false);
      setTermsLoading(false);
      setTimeout(runPendingIfAny, 0);
    }, 450);
  };

  const requireTermsThen = async (fn) => {
    if (!termsAccepted) {
      pendingActionRef.current = fn;
      setTermsChecked(false);
      setShowTerms(true);
      return;
    }
    await fn();
  };

  const validateRequired = (keys) => {
    const nextErrors = {};
    for (const k of keys) {
      const v = String(form[k] || "").trim();
      if (!v) nextErrors[k] = "Must be filled out";
    }
    setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  /* ======================
     GOOGLE SIGNUP
     ✅ Enforced by backend: /api/auth/google must return 409 if account exists
     ✅ Frontend: DO NOT rely on /availability (because yours is 404)
  ====================== */

  const handleGoogleSignup = async () => {
    await requireTermsThen(async () => {
      setGoogleInlineError("");

      if (!API_BASE) {
        setGoogleInlineError("Missing REACT_APP_API_URL. Set your backend base URL.");
        return;
      }

      const firstName = (form.firstName || "").trim();
      const lastName = (form.lastName || "").trim();
      const username = (form.username || "").trim();
      const course = (form.course || "").trim();
      const studentNumber = (form.studentNumber || "").trim();

      const nextErrors = {};
      if (!firstName) nextErrors.firstName = "Must be filled out";
      if (!lastName) nextErrors.lastName = "Must be filled out";
      if (!username) nextErrors.username = "Must be filled out";
      if (!studentNumber) nextErrors.studentNumber = "Must be filled out";
      if (!course) nextErrors.course = "Must be filled out";

      if (Object.keys(nextErrors).length) {
        setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
        return;
      }

      if (fieldErrors.username === "Username is taken.") return;
      if (fieldErrors.studentNumber === "Student number is taken.") return;

      if (username.length < 6) {
        setFieldErrors((prev) => ({
          ...prev,
          username: "Username must be at least 6 characters.",
        }));
        return;
      }

      if (!isValidStudentNumberFormat(studentNumber)) {
        setFieldErrors((prev) => ({
          ...prev,
          studentNumber: "Invalid, please try again.",
        }));
        return;
      }

      setLoading(true);

      try {
        const firebaseUser = await signInWithGoogle();
        const u = firebaseUser?.user || firebaseUser;

        if (!u?.email) {
          setGoogleInlineError("Google account has no email. Please try another account.");
          return;
        }

        // show the Google email in the form
        setForm((p) => ({ ...p, email: u.email }));

        const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

        const payload = {
          intent: "signup",
          googleId: u?.uid,
          email: u?.email,
          fullName: fullName || u?.displayName || u?.email?.split("@")?.[0],
          firstName,
          lastName,
          username,
          course,
          studentNumber,
        };

        const { res, data, raw } = await fetchJsonSafe(`${API_BASE}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          // ✅ This is the required behavior: only signup once
          if (
            res.status === 409 &&
            (data?.code === "ACCOUNT_EXISTS" ||
              (data?.message || "").toLowerCase().includes("account already exists") ||
              (data?.message || "").toLowerCase().includes("log in"))
          ) {
            setFieldErrors((prev) => ({ ...prev, email: "Email is taken." }));
            setGoogleInlineError("Google account already exists. Please log in instead.");
            return;
          }

          const serverMsg = (data?.message || raw || "Google sign up failed.").toString();
          const msg = serverMsg.toLowerCase();

          if (msg.includes("email") && (msg.includes("exist") || msg.includes("taken") || msg.includes("already"))) {
            setFieldErrors((prev) => ({ ...prev, email: "Email is taken." }));
            setGoogleInlineError("Google account already exists. Please log in instead.");
            return;
          }

          if (msg.includes("username") && (msg.includes("exist") || msg.includes("taken") || msg.includes("already"))) {
            setFieldErrors((prev) => ({ ...prev, username: "Username is taken." }));
            return;
          }

          if (
            msg.includes("student") &&
            msg.includes("number") &&
            (msg.includes("exist") || msg.includes("taken") || msg.includes("already"))
          ) {
            setFieldErrors((prev) => ({ ...prev, studentNumber: "Student number is taken." }));
            return;
          }

          setGoogleInlineError(serverMsg);
          return;
        }

        // ✅ After Google signup: DO NOT log in. Redirect to Login.
        navigate("/login", {
          state: { signupSuccess: "Account creation successful. Please log in." },
        });
      } catch (err) {
        setGoogleInlineError(err?.message || "Google sign up failed");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();

    await requireTermsThen(async () => {
      const requiredKeys = [
        "firstName",
        "lastName",
        "email",
        "username",
        "course",
        "studentNumber",
        "password",
        "confirmPassword",
      ];

      const okRequired = validateRequired(requiredKeys);
      if (!okRequired) return;

      if (requiredKeys.some((k) => Boolean(fieldErrors?.[k]))) return;

      if (!isValidEmailFormat(form.email)) {
        setFieldErrors((prev) => ({
          ...prev,
          email: "Email is invalid. Please try again.",
        }));
        return;
      }

      if ((form.username || "").trim().length < 6) {
        setFieldErrors((prev) => ({
          ...prev,
          username: "Username must be at least 6 characters.",
        }));
        return;
      }

      if (!isValidStudentNumberFormat(form.studentNumber)) {
        setFieldErrors((prev) => ({
          ...prev,
          studentNumber: "Invalid, please try again.",
        }));
        return;
      }

      if ((form.password || "").length < 8) {
        setFieldErrors((prev) => ({
          ...prev,
          password: "Password must be at least 8 characters.",
        }));
        return;
      }

      if (form.password !== form.confirmPassword) {
        setFieldErrors((prev) => ({
          ...prev,
          confirmPassword: "Passwords do not match.",
        }));
        return;
      }

      setLoading(true);

      try {
        const fullName = [form.firstName, form.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();

        const payload = {
          fullName,
          firstName: (form.firstName || "").trim(),
          lastName: (form.lastName || "").trim(),
          email: (form.email || "").trim(),
          username: (form.username || "").trim(),
          course: (form.course || "").trim(),
          studentNumber: (form.studentNumber || "").trim(),
          password: form.password,
        };

        const { res, data, raw } = await fetchJsonSafe(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const serverMsg = (data?.message || raw || "Signup failed.").toString();
          const msg = serverMsg.toLowerCase();

          if (msg.includes("email") && (msg.includes("exist") || msg.includes("taken") || msg.includes("already"))) {
            setFieldErrors((prev) => ({ ...prev, email: "Email is taken." }));
            return;
          }

          if (msg.includes("username") && (msg.includes("exist") || msg.includes("taken") || msg.includes("already"))) {
            setFieldErrors((prev) => ({ ...prev, username: "Username is taken." }));
            return;
          }

          if (
            msg.includes("student") &&
            msg.includes("number") &&
            (msg.includes("exist") || msg.includes("taken") || msg.includes("already"))
          ) {
            setFieldErrors((prev) => ({ ...prev, studentNumber: "Student number is taken." }));
            return;
          }

          showErrorBanner(serverMsg);
          return;
        }

        navigate("/login", {
          state: { signupSuccess: "Account creation successful. Please log in." },
        });
      } catch (err) {
        showErrorBanner(err?.message || "Signup failed");
      } finally {
        setLoading(false);
      }
    });
  };

  const uiPatchStyles = `
    .google-btn-wrap { width: 100%; }
    .google-btn-wrap > * { width: 100%; }
    .google-btn-wrap button,
    .google-btn-wrap a,
    .google-btn-wrap [role="button"] {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  `;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background:
          "radial-gradient(1400px 820px at 14% 12%, rgba(185,255,102,0.55) 0%, rgba(214,255,173,0.28) 36%, rgba(255,255,255,0) 74%), radial-gradient(1200px 760px at 78% 40%, rgba(214,255,173,0.38) 0%, rgba(236,255,223,0.20) 42%, rgba(255,255,255,0) 78%), linear-gradient(#ffffff,#ffffff)",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: uiPatchStyles }} />

      <TermsModal
        open={showTerms}
        onClose={() => {
          pendingActionRef.current = null;
          setShowTerms(false);
          setTermsChecked(false);
        }}
        onAgree={handleAgreeTerms}
        agreed={termsChecked}
        setAgreed={setTermsChecked}
        loading={termsLoading}
      />

      <div className="mx-auto w-full max-w-[1500px] px-[clamp(16px,3.4vw,90px)] pt-[clamp(22px,5vh,92px)] pb-[clamp(22px,5vh,56px)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[clamp(18px,3.2vw,64px)] lg:gap-x-[clamp(56px,7vw,160px)] items-start">
          {/* LEFT: SIGNUP */}
          <section
            className="w-full mx-auto lg:mx-0 lg:justify-self-start"
            style={{ maxWidth: "600px" }}
          >
            <div className="relative px-1 sm:px-0">
              <h1 className="text-[28px] sm:text-[36px] font-black tracking-[.22em] sm:tracking-[.26em] leading-tight text-black drop-shadow-sm">
                SIGN UP
              </h1>
              <p className="text-[13px] sm:text-[15px] text-black/80 mt-2">
                Create your account. It only takes a minute.
              </p>

              <div className="mt-6">
                <form className="flex flex-col gap-4" onSubmit={handleCreateAccount}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldInput
                      label="First Name"
                      value={form.firstName}
                      onChange={setField("firstName")}
                      disabled={loading}
                      paired
                      maxLength={INPUT_LIMITS.firstName}
                      autoComplete="given-name"
                      autoCapitalize="words"
                      errorText={fieldErrors.firstName}
                    />
                    <FieldInput
                      label="Last Name"
                      value={form.lastName}
                      onChange={setField("lastName")}
                      disabled={loading}
                      paired
                      maxLength={INPUT_LIMITS.lastName}
                      autoComplete="family-name"
                      autoCapitalize="words"
                      errorText={fieldErrors.lastName}
                    />
                  </div>

                  <FieldInput
                    label="Email"
                    value={form.email}
                    onChange={setField("email")}
                    disabled={loading}
                    maxLength={INPUT_LIMITS.email}
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    errorText={fieldErrors.email}
                  />

                  <FieldInput
                    label="Username"
                    value={form.username}
                    onChange={setField("username")}
                    disabled={loading}
                    maxLength={INPUT_LIMITS.username}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    errorText={fieldErrors.username}
                  />

                  <FieldInput
                    label="Student number"
                    value={form.studentNumber}
                    onChange={setField("studentNumber")}
                    disabled={loading}
                    maxLength={INPUT_LIMITS.studentNumber}
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    errorText={fieldErrors.studentNumber}
                  />

                  <CourseDropdown
                    label="Course"
                    value={form.course}
                    onChange={setField("course")}
                    options={COURSES}
                    disabled={loading}
                    errorText={fieldErrors.course}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <PasswordField
                      label="Password"
                      value={form.password}
                      onChange={setField("password")}
                      disabled={loading}
                      paired
                      maxLength={INPUT_LIMITS.password}
                      autoComplete="new-password"
                      errorText={fieldErrors.password}
                    />
                    <PasswordField
                      label="Confirm Password"
                      value={form.confirmPassword}
                      onChange={setField("confirmPassword")}
                      disabled={loading}
                      paired
                      maxLength={INPUT_LIMITS.confirmPassword}
                      autoComplete="new-password"
                      errorText={fieldErrors.confirmPassword}
                    />
                  </div>

                  {formBanner?.message ? (
                    <div
                      className={`rounded-[14px] border px-4 py-3 text-[13px] leading-snug ${
                        formBanner.variant === "success"
                          ? "border-green-500 bg-green-50 text-black"
                          : formBanner.variant === "error"
                            ? "border-red-500 bg-red-50 text-black"
                            : "border-black/10 bg-white text-black"
                      }`}
                    >
                      <div className="font-extrabold">{formBanner.title || "Notice"}</div>
                      <div className="mt-0.5 text-black/80">{formBanner.message}</div>
                    </div>
                  ) : null}

                  <div className="pt-1 flex flex-col gap-3">
                    <PrimaryButton className="w-full" disabled={loading} type="submit">
                      {loading ? (
                        <span className="inline-flex items-center gap-2 justify-center">
                          <Spinner />
                          Creating…
                        </span>
                      ) : (
                        "Create Account"
                      )}
                    </PrimaryButton>
                  </div>
                </form>

                <div className="mt-4">
                  <OrDivider />
                </div>

                <GoogleButton
                  onClick={(e) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    handleGoogleSignup();
                  }}
                  loading={loading}
                  disabled={loading}
                  label="Sign up with Google"
                  className="w-full"
                />

                {googleInlineError ? (
                  <div className="mt-3 rounded-[14px] border-2 border-red-600 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">
                    <span>{googleInlineError}</span>{" "}
                    <Link to="/login" className="underline underline-offset-4 font-extrabold">
                      Login
                    </Link>
                  </div>
                ) : null}

                <div className="flex items-center justify-between text-[13px] pt-2">
                  <span className="text-black/60">Already have an account?</span>
                  <Link to="/login" className="font-bold underline underline-offset-4">
                    Login
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: DOME */}
          <section className="hidden lg:flex items-start justify-center self-stretch lg:pl-8 xl:pl-12">
            <div className="w-full h-full flex items-start justify-center" style={{ minHeight: "620px" }}>
              <div
                className="w-full"
                style={{
                  width: "min(145%, 1000px)",
                  height: "min(calc(100vh - 140px), 1000px)",
                  aspectRatio: "1 / 1",
                  transform: "translateY(-26px)",
                }}
              >
                <DomeGallery
                  className="w-full h-full"
                  autoRotate
                  autoRotateDegPerSec={10}
                  autoRotateIdleDelayMs={2000}
                  disableInteractionMaxWidth={1024}
                  viewerFrameShiftEnabled={false}
                  fit={0.62}
                  fitBasis="min"
                  minRadius={500}
                  maxRadius={700}
                  padFactor={0.08}
                  showBackdrop={false}
                  showVignette={false}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
