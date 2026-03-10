import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// Assets
import guidanceImg from "../../assets/Guidance (1).png";
import journalImg from "../../assets/Journal.png";
import phqImg from "../../assets/Phq9.png";
import hotlineImg from "../../assets/Hotline.png";
import starImg from "../../assets/stars.png";
import arrowIcon from "../../assets/Icon.png";

function useInView({ threshold = 0.1, rootMargin = "0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // ✅ Fallback (prevents "IntersectionObserver is not defined")
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}

function FeatureCard({ variant, topLabel, line2, desc, img, delay, to, onNavigate }) {
  const [ref, inView] = useInView({ threshold: 0.1 });
  const isGreen = variant === "green";

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      onClick={() => to && onNavigate(to)}
      className={`
        group relative flex h-full cursor-pointer flex-col
        rounded-[28px] border-[4px] border-black
        ${isGreen ? "bg-[#B9FF66]" : "bg-[#E9ECE7]"}
        p-6 sm:p-7 xl:p-8
        overflow-hidden
        transition-all duration-500 ease-out
        hover:-translate-y-2 hover:z-10
        hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.18)]
        ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
      `}
    >
      {/* Top row */}
      <div className="flex items-center justify-between">
        <span className="bg-white border-2 border-black px-4 py-1.5 rounded-xl font-black text-[12px] sm:text-[13px] uppercase tracking-wider">
          {topLabel}
        </span>

        <div className="bg-black p-2.5 sm:p-3 rounded-full transition-transform duration-300 group-hover:rotate-[-45deg]">
          <img src={arrowIcon} alt="" className="w-4 h-4 sm:w-5 sm:h-5 invert" />
        </div>
      </div>

      {/* Text */}
      <div className="mt-8">
        <h3 className="text-black uppercase tracking-tighter font-black leading-[0.95] text-[clamp(1.8rem,3.2vw,2.6rem)]">
          {line2}
        </h3>

        <p className="mt-4 font-bold text-black/70 leading-relaxed text-[clamp(1rem,1.4vw,1.15rem)]">
          {desc}
        </p>
      </div>

      {/* Image */}
      <div className="mt-auto flex justify-center items-end pt-10">
        <div className="h-[170px] sm:h-[200px] md:h-[220px] xl:h-[240px] flex items-end">
          <img
            src={img}
            alt={line2}
            className="h-full w-auto object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-[1.05]"
          />
        </div>
      </div>
    </div>
  );
}

export default function Features() {
  const navigate = useNavigate();

  return (
    <section className="w-full bg-white font-sans overflow-hidden py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-[1800px] px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <div className="text-center mb-14 sm:mb-16 lg:mb-20">
          <img src={starImg} alt="" className="mx-auto h-10 sm:h-12 w-auto mb-4 sm:mb-5" />

          <h2 className="font-black uppercase tracking-tighter leading-[0.9] text-black text-[clamp(2.6rem,7vw,5.4rem)]">
            Our Services
          </h2>

          <p className="mt-4 sm:mt-5 font-bold text-black/50 mx-auto max-w-[900px] text-[clamp(1.05rem,2.2vw,1.5rem)] leading-relaxed">
            Comprehensive, easy-to-use tools designed to support your mental well-being daily.
          </p>
        </div>

        {/* ✅ Mobile: 1 | Tablet+Laptop: 2 | Desktop(very wide): 4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6 sm:gap-7 xl:gap-8 items-stretch">
          <FeatureCard
            variant="gray"
            topLabel="Guidance"
            line2="Counseling"
            desc="One-on-one sessions with licensed professionals to navigate life's challenges."
            img={guidanceImg}
            delay={0}
            to="/services/counseling"
            onNavigate={navigate}
          />

          <FeatureCard
            variant="green"
            topLabel="Journal"
            line2="Mood Tracker"
            desc="A private space to reflect, release, and track your emotional journey."
            img={journalImg}
            delay={100}
            to="/services/journal"
            onNavigate={navigate}
          />

          <FeatureCard
            variant="gray"
            topLabel="Self-Check"
            line2="Wellness Check"
            desc="Quick, clinical check-ins to monitor and understand your mental health."
            img={phqImg}
            delay={200}
            to="/services/assessment"
            onNavigate={navigate}
          />

          <FeatureCard
            variant="green"
            topLabel="Emergency"
            line2="24/7 Hotline"
            desc="Immediate, life-saving support available instantly at your fingertips."
            img={hotlineImg}
            delay={300}
            to="/services/emergency"
            onNavigate={navigate}
          />
        </div>
      </div>
    </section>
  );
}