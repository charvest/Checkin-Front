// src/components/GuidanceHero.js
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import friendImg from "../../assets/friend.png";

/** Match PHQ-9 palette */
const CHECKIN_GREEN = "#B9FF66";
const CHECKIN_DARK = "#141414";

/** Shared-ish text scale (lighter version of PHQ-9 tokens) */
const TXT = {
  base: "text-[16px] sm:text-[17px] leading-relaxed",
  xs: "text-[14px] sm:text-[15px]",
  sm: "text-[15px] sm:text-[16px]",
  lg: "text-[18px] sm:text-[20px]",
  xl: "text-[26px] sm:text-[36px] md:text-[34px] lg:text-[48px] leading-[1.08] tracking-tight",
};

/**
 * FadeUp
 * - IntersectionObserver-based reveal
 * - Respects prefers-reduced-motion
 */
function FadeUp({ children, delay = 0, once = true, className = "" }) {
  const elRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

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
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
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

/** Journal-aligned glass card (same feel as PHQ-9 GlassCard) */
function GlassCard({ children, className = "" }) {
  return (
    <div
      className={[
        "relative overflow-hidden",
        "rounded-[26px] border border-black/10",
        "bg-white/78 backdrop-blur-xl",
        "shadow-[0_18px_60px_rgba(0,0,0,0.08)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** Soft background FX (PHQ-9 inspired, static for performance) */
function BackgroundFX() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        className="absolute -top-40 -left-40 h-[560px] w-[560px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(185,255,102,0.95), rgba(185,255,102,0.00))`,
          opacity: 0.38,
        }}
      />
      <div
        className="absolute -top-44 -right-44 h-[680px] w-[680px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(218,252,182,0.95), rgba(218,252,182,0.00))`,
          opacity: 0.30,
        }}
      />
      <div
        className="absolute top-[18%] left-[18%] h-[720px] w-[720px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(211,243,176,0.85), rgba(211,243,176,0.00))`,
          opacity: 0.22,
        }}
      />
      {/* Dot grid mask like PHQ-9 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(0,0,0,0.35) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.08,
          maskImage: "radial-gradient(900px 520px at 30% 20%, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(900px 520px at 30% 20%, black 0%, transparent 70%)",
        }}
      />
      {/* Subtle scanline texture */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.05,
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(0,0,0,0.30) 0px, rgba(0,0,0,0.00) 1px, rgba(0,0,0,0.00) 3px),
            repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.00) 1px, rgba(0,0,0,0.00) 4px)
          `,
          mixBlendMode: "soft-light",
        }}
      />
    </div>
  );
}

export default function GuidanceHero({ showExtras = true }) {
  const navigate = useNavigate();

  return (
    <section
      className={`relative overflow-hidden ${TXT.base}`}
      style={{
        fontFamily:
          "Nunito, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        background: `
          radial-gradient(1100px 520px at 18% 0%, rgba(185,255,102,0.42) 0%, rgba(185,255,102,0.00) 58%),
          radial-gradient(980px 480px at 70% 6%, rgba(218,252,182,0.50) 0%, rgba(218,252,182,0.00) 62%),
          linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 58%, #F7F7F7 100%)
        `,
      }}
    >
      {/* Fonts (keep if not loaded globally) */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:wght@400;600;700&display=swap');`}</style>

      <BackgroundFX />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-10 pb-12 sm:pt-14 sm:pb-16 md:pt-16 md:pb-18 lg:pt-24 lg:pb-28">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10 md:gap-10 lg:gap-14 items-center md:items-start">
            {/* LEFT */}
            <div className="md:col-span-6 lg:col-span-5 space-y-6 sm:space-y-7 lg:space-y-9">
              <FadeUp>
                {/* PHQ-9 style pill */}
                <div
                  className={[
                    "inline-flex items-center gap-2.5 px-4 sm:px-5 py-2 rounded-full",
                    "bg-white/78 backdrop-blur border border-black/10",
                    "shadow-[0_10px_22px_rgba(0,0,0,0.04)]",
                    "font-extrabold text-black/70",
                    "text-xs sm:text-sm",
                  ].join(" ")}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: CHECKIN_GREEN, boxShadow: "0 0 0 3px rgba(185,255,102,0.18)" }}
                    aria-hidden="true"
                  />
                  Confidential • 24/7 Support
                </div>
              </FadeUp>

              <FadeUp delay={80}>
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
                      aria-hidden="true"
                    />
                  </span>
                </h1>
              </FadeUp>

              <FadeUp delay={160}>
                <p className={`text-black/60 ${TXT.lg} max-w-xl`}>
                  Connect with a caring guidance counselor — private, free, and always here when you need support.
                </p>
              </FadeUp>

              {showExtras && (
                <FadeUp delay={240}>
                  <div className="flex flex-wrap gap-2.5 sm:gap-3 pt-1">
                    {["Student-First", "Easy Scheduling", "100% Confidential"].map((label) => (
                      <span
                        key={label}
                        className={[
                          "px-3.5 sm:px-4 py-1.5 rounded-full",
                          "bg-white/78 backdrop-blur border border-black/10",
                          "shadow-[0_10px_26px_rgba(0,0,0,0.04)]",
                          "text-black/70 font-extrabold",
                          "text-xs sm:text-sm",
                        ].join(" ")}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </FadeUp>
              )}

              <FadeUp delay={340}>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-3 sm:pt-4">
                  {/* Primary button: PHQ-9-ish lime + dark */}
                  <button
                    type="button"
                    onClick={() => navigate("/services/counseling/request")}
                    className={[
                      "w-full sm:w-auto",
                      "px-6 sm:px-8 py-3.5 sm:py-4",
                      "rounded-full font-extrabold",
                      "transition active:scale-[0.99] hover:-translate-y-[1px]",
                      "border border-black/15",
                    ].join(" ")}
                    style={{
                      backgroundColor: CHECKIN_GREEN,
                      color: CHECKIN_DARK,
                      boxShadow: "0 18px 50px rgba(185,255,102,0.45)",
                    }}
                  >
                    Request a Session →
                  </button>

                  {/* Secondary button: glass / neutral */}
                  <button
                    type="button"
                    onClick={() => navigate("/services/counseling/requests")}
                    className={[
                      "w-full sm:w-auto",
                      "px-6 sm:px-8 py-3.5 sm:py-4",
                      "rounded-full font-extrabold",
                      "bg-white/78 backdrop-blur hover:bg-black/5 transition",
                      "border border-black/15",
                      "text-black/70",
                      "shadow-[0_14px_30px_rgba(0,0,0,0.05)]",
                    ].join(" ")}
                  >
                    View My Requests
                  </button>
                </div>
              </FadeUp>
            </div>

            {/* RIGHT */}
            <FadeUp
              delay={120}
              className="md:col-span-6 lg:col-span-7 flex justify-center md:justify-center lg:justify-end"
            >
              <div className="relative w-full max-w-[360px] sm:max-w-[460px] md:max-w-[420px] lg:max-w-[620px] pb-8 sm:pb-10">
                {/* Lime glow behind */}
                <div
                  className="absolute inset-0 rounded-[34px] blur-3xl -rotate-2 scale-105"
                  style={{
                    background:
                      "radial-gradient(720px 360px at 20% 10%, rgba(185,255,102,0.45), rgba(185,255,102,0.00) 65%)",
                  }}
                  aria-hidden="true"
                />

                <GlassCard className="p-3 sm:p-4">
                  {/* Image frame */}
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

                    {/* Subtle dark vignette for depth */}
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        boxShadow: "inset 0 -120px 120px rgba(0,0,0,0.10)",
                      }}
                      aria-hidden="true"
                    />
                  </div>
                </GlassCard>

                {/* Floating reassurance badge (PHQ-9 pill feel) */}
                <div
                  className="absolute -bottom-4 sm:-bottom-5 left-1/2 -translate-x-1/2 px-4 sm:px-7 py-2.5 sm:py-3 rounded-full shadow-lg max-w-[92%]"
                  style={{
                    background: "rgba(255,255,255,0.82)",
                    backdropFilter: "blur(14px)",
                    border: "1px solid rgba(0,0,0,0.10)",
                  }}
                >
                  <p className="text-sm sm:text-base font-extrabold text-black/70 whitespace-nowrap">
                    You&apos;re never alone <span className="text-red-500">♥</span>
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
