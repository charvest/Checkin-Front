import { useEffect, useRef, useState } from "react";

/** Fade-up on scroll (runs once) */
function useInView(options = { threshold: 0.18 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        obs.unobserve(el);
      }
    }, options);

    obs.observe(el);
    return () => obs.disconnect();
  }, [options]);

  return [ref, inView];
}

export default function Section() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [heroRef, heroInView] = useInView({ threshold: 0.2 });

  return (
    <main className="w-full bg-[#FAFAFA] font-nunito overflow-x-hidden">
      {/* HERO */}
      <section className="w-full relative overflow-hidden">
        {/* DOODLE BACKGROUND LAYER */}
        <div className="pointer-events-none absolute inset-0">
          {/* top-left loose scribble */}
          <span className="doodle doodle-scribbleTL" aria-hidden />

          {/* top-right sparkle cluster */}
          <span className="doodle doodle-sparkCluster" aria-hidden />

          {/* right-side big green blob w/ hand outline */}
          <span className="doodle doodle-blobR" aria-hidden />

          {/* bottom dotted path */}
          <span className="doodle doodle-pathB" aria-hidden />

          {/* small accents */}
          <span className="doodle doodle-ring" aria-hidden />
          <span className="doodle doodle-x" aria-hidden />
          <span className="doodle doodle-dot" aria-hidden />
        </div>

        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10 pt-16 sm:pt-20 pb-16 sm:pb-20">
          <div
            ref={heroRef}
            className={[
              "max-w-[980px] relative",
              "transition-all duration-700 ease-out",
              heroInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
            ].join(" ")}
          >
            <span className="inline-block mb-4 px-4 py-2 rounded-full border border-black/20 text-[13px] font-semibold text-black/70 bg-white/60 backdrop-blur">
              About Us
            </span>

            <h1 className="font-lora text-[34px] sm:text-[50px] lg:text-[64px] font-bold leading-tight text-[#222] relative inline-block">
              Building calm, supportive digital spaces for mental well-being.
              {/* doodle underline */}
              <span className="doodle-underline absolute left-0 -bottom-2 w-full h-[14px]" />
            </h1>

            <p className="mt-6 text-[15px] sm:text-[18px] lg:text-[20px] text-black/70 leading-relaxed max-w-[78ch]">
              We are a team of student developers committed to creating CheckIn,
              a student-centered web-based platform designed to promote mental
              wellness and responsible help-seeking. Guided by research,
              technology, and empathy, our goal is to provide students with a
              safe, confidential, and accessible space to reflect on their
              emotional well-being through evidence-based tools such as the
              PHQ-9. Through CheckIn, we aim to support early awareness, reduce
              stigma, and foster a more supportive academic environment where
              students feel empowered to care for their mental health.
            </p>

            {/* subtle doodle divider line under paragraph */}
            <div className="mt-10 w-full max-w-[520px] h-[16px] relative">
              <span className="doodle-divider absolute inset-0" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* DOODLE STYLES */}
      <style>{`
        /* ---------------------------
          BASE DOODLE SETTINGS
        ---------------------------- */
        .doodle{
          position:absolute;
          opacity:0.22;
          animation: floaty 7.2s ease-in-out infinite;
          filter: saturate(0.95);
        }
        @keyframes floaty{
          0%,100%{ transform: translateY(0); }
          50%{ transform: translateY(-10px); }
        }

        /* ---------------------------
          TOP-LEFT SCRIBBLE
        ---------------------------- */
        .doodle-scribbleTL{
          top: 18px;
          left: 14px;
          width: 150px;
          height: 110px;
          background-repeat:no-repeat;
          background-size:100% 100%;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 260 200'%3E%3Cpath d='M28 118c18-48 74-84 126-78 52 6 92 54 58 98-28 36-90 34-120 10-30-24-18-62 18-68 34-6 56 22 42 40-14 20-44 14-40-8 2-16 22-18 30-8' fill='none' stroke='%23000' stroke-width='6' stroke-linecap='round' stroke-linejoin='round' stroke-opacity='0.55'/%3E%3C/svg%3E");
          animation-delay: .2s;
        }

        /* ---------------------------
          TOP-RIGHT SPARKLE CLUSTER
        ---------------------------- */
        .doodle-sparkCluster{
          top: 38px;
          right: 34px;
          width: 140px;
          height: 90px;
          opacity:0.18;
          background-repeat:no-repeat;
          background-size:100% 100%;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 220'%3E%3Cg fill='none' stroke='%23000' stroke-width='6' stroke-linejoin='round' stroke-linecap='round' stroke-opacity='0.50'%3E%3Cpath d='M70 40 L82 86 L126 98 L82 110 L70 156 L58 110 L14 98 L58 86 Z'/%3E%3Cpath d='M220 32 L230 70 L266 80 L230 90 L220 128 L210 90 L174 80 L210 70 Z'/%3E%3Cpath d='M310 110 L318 138 L344 146 L318 154 L310 182 L302 154 L276 146 L302 138 Z'/%3E%3C/g%3E%3Ccircle cx='150' cy='160' r='10' stroke='%23B9FF66' stroke-width='8' stroke-opacity='0.55'/%3E%3C/svg%3E");
          animation-delay: 1.1s;
        }

        /* ---------------------------
          RIGHT BIG GREEN BLOB + OUTLINE
        ---------------------------- */
        .doodle-blobR{
          top: 90px;
          right: -90px;
          width: 320px;
          height: 260px;
          background-repeat:no-repeat;
          background-size:100% 100%;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 560 460'%3E%3Cpath d='M126 160c48-96 194-128 292-80 94 46 144 160 96 260-44 90-156 144-268 118C154 430 74 308 126 160Z' fill='%23B9FF66' fill-opacity='0.55'/%3E%3Cpath d='M134 160c50-100 198-132 300-82 98 46 152 164 102 268-46 96-164 152-276 126C162 436 86 312 134 160Z' fill='none' stroke='%23000' stroke-width='7' stroke-linecap='round' stroke-linejoin='round' stroke-opacity='0.45'/%3E%3C/svg%3E");
          animation-delay: 0.7s;
        }

        /* ---------------------------
          BOTTOM DOTTED PATH
        ---------------------------- */
        .doodle-pathB{
          left: 6%;
          bottom: 20px;
          width: 520px;
          height: 130px;
          opacity:0.14;
          background-repeat:no-repeat;
          background-size:100% 100%;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 820 260'%3E%3Cpath d='M18 170 C 130 60, 210 240, 350 130 S 590 40, 802 180' fill='none' stroke='%23000' stroke-width='7' stroke-linecap='round' stroke-linejoin='round' stroke-dasharray='10 20' stroke-opacity='0.50'/%3E%3C/svg%3E");
          animation-delay: 2.0s;
        }

        /* ---------------------------
          SMALL ACCENTS
        ---------------------------- */
        .doodle-ring{
          top: 210px;
          left: 62%;
          width: 34px;
          height: 34px;
          border: 3px dashed rgba(0,0,0,0.35);
          border-radius: 999px;
          opacity: 0.18;
          animation-delay: 1.6s;
        }

        .doodle-x{
          top: 320px;
          right: 24%;
          width: 18px;
          height: 18px;
          opacity: 0.16;
          background-repeat:no-repeat;
          background-size:100% 100%;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M22 22 L78 78 M78 22 L22 78' stroke='%23000' stroke-width='10' stroke-linecap='round' stroke-opacity='0.55'/%3E%3C/svg%3E");
          animation-delay: 2.4s;
        }

        .doodle-dot{
          bottom: 56px;
          right: 14%;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: rgba(185,255,102,0.75);
          border: 2px solid rgba(0,0,0,0.22);
          opacity: 0.22;
          animation-delay: 0.9s;
        }

        /* ---------------------------
          DOODLE UNDERLINE (clean)
        ---------------------------- */
        .doodle-underline::before{
          content:"";
          position:absolute;
          inset:0;
          background-repeat:no-repeat;
          background-size:100% 100%;
          background-position:center;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 520 70'%3E%3Cpath d='M10 45 C 60 60, 120 20, 180 40 S 300 60, 360 38 S 450 52, 510 34' fill='none' stroke='%23000' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M12 50 C 70 68, 120 32, 180 50 S 300 66, 360 46 S 450 62, 510 42' fill='none' stroke='%23B9FF66' stroke-width='10' stroke-linecap='round' stroke-linejoin='round' stroke-opacity='0.55'/%3E%3C/svg%3E");
          animation: underlinePop 1.05s ease forwards;
          opacity: 0;
          transform: translateX(-10px);
        }

        @keyframes underlinePop{
          to{ opacity:1; transform: translateX(0); }
        }

        /* ---------------------------
          DOODLE DIVIDER
        ---------------------------- */
        .doodle-divider{  
          background-repeat:no-repeat;
          background-size:100% 100%;
          background-position:center;
          opacity:0.28;
          display:block;
          width:100%;
          height:100%;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 700 120'%3E%3Cpath d='M20 60 C 120 20, 180 100, 280 58 S 470 20, 680 62' fill='none' stroke='%23000' stroke-width='7' stroke-linecap='round' stroke-linejoin='round' stroke-opacity='0.45'/%3E%3Ccircle cx='120' cy='32' r='8' fill='%23B9FF66' fill-opacity='0.75' stroke='%23000' stroke-width='4' stroke-opacity='0.30'/%3E%3Ccircle cx='520' cy='86' r='7' fill='%23B9FF66' fill-opacity='0.75' stroke='%23000' stroke-width='4' stroke-opacity='0.30'/%3E%3C/svg%3E");
        }

        /* ---------------------------
          REDUCE MOTION
        ---------------------------- */
        @media (prefers-reduced-motion: reduce){
          .doodle, .doodle-underline::before{
            animation: none !important;
          }
        }

        /* Mobile tuning */
        @media (max-width: 640px){
          .doodle-pathB{ display:none; }
          .doodle-blobR{ right: -140px; top: 130px; opacity:0.16; }
          .doodle-scribbleTL{ opacity:0.14; }
          .doodle-sparkCluster{ opacity:0.12; }
        }
      `}</style>
    </main>
  );
}
