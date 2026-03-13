// src/components/GuidanceHero.js
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import friendImg from "../../assets/friend.png";

const CHECKIN_GREEN = "#B9FF66";
const CHECKIN_DARK = "#141414";
const GUIDANCE_TUTORIAL_KEY = "checkin:tutorial:guidance-counseling";

const TXT = {
  base: "text-[16px] sm:text-[17px] leading-relaxed",
  xs: "text-[14px] sm:text-[15px]",
  sm: "text-[15px] sm:text-[16px]",
  lg: "text-[18px] sm:text-[20px]",
  xl: "text-[26px] sm:text-[36px] md:text-[34px] lg:text-[48px] leading-[1.08] tracking-tight",
};

function readTutorialSeen(key) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markTutorialSeen(key) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore localStorage errors
  }
}

function getTutorialRect(node) {
  if (!node || typeof node.getBoundingClientRect !== "function") return null;

  const rect = node.getBoundingClientRect();

  return {
    top: Math.max(10, rect.top - 10),
    left: Math.max(10, rect.left - 10),
    width: Math.max(96, rect.width + 20),
    height: Math.max(52, rect.height + 20),
  };
}

function ServiceTutorialOverlay({ open, steps, stepIndex, onNext, onSkip }) {
  const step = steps?.[stepIndex] || null;
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!open || !step?.targetRef?.current) {
      setRect(null);
      return undefined;
    }

    const target = step.targetRef.current;

    const update = () => {
      setRect(getTutorialRect(target));
    };

    target.scrollIntoView?.({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });

    update();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step]);

  if (!open || !step) return null;

  const isLast = stepIndex === steps.length - 1;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 720;
  const cardWidth = Math.min(360, viewportW - 32);

  const cardTop = rect
    ? rect.top + rect.height + 18 + 210 > viewportH
      ? Math.max(18, rect.top - 198)
      : rect.top + rect.height + 18
    : 24;

  const cardLeft = rect
    ? Math.min(Math.max(16, rect.left), viewportW - cardWidth - 16)
    : 16;

  return (
    <div className="fixed inset-0 z-[140]">
      <button
        type="button"
        aria-label="Skip tutorial"
        onClick={onSkip}
        className="absolute inset-0 bg-black/25"
      />

      {rect && (
        <div
          className="pointer-events-none fixed rounded-[26px] border border-white/80 transition-all duration-200"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px rgba(20,20,20,0.42)",
          }}
        />
      )}

      <div
        className="fixed rounded-[26px] border border-white/15 bg-[#141414] text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] p-5 sm:p-6"
        style={{
          top: cardTop,
          left: cardLeft,
          width: cardWidth,
          maxWidth: "calc(100vw - 32px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Guidance counseling tutorial"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.16em] text-white/55">
              Step {stepIndex + 1} of {steps.length}
            </div>

            <div className="mt-2 text-[18px] font-black leading-tight">
              {step.title}
            </div>

            <p className="mt-2 text-[14px] leading-relaxed text-white/78">
              {step.description}
            </p>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-black text-white/80 transition hover:bg-white/10"
            aria-label="Close tutorial"
          >
            ×
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-[14px] font-extrabold text-white/82 transition hover:bg-white/10"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={onNext}
            className="rounded-full px-5 py-2.5 text-[14px] font-extrabold transition"
            style={{
              backgroundColor: CHECKIN_GREEN,
              color: CHECKIN_DARK,
              boxShadow: "0 16px 40px rgba(185,255,102,0.28)",
            }}
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FadeUp({ children, delay = 0, once = true, className = "" }) {
  const elRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  return (
    <div
      ref={elRef}
      className={[
        "transition-all duration-700 ease-out will-change-transform",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className,
      ].join(" ")}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[26px] border border-black/10",
        "bg-white/78 backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.08)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function BackgroundFX() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        className="absolute -top-40 -left-40 h-[560px] w-[560px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(185,255,102,0.95), transparent)`,
          opacity: 0.38,
        }}
      />
      <div
        className="absolute -top-44 -right-44 h-[680px] w-[680px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(218,252,182,0.95), transparent)`,
          opacity: 0.3,
        }}
      />
      <div
        className="absolute top-[18%] left-[18%] h-[720px] w-[720px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(211,243,176,0.85), transparent)`,
          opacity: 0.22,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(0,0,0,0.35) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.08,
          maskImage:
            "radial-gradient(900px 520px at 30% 20%, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(900px 520px at 30% 20%, black 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.05,
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(0,0,0,0.30) 0px, transparent 1px, transparent 3px),
            repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0px, transparent 1px, transparent 4px)
          `,
          mixBlendMode: "soft-light",
        }}
      />
    </div>
  );
}

export default function GuidanceHero({ showExtras = true }) {
  const navigate = useNavigate();

  const headingRef = useRef(null);
  const requestRef = useRef(null);
  const requestsRef = useRef(null);
  const supportRef = useRef(null);

  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const tutorialSteps = useMemo(
    () => [
      {
        targetRef: headingRef,
        title: "Welcome to Guidance Counseling",
        description:
          "This page is where you start if you want to talk to a counselor or learn what the service is for.",
      },
      {
        targetRef: requestRef,
        title: "Request a session",
        description:
          "Use this button to open the counseling request form and choose a session that fits your needs.",
      },
      {
        targetRef: requestsRef,
        title: "View your requests",
        description:
          "Check your submitted counseling requests here so you can track their status anytime.",
      },
      {
        targetRef: supportRef,
        title: "Quick support guide",
        description:
          "These reminders explain that the service is private, student-friendly, and designed to make scheduling easy.",
      },
    ],
    [],
  );

  useEffect(() => {
    if (readTutorialSeen(GUIDANCE_TUTORIAL_KEY)) return;

    const id = window.setTimeout(() => {
      setTutorialOpen(true);
      setTutorialStep(0);
    }, 500);

    return () => window.clearTimeout(id);
  }, []);

  const closeTutorial = () => {
    markTutorialSeen(GUIDANCE_TUTORIAL_KEY);
    setTutorialOpen(false);
    setTutorialStep(0);
  };

  const nextTutorialStep = () => {
    if (tutorialStep >= tutorialSteps.length - 1) {
      closeTutorial();
      return;
    }

    setTutorialStep((prev) => prev + 1);
  };

  return (
    <section
      className={`relative overflow-hidden ${TXT.base}`}
      style={{
        fontFamily: "Nunito, system-ui, -apple-system, sans-serif",
        background: `
          radial-gradient(1100px 520px at 18% 0%, rgba(185,255,102,0.42) 0%, transparent 58%),
          radial-gradient(980px 480px at 70% 6%, rgba(218,252,182,0.50) 0%, transparent 62%),
          linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 58%, #F7F7F7 100%)
        `,
        backgroundAttachment: "fixed",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:wght@400;600;700&display=swap');`}</style>

      <BackgroundFX />

      <ServiceTutorialOverlay
        open={tutorialOpen}
        steps={tutorialSteps}
        stepIndex={tutorialStep}
        onNext={nextTutorialStep}
        onSkip={closeTutorial}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-16 sm:py-20 md:py-24 lg:py-28">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 lg:gap-14 items-center">
            {/* LEFT */}
            <div className="md:col-span-6 lg:col-span-5 space-y-6 md:space-y-8">
              <FadeUp>
                <div
                  ref={supportRef}
                  className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/78 backdrop-blur border border-black/10 shadow-[0_10px_22px_rgba(0,0,0,0.04)] font-extrabold text-black/70 text-xs sm:text-sm"
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor: CHECKIN_GREEN,
                      boxShadow: "0 0 0 3px rgba(185,255,102,0.18)",
                    }}
                  />
                  Confidential • 24/7 Support
                </div>
              </FadeUp>

              <FadeUp delay={80}>
                <div ref={headingRef}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1
                      className={`font-black text-[#141414] ${TXT.xl}`}
                      style={{ fontFamily: "Lora, serif" }}
                    >
                      Talk to someone who{" "}
                      <span className="relative inline-block">
                        really gets it
                        <span
                          className="absolute -bottom-2 left-0 right-0 h-2.5 sm:h-3 -z-10 rounded-full"
                          style={{ background: "rgba(185,255,102,0.55)" }}
                        />
                      </span>
                    </h1>

                    <button
                      type="button"
                      onClick={() => {
                        setTutorialStep(0);
                        setTutorialOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/78 px-4 py-2 text-[13px] font-extrabold text-black/70 hover:bg-black/5 transition"
                    >
                      ℹ️ Instructions
                    </button>
                  </div>
                </div>
              </FadeUp>

              <FadeUp delay={160}>
                <p className={`text-black/60 ${TXT.lg} max-w-xl`}>
                  Connect with a caring guidance counselor — private, free, and
                  always here when you need support.
                </p>
              </FadeUp>

              {showExtras && (
                <FadeUp delay={240}>
                  <div className="flex flex-wrap gap-3 pt-2">
                    {[
                      "Student-First",
                      "Easy Scheduling",
                      "100% Confidential",
                    ].map((label) => (
                      <span
                        key={label}
                        className="px-4 py-1.5 rounded-full bg-white/78 backdrop-blur border border-black/10 shadow-[0_10px_26px_rgba(0,0,0,0.04)] text-black/70 font-extrabold text-xs sm:text-sm"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </FadeUp>
              )}

              <FadeUp delay={340}>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button
                    ref={requestRef}
                    type="button"
                    onClick={() => navigate("/services/counseling/request")}
                    className="w-full sm:w-auto px-8 py-4 rounded-full font-extrabold transition active:scale-99 hover:-translate-y-px border border-black/15"
                    style={{
                      backgroundColor: CHECKIN_GREEN,
                      color: CHECKIN_DARK,
                      boxShadow: "0 18px 50px rgba(185,255,102,0.45)",
                    }}
                  >
                    Request a Session →
                  </button>

                  <button
                    ref={requestsRef}
                    type="button"
                    onClick={() => navigate("/services/counseling/requests")}
                    className="w-full sm:w-auto px-8 py-4 rounded-full font-extrabold bg-white/78 backdrop-blur hover:bg-black/5 transition border border-black/15 text-black/70 shadow-[0_14px_30px_rgba(0,0,0,0.05)]"
                  >
                    View My Requests
                  </button>
                </div>
              </FadeUp>
            </div>

            {/* RIGHT - image side */}
            <FadeUp
              delay={120}
              className="md:col-span-6 lg:col-span-7 flex justify-center lg:justify-end"
            >
              <div className="relative w-full max-w-[380px] sm:max-w-[460px] md:max-w-[420px] lg:max-w-[580px]">
                <div
                  className="absolute inset-0 rounded-[34px] blur-3xl -rotate-2 scale-105"
                  style={{
                    background:
                      "radial-gradient(720px 360px at 20% 10%, rgba(185,255,102,0.45), transparent 65%)",
                  }}
                />

                <GlassCard className="p-3 sm:p-4">
                  <div className="relative rounded-[22px] overflow-hidden border border-black/10 bg-white">
                    <div className="block sm:hidden aspect-[4/3]">
                      <img
                        src={friendImg}
                        alt="Friendly counseling session"
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                    <img
                      src={friendImg}
                      alt="Friendly counseling session"
                      className="hidden sm:block w-full h-auto object-cover"
                      draggable={false}
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        boxShadow: "inset 0 -120px 120px rgba(0,0,0,0.10)",
                      }}
                    />
                  </div>
                </GlassCard>

                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg bg-white/82 backdrop-blur border border-black/10 max-w-[92%]">
                  <p className="text-sm sm:text-base font-extrabold text-black/70 whitespace-nowrap">
                    You're never alone <span className="text-red-500">♥</span>
                  </p>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
