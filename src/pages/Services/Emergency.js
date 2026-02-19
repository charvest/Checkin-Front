// src/pages/Services/Emergency.js
import { useEffect, useMemo, useRef, useState } from "react";

import HotImg from "../../assets/hot.png";
import GuidanceImg from "../../assets/Guidance.png";

function useInView(options = { threshold: 0.18, root: null, rootMargin: "0px" }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  const threshold = options?.threshold ?? 0.18;
  const root = options?.root ?? null;
  const rootMargin = options?.rootMargin ?? "0px";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(el);
        }
      },
      { threshold, root, rootMargin }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, root, rootMargin]);

  return [ref, inView];
}

function normalizeTel(input) {
  const s = String(input || "").trim();
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/** --- Minimal doodles --- */
function DoodleSpark({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M60 10l8 20 20 8-20 8-8 20-8-20-20-8 20-8 8-20Z"
        stroke="#141414"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M18 88c14-10 32-10 46 0"
        stroke="#141414"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="2 10"
      />
    </svg>
  );
}

function DoodleWave({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 48c22-22 46 22 68 0s46 22 68 0 46 22 68 0"
        stroke="#141414"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DoodleHeart({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M60 98C26 72 14 56 14 38c0-13 10-23 23-23 10 0 18 6 23 14 5-8 13-14 23-14 13 0 23 10 23 23 0 18-12 34-46 60Z"
        stroke="#141414"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** SVG Icons */
function PhoneIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none">
      <path
        d="M6.6 10.8c1.7 3.2 3.4 4.9 6.6 6.6l2.2-2.2c.3-.3.8-.4 1.2-.2 1 .4 2.2.7 3.4.8.5.1.9.5.9 1v3.5c0 .6-.5 1-1.1 1C11 21.3 2.7 13 2.7 2.2c0-.6.4-1.1 1-1.1h3.5c.5 0 .9.4 1 1 .2 1.2.4 2.3.8 3.4.2.4.1.9-.2 1.2L6.6 10.8Z"
        stroke="#141414"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none">
      <path
        d="M12 2l8 4v7c0 5-3.6 8.7-8 9-4.4-.3-8-4-8-9V6l8-4Z"
        stroke="#141414"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 7v6" stroke="#141414" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17h.01" stroke="#141414" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SchoolIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} fill="none">
      <path
        d="M12 3l10 5-10 5L2 8l10-5Z"
        stroke="#141414"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M6 11v6c0 2 3 4 6 4s6-2 6-4v-6"
        stroke="#141414"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M22 8v6" stroke="#141414" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Card shell */
function Card({ children, className = "" }) {
  return (
    <div
      className={[
        "relative h-full rounded-[18px] border border-black/15 bg-white",
        "shadow-[0_10px_22px_rgba(0,0,0,0.06)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function HeroGlow() {
  return (
    <div
      className={[
        "absolute -inset-6",
        "rounded-[999px]",
        "bg-[#B9FF66]/35",
        "blur-3xl",
        "opacity-70",
        "pointer-events-none",
      ].join(" ")}
      aria-hidden="true"
    />
  );
}

function EmergencyCard({ item, delay = 0, variant = "default" }) {
  const [ref, inView] = useInView({ threshold: 0.25 });

  const safeTel = normalizeTel(item.tel || "");
  const href = item.mode === "call" ? `tel:${safeTel}` : item.href || "#";
  const isFeatured = variant === "featured";

  const heroOverflow = item?.hero?.overflow || "inside"; // "inside" | "outside"
  const heroGlow = Boolean(item?.hero?.glow);

  const cardOverflowClass = isFeatured
    ? heroOverflow === "outside"
      ? "overflow-visible"
      : "overflow-hidden"
    : "overflow-hidden";

  return (
    <div
      ref={ref}
      className={isFeatured ? "w-full max-w-[980px] mx-auto" : "w-full h-full"}
      style={{
        transform: inView ? "translateY(0)" : "translateY(10px)",
        opacity: inView ? 1 : 0,
        transitionDelay: `${delay}ms`,
        transitionProperty: "transform, opacity",
        transitionDuration: "600ms",
        transitionTimingFunction: "cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <Card className={cardOverflowClass}>
        <DoodleSpark className="absolute -top-6 -right-6 w-[120px] opacity-[0.10] pointer-events-none" />

        {isFeatured ? (
          <div className="p-4 sm:p-6 md:p-8">
            <div className="grid gap-10 md:grid-cols-[1fr_360px] md:items-stretch md:gap-10 md:min-h-[340px]">
              {/* Left: content + CTA pushed down */}
              <div className="min-w-0 flex flex-col h-full">
                <div className="min-w-0">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="shrink-0">
                      <div className="w-[48px] h-[48px] sm:w-[54px] sm:h-[54px] rounded-[14px] border border-black/20 bg-[#B9FF66] flex items-center justify-center">
                        {item.icon}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[10px] sm:text-[12px] font-extrabold tracking-wide uppercase text-black/45"
                        style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
                      >
                        {item.tag}
                      </p>

                      <h3
                        className="mt-0.5 text-[18px] sm:text-[26px] font-bold leading-tight text-[#141414] break-words"
                        style={{ fontFamily: "Lora, serif" }}
                      >
                        {item.title}
                      </h3>

                      {item.subtext ? (
                        <div className="mt-2">
                          <span
                            className="inline-flex items-center rounded-full border border-black/10 bg-[#B9FF66]/25 px-3 py-1 text-[12px] sm:text-[13px] font-extrabold text-[#141414]"
                            style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
                          >
                            {item.subtext}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <p
                    className="mt-3 text-[13px] sm:text-[15px] text-black/65 leading-relaxed break-words max-w-[72ch]"
                    style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
                  >
                    {item.desc}
                  </p>
                </div>

                <div className="mt-6 md:mt-auto pt-2 md:pt-6">
                  <a
                    href={href}
                    aria-label={item.mode === "call" ? `Call ${item.title}` : item.primaryLabel}
                    className={[
                      "w-full sm:w-auto sm:min-w-[240px]",
                      "inline-flex items-center justify-center gap-2",
                      "rounded-full border border-black/20 bg-[#B9FF66]",
                      "px-4 py-3 min-h-[48px]",
                      "text-[14px] sm:text-[15px] font-extrabold text-[#141414]",
                      "whitespace-normal break-words text-center leading-snug",
                      "hover:-translate-y-[1px] hover:shadow-[0_14px_20px_rgba(0,0,0,0.10)] hover:brightness-[0.99]",
                      "active:scale-[0.99] transition",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2",
                    ].join(" ")}
                    style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
                  >
                    <PhoneIcon className="w-5 h-5 shrink-0" />
                    <span>{item.primaryLabel}</span>
                  </a>

                  <div className="flex justify-start">
                    <DoodleWave className="mt-4 w-[190px] opacity-[0.10]" />
                  </div>
                </div>
              </div>

              {/* Right: hero image (right + top overflow) */}
              <div className="relative flex h-full items-center justify-center md:justify-end">
                {item.assetImg ? (
                  <div
                    className={[
                      "relative w-full",
                      "md:w-[420px]",
                      heroOverflow === "outside" ? "md:-mr-12" : "md:-mr-6",
                      heroOverflow === "outside" ? "md:-mt-12" : "md:mt-2",
                      heroOverflow === "outside" ? "z-10" : "z-0",
                    ].join(" ")}
                  >
                    {heroGlow ? <HeroGlow /> : null}

                    <img
                      src={item.assetImg}
                      alt=""
                      className={[
                        "relative z-[1]",
                        "w-full h-auto select-none object-contain",
                        "max-h-[200px] sm:max-h-[240px] md:max-h-[360px]",
                        "md:scale-[1.08]",
                        "opacity-[0.98]",
                      ].join(" ")}
                      loading="lazy"
                      draggable={false}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          // Default cards unchanged
          <div className="h-full grid grid-rows-[auto_1fr_auto] p-4 sm:p-6 min-h-[250px] sm:min-h-[270px]">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="shrink-0">
                <div className="w-[42px] h-[42px] sm:w-[46px] sm:h-[46px] rounded-[14px] border border-black/20 bg-[#B9FF66] flex items-center justify-center">
                  {item.icon}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="text-[10px] sm:text-[12px] font-extrabold tracking-wide uppercase text-black/45"
                  style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
                >
                  {item.tag}
                </p>

                <h3
                  className="mt-0.5 text-[15px] sm:text-[20px] font-bold leading-tight text-[#141414] break-words"
                  style={{ fontFamily: "Lora, serif" }}
                >
                  {item.title}
                </h3>

                {item.subtext ? (
                  <div className="mt-2">
                    <span
                      className="inline-flex items-center rounded-full border border-black/10 bg-[#B9FF66]/25 px-3 py-1 text-[11px] sm:text-[12.5px] font-extrabold text-[#141414]"
                      style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
                    >
                      {item.subtext}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <p
              className="mt-3 text-[12.5px] sm:text-[14px] text-black/65 leading-relaxed break-words"
              style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
            >
              {item.desc}
            </p>

            <div className="mt-4">
              <a
                href={href}
                aria-label={item.mode === "call" ? `Call ${item.title}` : item.primaryLabel}
                className={[
                  "w-full",
                  "inline-flex items-center justify-center gap-2",
                  "rounded-full border border-black/20 bg-[#B9FF66]",
                  "px-4 py-3 min-h-[48px]",
                  "text-[13px] sm:text-[14px] font-extrabold text-[#141414]",
                  "whitespace-normal break-words text-center leading-snug",
                  "hover:-translate-y-[1px] hover:shadow-[0_14px_20px_rgba(0,0,0,0.10)] hover:brightness-[0.99]",
                  "active:scale-[0.99] transition",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2",
                ].join(" ")}
                style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
              >
                <PhoneIcon className="w-5 h-5 shrink-0" />
                <span>{item.primaryLabel}</span>
              </a>

              <DoodleWave className="mt-4 w-[190px] opacity-[0.10]" />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Emergency() {
  const [heroRef, heroInView] = useInView({ threshold: 0.2 });

  const sections = useMemo(
    () => [
      {
        title: "For students & campus concerns",
        subtitle: "Campus-based help when you're safe.",
        items: [
          {
            tag: "Campus Support",
            title: "Guidance / Counselor Office (AUP)",
            subtext: "Student-first",
            desc: "If you need support, reach out to the Guidance Office for counseling and referrals.",
            icon: <SchoolIcon className="w-6 h-6" />,
            mode: "call",
            tel: "85797295",
            primaryLabel: "Call Guidance",
            assetImg: GuidanceImg,
            hero: { overflow: "outside", glow: true }, // ✅ outside => right+top pop
          },
        ],
      },
      {
        title: "Urgent emergency",
        subtitle: "Call now if someone is in immediate danger.",
        items: [
          {
            tag: "Emergency",
            title: "National Emergency Hotline",
            subtext: "Immediate danger",
            desc: "Call for life-threatening emergencies and share your location.",
            icon: <ShieldIcon className="w-6 h-6" />,
            mode: "call",
            tel: "911",
            primaryLabel: "Call 911",
            assetImg: HotImg,
            hero: { overflow: "outside", glow: true },
          },
        ],
      },
      {
        title: "Crisis & mental health support (PH)",
        subtitle: "Confidential support anytime you need it.",
        items: [
          {
            tag: "Mental Health",
            title: "NCMH Crisis Hotline",
            subtext: "24/7 support",
            desc:
              "Crisis support and referral. If you can’t connect: 0919-057-1553 (Smart/TNT) • 0917-899-8727 (Globe/TM).",
            icon: <DoodleHeart className="w-6 h-6" />,
            mode: "call",
            tel: "1553",
            primaryLabel: "Call 1553",
          },
          {
            tag: "Crisis Support",
            title: "In Touch: Crisis Line",
            subtext: "Confidential",
            desc: "Free and confidential emotional support with trained responders.",
            icon: <ShieldIcon className="w-6 h-6" />,
            mode: "call",
            tel: "+63288937603",
            primaryLabel: "Call In Touch",
          },
          {
            tag: "Suicide Prevention",
            title: "HOPELINE",
            subtext: "Crisis support",
            desc: "Suicide prevention support. Also: 0917-558-4673 • 0918-873-4673.",
            icon: <DoodleHeart className="w-6 h-6" />,
            mode: "call",
            tel: "+63288044673",
            primaryLabel: "Call Hopeline",
          },
          {
            tag: "Child Protection",
            title: "Bantay Bata Helpline",
            subtext: "Child safety",
            desc: "For child-related concerns (abuse, neglect, violence, guidance).",
            icon: <ShieldIcon className="w-6 h-6" />,
            mode: "call",
            tel: "163",
            primaryLabel: "Call 163",
          },
        ],
      },
    ],
    []
  );

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-[#D9FDB2] via-[#EAFED6] to-[#F3FAEF]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-[340px] w-[340px] rounded-full bg-white/55 blur-2xl" />
        <div className="absolute top-0 right-0 h-[280px] w-[280px] rounded-full bg-white/45 blur-2xl" />
        <div className="absolute -top-10 -left-10 w-[180px] opacity-[0.10] rotate-[-10deg]">
          <DoodleSpark />
        </div>
        <div className="absolute top-[120px] -right-10 w-[260px] opacity-[0.08] rotate-[8deg]">
          <DoodleWave />
        </div>
        <div className="absolute bottom-[80px] left-[8%] w-[110px] opacity-[0.08] rotate-[-6deg]">
          <DoodleHeart />
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[1200px] px-3 sm:px-6 lg:px-10 py-8 sm:py-12">
        {/* HERO */}
        <div
          className="relative rounded-[22px] border border-black/15 bg-white/75 backdrop-blur-[2px] overflow-hidden"
          ref={heroRef}
          style={{
            transform: heroInView ? "translateY(0)" : "translateY(12px)",
            opacity: heroInView ? 1 : 0,
            transition:
              "transform 650ms cubic-bezier(.2,.8,.2,1), opacity 650ms cubic-bezier(.2,.8,.2,1)",
          }}
        >
          <DoodleWave className="absolute -bottom-10 -left-10 w-[320px] opacity-[0.10] pointer-events-none" />
          <DoodleSpark className="absolute -top-8 -right-8 w-[160px] opacity-[0.10] pointer-events-none" />

          <div className="p-4 sm:p-8 md:p-10">
            <p
              className="inline-flex flex-wrap items-center gap-2 rounded-full border border-black/15 bg-white px-3 sm:px-4 py-2 text-[12px] sm:text-[12.5px] font-extrabold text-[#141414]"
              style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#B9FF66] border border-black/25" />
              Student Emergency & Support
            </p>

            <h1
              className="mt-3 sm:mt-4 text-[22px] sm:text-[38px] md:text-[46px] leading-[1.08] font-bold text-[#141414]"
              style={{ fontFamily: "Lora, serif" }}
            >
              Help is one tap away.
            </h1>

            <p
              className="mt-3 sm:mt-4 text-[13px] sm:text-[16px] text-black/65 leading-relaxed max-w-[72ch]"
              style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
            >
              If it’s an emergency, call 911. If you’re safe, reach out to campus support.
            </p>

            <div className="mt-5 sm:mt-6">
              <a
                href="tel:911"
                className={[
                  "w-full sm:w-auto",
                  "inline-flex items-center justify-center gap-2 rounded-full border border-black/15 bg-[#B9FF66]",
                  "px-5 py-3 min-h-[48px] text-[14px] font-extrabold text-[#141414]",
                  "whitespace-normal break-words text-center",
                  "hover:-translate-y-[1px] hover:shadow-[0_14px_20px_rgba(0,0,0,0.10)] hover:brightness-[0.99]",
                  "active:scale-[0.99] transition",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2",
                ].join(" ")}
                style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
              >
                <PhoneIcon className="w-5 h-5 shrink-0" />
                Call 911
              </a>
            </div>
          </div>
        </div>

        {/* SECTIONS */}
        <div className="mt-8 sm:mt-10 space-y-10">
          {sections.map((sec, sIdx) => {
            const isFeaturedSection = sec.items.length === 1;

            return (
              <div key={sIdx}>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2
                      className="text-[18px] sm:text-[24px] font-bold text-[#141414]"
                      style={{ fontFamily: "Lora, serif" }}
                    >
                      {sec.title}
                    </h2>
                    <p
                      className="mt-1 text-[12.5px] sm:text-[13.5px] text-black/55"
                      style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
                    >
                      {sec.subtitle}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 opacity-70">
                    <DoodleSpark className="w-[34px]" />
                  </div>
                </div>

                {isFeaturedSection ? (
                  <div className="mt-4 sm:mt-5">
                    {sec.items.map((item, i) => (
                      <EmergencyCard
                        key={`${sIdx}-${i}`}
                        item={item}
                        delay={i * 110}
                        variant="featured"
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className={[
                      "mt-4 sm:mt-5 grid items-stretch justify-items-stretch",
                      "gap-4 sm:gap-6",
                      "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2",
                      "max-[360px]:gap-3",
                    ].join(" ")}
                  >
                    {sec.items.map((item, i) => (
                      <EmergencyCard key={`${sIdx}-${i}`} item={item} delay={i * 110} variant="default" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
