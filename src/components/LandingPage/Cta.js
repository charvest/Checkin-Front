import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import mentalImg from "../../assets/let.png";
import parallaxImg from "../../assets/Parallax-2.png";

export default function LandingHero() {
  const navigate = useNavigate();

  const [bgOffset, setBgOffset] = useState(0);
  const [visible, setVisible] = useState(false);

  const rafRef = useRef(null);
  const heroRef = useRef(null);

  /* ================= FADE-IN ON VIEW ================= */
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ================= MOBILE PARALLAX ================= */
  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) return;

      rafRef.current = requestAnimationFrame(() => {
        const raw = (window.scrollY || 0) * 0.06;
        const clamped = Math.max(-40, Math.min(40, raw));
        setBgOffset(clamped);
        rafRef.current = null;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section className="w-full bg-white overflow-x-hidden">
      {/* ================= HERO ================= */}
      <div
        ref={heroRef}
        className="
          w-full
          px-5 sm:px-8 md:px-[70px]
          pt-16 sm:pt-20 md:pt-[90px]
          pb-16 sm:pb-20 md:pb-[80px]
        "
      >
        <div className="max-w-[1200px] mx-auto flex flex-col-reverse lg:flex-row items-center lg:items-start justify-between gap-14 lg:gap-20">
          {/* LEFT */}
          <div
            className={`
              w-full max-w-[600px] text-center lg:text-left
              transition-all duration-[700ms] ease-out
              ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}
            `}
          >
            <h1 className="font-lora text-[34px] sm:text-[40px] md:text-[48px] font-bold leading-[1.2] text-black">
              Let’s make things happen.
            </h1>

            <p className="font-nunito mt-6 sm:mt-7 text-[16px] sm:text-[17px] md:text-[18px] leading-[1.9] text-black/80 max-w-[560px] mx-auto lg:mx-0">
              Reach out to us for guidance, support, and mental wellness care.
              Through CheckIn, students can access guided assessments, reflect
              on their well-being, and take steps toward appropriate help in a
              safe and supportive space.
            </p>

            {/* ACTION BUTTONS */}
            <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => navigate("/sign-up")}
                className="h-[46px] px-10 rounded-[12px] bg-[#B9FF66] text-[15px] font-extrabold text-black border-2 border-black/70 hover:brightness-95 transition"
              >
                Register Now!
              </button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="h-[46px] px-12 rounded-[12px] bg-white text-[15px] font-extrabold text-black border-2 border-black/70 hover:bg-black/5 transition"
              >
                Login
              </button>
            </div>
          </div>

          {/* RIGHT IMAGE — redesigned with gradient */}
          <div
            className={`
              relative w-full lg:w-auto flex justify-center lg:justify-end
              transition-all duration-[900ms] ease-out delay-100
              ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}
            `}
          >
            {/* GRADIENT HALO */}
            <div className="absolute -inset-6 sm:-inset-8 rounded-full bg-gradient-to-tr from-[#B9FF66]/60 via-[#DFFFAD]/40 to-transparent blur-2xl" />

            <img
              src={mentalImg}
              alt="Mental Health and Wellness"
              className="relative z-10 w-[280px] sm:w-[340px] md:w-[420px] lg:w-[480px] h-auto object-contain"
              draggable="false"
            />
          </div>
        </div>
      </div>

      {/* ================= PARALLAX STRIP (UNCHANGED) ================= */}
      <div className="relative w-full overflow-hidden">
        {/* DESKTOP */}
        <div className="hidden lg:block relative h-[160px] overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${parallaxImg})`,
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
            }}
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
            <div>
              <h2 className="font-lora text-white text-[26px] lg:text-[30px] font-bold">
                You’re doing better than you think.
              </h2>
              <p className="mt-2 font-nunito text-white/85 text-[14.5px]">
                One step, one check-in, one moment at a time.
              </p>
            </div>
          </div>
        </div>

        {/* MOBILE */}
        <div
          className="relative block lg:hidden h-[110px] sm:h-[140px] md:h-[160px]"
          style={{
            backgroundImage: `url(${parallaxImg})`,
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: `center calc(50% + ${bgOffset}px)`,
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div>
              <h2 className="font-lora text-white text-[20px] sm:text-[22px] font-bold">
                You’re doing better than you think.
              </h2>
              <p className="mt-1 font-nunito text-white/85 text-[13.5px]">
                One step at a time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
