import { useEffect, useRef, useState } from "react";

// team images
import johnImg from "../../assets/b.png";
import jeremyImg from "../../assets/j.png";
import gerryImg from "../../assets/g.png";
import kenjiImg from "../../assets/k.png";

/** Fade-up on scroll (runs once) */
function useInView(options = { threshold: 0.2 }) {
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

function TeamMember({ img, first, last, delay = 0 }) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={[
        "flex flex-col items-center text-center",
        "transition-all duration-700 ease-out",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
      ].join(" ")}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Doodle avatar */}
      <div className="relative">
        <div
          className="absolute -inset-[10px] rounded-full border-[3px] border-black/60 rotate-[-6deg]"
          style={{ borderStyle: "dashed" }}
        />
        <div
          className="absolute -inset-[6px] rounded-full border-[2px] border-black/35 rotate-[7deg]"
          style={{ borderStyle: "dotted" }}
        />

        <div className="w-[130px] h-[130px] sm:w-[145px] sm:h-[145px] lg:w-[150px] lg:h-[150px] rounded-full overflow-hidden bg-black/5">
          <img
            src={img}
            alt={`${first} ${last}`}
            className="w-full h-full object-cover"
            draggable="false"
          />
        </div>

        <span className="absolute -right-3 -top-2 text-[22px] select-none">✦</span>
        <span className="absolute -left-4 bottom-1 text-[18px] select-none">•</span>
      </div>

      <p className="mt-5 text-[26px] sm:text-[28px] font-extrabold text-[#111]">
        {first}
      </p>
      <p className="-mt-1 text-[16px] sm:text-[17px] text-black/70">
        {last}
      </p>
    </div>
  );
}

export default function Team() {
  const team = [
    { first: "John", last: "Barte", img: johnImg },
    { first: "Jeremy", last: "Bisnar", img: jeremyImg },
    { first: "Gerry", last: "Monin Jr.", img: gerryImg },
    { first: "Kenji", last: "Pascual", img: kenjiImg },
  ];

  const [titleRef, titleInView] = useInView({ threshold: 0.2 });

  return (
    <section className="w-full bg-[#FAFAFA]">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10 pb-20 sm:pb-28">
        {/* Header */}
        <div
          ref={titleRef}
          className={[
            "mb-10 sm:mb-12",
            "transition-all duration-700 ease-out",
            titleInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          ].join(" ")}
        >
          <div className="relative inline-block">
            <span className="absolute -bottom-2 left-0 w-full h-[10px] bg-[#B9FF66]/60 rounded-full rotate-[-1deg]" />
            <h2 className="relative font-lora text-[30px] sm:text-[36px] lg:text-[42px] font-bold text-[#222]">
              Meet our team
            </h2>
          </div>

          <p className="mt-4 text-[14px] sm:text-[16px] text-black/70 max-w-[65ch]">
            The people behind CheckIn who build with empathy, clarity, and care.
          </p>
        </div>

        {/* Team grid */}
        <div className="relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
            {team.map((m, i) => (
              <TeamMember
                key={m.first}
                {...m}
                delay={120 + i * 120}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
