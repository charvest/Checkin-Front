// src/pages/Login.js

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useGesture } from "@use-gesture/react";

import PrimaryButton from "../components/PrimaryButton";
import GoogleButton from "../components/GoogleButton";

import { signInWithGoogle } from "../auth";
import { getToken, getUser, setAuth } from "../utils/auth";

import poster1 from "../assets/poster1.png";
import poster2 from "../assets/poster2.png";
import poster3 from "../assets/poster3.png";
import poster4 from "../assets/poster4.png";
import poster5 from "../assets/poster5.png";
import poster6 from "../assets/poster6.png";
import poster7 from "../assets/poster7.png";
import poster8 from "../assets/poster8.png";

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
  fit = 0.62,
  fitBasis = "min",
  minRadius = 500,
  maxRadius = 700,
  padFactor = 0.08,
  maxVerticalRotationDeg = 6,
  dragSensitivity = 20,
  enlargeTransitionMs = 260,
  segments = 20,
  dragDampening = 2,
  openedImageBorderRadius = "18px",
  imageBorderRadius = "18px",
  grayscale = false,
  colorFilter = "saturate(1.15) contrast(1.06)",
  autoRotate = true,
  autoRotateDegPerSec = 10,
  autoRotateIdleDelayMs = 2000,
  disableInteractionMaxWidth = 1024,
  viewerFrameShiftEnabled = false,

  className = "",
  showBackdrop = false,
  showVignette = false,
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

  const items = useMemo(() => dgBuildItems(images, segments), [images, segments]);

  const [interactionsDisabled, setInteractionsDisabled] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    const mqSmall = window.matchMedia(`(max-width: ${disableInteractionMaxWidth}px)`);
    const mqTouch = window.matchMedia("(hover: none) and (pointer: coarse)");
    return mqSmall.matches || mqTouch.matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mqSmall = window.matchMedia(`(max-width: ${disableInteractionMaxWidth}px)`);
    const mqTouch = window.matchMedia("(hover: none) and (pointer: coarse)");
    const recompute = () => setInteractionsDisabled(mqSmall.matches || mqTouch.matches);

    if (mqSmall.addEventListener) mqSmall.addEventListener("change", recompute);
    else mqSmall.addListener(recompute);

    if (mqTouch.addEventListener) mqTouch.addEventListener("change", recompute);
    else mqTouch.addListener(recompute);

    recompute();

    return () => {
      if (mqSmall.removeEventListener) mqSmall.removeEventListener("change", recompute);
      else mqSmall.removeListener(recompute);

      if (mqTouch.removeEventListener) mqTouch.removeEventListener("change", recompute);
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
      root.style.setProperty("--image-filter", grayscale ? "grayscale(1)" : "none");
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
      const desiredFromViewport = Math.min(window.innerWidth, window.innerHeight) - viewerPad * 2;

      let size = Math.min(desiredFromFrame, desiredFromViewport, safeW, safeH, 900);
      size = Math.max(size, 320);

      const centerX = frameR ? frameR.left + frameR.width / 2 : safeMinX + safeW / 2;
      const centerY = frameR ? frameR.top + frameR.height / 2 : safeMinY + safeH / 2;

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

      onDrag: ({ event, last, velocity: velArr = [0, 0], direction: dirArr = [0, 0], movement }) => {
        if (interactionsDisabled) return;
        if (focusedElRef.current || !draggingRef.current || !startPosRef.current) return;

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

        if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001 && Array.isArray(movement)) {
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
      background: ${showBackdrop ? `
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
      ` : "none"};
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

    .sphere-root:not([data-interactions="off"]) .item__image:active {
      transform: translateZ(0) scale(0.99);
    }

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
      opacity: ${showVignette ? "1" : "0"};
      background:
        radial-gradient(circle at 50% 50%,
          rgba(255,255,255,0.00) 58%,
          rgba(185,255,102,0.12) 78%,
          rgba(185,255,102,0.26) 100%
        );
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
                    <img src={it.src} draggable={false} alt={it.alt} className="dg-tile-img" />
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
  UI (LOCAL)
====================== */

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

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
  errorText,
  placeholder = "",
  rightSlot,
  rightSlotWidth = 44,
  autoComplete,
}) {
  const err = formatFieldError(errorText);
  const showInlineRequired = Boolean(err) && !String(value || "").trim();

  const effectivePlaceholder = showInlineRequired ? err : placeholder;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-end justify-between gap-3">
        <span className="block text-[13px] font-extrabold text-black/90">
          {label}
        </span>
      </div>

      <div className="relative">
        <input
          value={value}
          onChange={onChange}
          type={type}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={Boolean(errorText)}
          placeholder={effectivePlaceholder}
          className={`
            w-full rounded-[14px] border-2 bg-white
            px-4 py-3 sm:py-[14px]
            text-[14px] sm:text-[15px]
            focus:outline-none focus:ring-2 focus:ring-black/20
            placeholder:text-black/40
            ${
              showInlineRequired
                ? "placeholder:text-red-600 placeholder:font-extrabold"
                : ""
            }
            ${disabled ? "opacity-60 cursor-not-allowed" : ""}
            ${errorText ? "border-red-600" : "border-black"}
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

      {err && !showInlineRequired ? (
        <p className="mt-1 text-[12px] font-extrabold text-red-600">{err}</p>
      ) : (
        <div className="mt-1 h-[18px]" />
      )}
    </div>
  );
}

function PasswordField({ label, value, onChange, disabled, errorText }) {
  const [show, setShow] = useState(false);

  return (
    <FieldInput
      label={label}
      value={value}
      onChange={onChange}
      type={show ? "text" : "password"}
      disabled={disabled}
      errorText={errorText}
      placeholder="********"
      autoComplete="current-password"
      rightSlotWidth={54}
      rightSlot={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="h-10 w-10 rounded-[12px] grid place-items-center hover:bg-black/5"
          aria-label={show ? "Hide password" : "Show password"}
          disabled={disabled}
        >
          <span className="text-black/70">
            <EyeIcon open={show} />
          </span>
        </button>
      }
    />
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px bg-black/15 flex-1" />
      <span className="text-[11px] font-extrabold tracking-[0.22em] text-black/55">
        OR
      </span>
      <div className="h-px bg-black/15 flex-1" />
    </div>
  );
}

/* ======================
  TERMS MODAL (MATCH SIGNUP)
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
            Please review and accept to continue.
          </p>
        </div>

        <div
          className="p-5 sm:p-6 flex-1 min-h-0 overflow-y-auto text-[13px] sm:text-[14px] leading-relaxed text-black/75"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <p className="font-bold text-black/80 mb-2">Summary</p>
          <ul className="list-disc list-inside space-y-2">
            <li>CheckIn supports student well-being using journaling and PHQ-9 self-assessment.</li>
            <li>CheckIn is <span className="font-semibold">not</span> a diagnostic tool and does not replace professional care.</li>
            <li>Use the platform respectfully. Do not attempt unauthorized access or misuse.</li>
            <li>If you are in immediate danger, contact emergency services or your local hotline.</li>
          </ul>

          <div className="mt-5">
            <p className="font-bold text-black/80 mb-2">Full Terms</p>
            <p className="mb-3">By using CheckIn, you agree to use the platform only for lawful and appropriate purposes.</p>
            <p className="mb-3">CheckIn may store and process information you provide to deliver features and improve performance.</p>
            <p className="mb-3">CheckIn is provided “as is.” We cannot guarantee uninterrupted availability.</p>
            <p>We may update these terms when necessary. Continued use constitutes acceptance of updated terms.</p>
          </div>
        </div>

        <div className="p-5 sm:p-6 border-t border-black/10 bg-white shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <label className="flex items-center gap-2 text-[13px] font-bold">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="accent-greenBorder"
              disabled={loading}
            />
            I agree to the Terms & Conditions
          </label>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2 text-[13px] font-extrabold rounded-[12px] border-2 border-black bg-white hover:bg-black/5 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!agreed || loading}
              onClick={onAgree}
              className={`px-5 py-2 text-[13px] font-extrabold rounded-[12px] border-2 border-black flex items-center gap-2 justify-center ${
                agreed && !loading
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
  HELPERS
====================== */

function redirectByRole(navigate, role) {
  if (role === "Admin") return navigate("/admin");
  if (role === "Consultant") return navigate("/consultant");
  return navigate("/");
}

function isEmailLike(v) {
  return String(v || "").includes("@");
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const USERNAME_RE = /^[A-Za-z0-9._]+$/;

/* ======================
  API BASE
====================== */
const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");

/* ======================
  LOGIN PAGE
====================== */

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();

  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const msg = location?.state?.signupSuccess;
    if (msg) setSuccessMessage(String(msg));
  }, [location]);

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    emailOrUsername: "",
    password: "",
  });

  const [rememberMe, setRememberMe] = useState(true);
  const [pageError, setPageError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const pendingActionRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("termsAccepted") === "true";
    setTermsAccepted(saved);
    setTermsChecked(false);

    const token = getToken();
    const user = getUser();
    if (token && user?.role) redirectByRole(navigate, user.role);
  }, [navigate]);

  const setField = (key) => (e) => {
    const nextVal = e.target.value;
    setForm((p) => ({ ...p, [key]: nextVal }));
    setPageError("");

    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

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

  const validate = () => {
    const next = {};

    const id = String(form.emailOrUsername || "").trim();
    const pw = String(form.password || "").trim();

    if (!id) next.emailOrUsername = "Must be filled out";
    if (!pw) next.password = "Must be filled out";

    if (id) {
      if (isEmailLike(id)) {
        if (!EMAIL_RE.test(id)) next.emailOrUsername = "Email is invalid";
      } else {
        if (!USERNAME_RE.test(id)) {
          next.emailOrUsername =
            "Username can only contain letters, numbers, dot (.) and underscore (_)";
        }
      }
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleEmailLogin = async (e) => {
    e?.preventDefault?.();
    if (loading) return;

    const ok = validate();
    if (!ok) return;

    await requireTermsThen(async () => {
      if (loading) return;
      setLoading(true);
      setPageError("");

      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailOrUsername: form.emailOrUsername.trim(),
            password: form.password,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Login failed");

        setAuth({ token: data.token, user: data.user, rememberMe });
        redirectByRole(navigate, data.user?.role);
      } catch (err) {
        const msg = err?.message || "Login failed";

        if (/invalid|incorrect|wrong|credential|401/i.test(msg)) {
          setPageError("");
          setFieldErrors((p) => ({
            ...p,
            emailOrUsername: "Invalid username or password",
            password: "Invalid username or password",
          }));
          return;
        }

        setPageError(msg);
      } finally {
        setLoading(false);
      }
    });
  };

  const handleGoogleLogin = async () => {
    if (loading) return;

    await requireTermsThen(async () => {
      if (loading) return;
      setLoading(true);
      setPageError("");

      try {
        const firebaseUser = await signInWithGoogle();
        const u = firebaseUser?.user || firebaseUser;

        const payload = {
          intent: "login",
          googleId: u?.uid,
          email: u?.email,
          fullName: u?.displayName || u?.email?.split("@")?.[0] || "Google User",
        };

        const res = await fetch(`${API_BASE}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Google login failed");

        setAuth({ token: data.token, user: data.user, rememberMe });
        redirectByRole(navigate, data.user?.role);
      } catch (err) {
        setPageError(err?.message || "Google login failed");
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

      <div className="mx-auto w-full max-w-[1500px] px-[clamp(16px,3.4vw,90px)] pt-6 sm:pt-10 lg:pt-[clamp(132px,4vh,72px)] pb-[clamp(22px,5vh,56px)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[clamp(88px,3.2vw,64px)] lg:gap-x-[clamp(56px,7vw,160px)] items-start">
          {/* LEFT: LOGIN */}
          <section
            className="w-full mx-auto lg:mx-0 lg:justify-self-start"
            style={{ maxWidth: "600px" }}
          >
            <div className="relative  lg:gap-x-[clamp(56px,7vw,160px)] px-1 sm:px-0">
              <h1 className="text-[28px] sm:text-[36px] font-black tracking-[.22em] sm:tracking-[.26em] leading-tight text-black drop-shadow-sm">
                LOGIN
              </h1>
              <p className="text-[13px] sm:text-[15px] text-black/80 mt-2">
                Welcome back. Please enter your details.
              </p>

              {successMessage ? (
                <div className="mt-4 rounded-[16px] border-2 border-black bg-green-50 px-4 py-3 text-[13px] text-black">
                  <div className="font-extrabold">Account creation successful</div>
                  <div className="mt-0.5 text-black/80">{successMessage}</div>
                </div>
              ) : null}

              {pageError ? (
                <div className="mt-4 rounded-[16px] border-2 border-black bg-red-50 px-4 py-3 text-[13px] text-black">
                  <span className="font-extrabold">Error:</span> {pageError}
                </div>
              ) : null}

              <form
                className="mt-6 flex flex-col gap-4"
                onSubmit={handleEmailLogin}
              >
                <FieldInput
                  label="Email or Username"
                  value={form.emailOrUsername}
                  onChange={setField("emailOrUsername")}
                  disabled={loading}
                  errorText={fieldErrors.emailOrUsername}
                  placeholder="Enter your email or username"
                  autoComplete="username"
                />

                <PasswordField
                  label="Password"
                  value={form.password}
                  onChange={setField("password")}
                  disabled={loading}
                  errorText={fieldErrors.password}
                />

                <div className="flex items-center justify-between text-[13px] pt-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-greenBorder"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={loading}
                    />
                    Remember me
                  </label>

                  <button
                    type="button"
                    className="font-extrabold underline underline-offset-4 decoration-black/40 hover:decoration-black/80"
                    onClick={() => navigate("/forgotpassword")}
                    disabled={loading}
                  >
                    Forgot password
                  </button>
                </div>

                <div className="pt-1 flex flex-col gap-3">
                  <PrimaryButton
                    className="w-full"
                    disabled={loading}
                    type="submit"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner />
                        Logging in...
                      </span>
                    ) : (
                      "Login"
                    )}
                  </PrimaryButton>

                  <OrDivider />

                  <div className="google-btn-wrap">
                    <GoogleButton
                      onClick={(e) => {
                        e?.preventDefault?.();
                        e?.stopPropagation?.();
                        handleGoogleLogin();
                      }}
                      loading={loading}
                      disabled={loading}
                      className="w-full"
                    />
                  </div>
                </div>
              </form>

              <p className="text-[13px] text-black/80 mt-4">
                Don&apos;t have an account?{" "}
                <Link
                  to="/sign-up"
                  className="font-extrabold underline underline-offset-4 decoration-black/50 hover:decoration-black/80 whitespace-nowrap"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </section>

          {/* RIGHT: DOME (match signup) */}
          <section className="hidden lg:flex items-start justify-center self-stretch lg:pl-8 xl:pl-12">
            <div
              className="w-full h-full flex items-start justify-center"
              style={{ minHeight: "620px" }}
            >
              <div
                className="w-full"
                style={{
                  width: "min(145%, 1000px)",
                  height: "min(calc(100vh - 140px), 1000px)",
                  aspectRatio: "1 / 1",
                  transform: "translateY(-106px)",
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