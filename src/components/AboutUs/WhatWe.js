export default function WhatWe() {
  return (
    <section id="what-we" className="w-full bg-[#FAFAFA]">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-10 pb-24 sm:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 items-start">
          
          {/* LEFT: HOW CHECKIN HELPS */}
          <div className="relative">
            <h2 className="font-lora text-[28px] sm:text-[40px] font-bold text-[#222] relative inline-block">
              How CheckIn Helps
              {/* doodle underline */}
              <span className="doodle-underline absolute left-0 -bottom-2 w-full h-[14px]" />
            </h2>

            <p className="mt-6 text-[15px] sm:text-[18px] text-black/70 leading-relaxed max-w-[60ch]">
              CheckIn is built to make mental health support feel light, guided,
              and easy to return to — even on busy days.
            </p>

            <p className="mt-4 text-[15px] sm:text-[18px] text-black/70 leading-relaxed max-w-[60ch]">
              From journaling to self-assessments and quick access to help,
              every feature is designed to reduce friction and support healthier
              habits over time.
            </p>

            {/* floating doodles */}
            <span className="doodle-float doodle-star" />
            <span className="doodle-float doodle-circle" />
            <span className="doodle-float doodle-spark" />
          </div>

          {/* RIGHT: WHAT WE BELIEVE */}
          <div className="relative rounded-[26px] bg-white border-2 border-black/15 p-7 sm:p-8 overflow-hidden">
            {/* corner scribble */}
            <span className="corner-scribble" />

            <h3 className="font-lora text-[22px] sm:text-[26px] font-bold text-[#222] mb-5 sm:mb-6">
              What We Believe
            </h3>

            <ul className="space-y-3 sm:space-y-4 text-[15px] sm:text-[16px] text-black/70">
              <li>• Mental health tools should feel safe and non-judgmental</li>
              <li>• Privacy is a right, not a feature</li>
              <li>• Simple design creates better habits</li>
              <li>• Support should always be easy to reach</li>
            </ul>
          </div>
        </div>
      </div>

      {/* DOODLE STYLES */}
      <style>{`
        /* underline doodle */
        .doodle-underline::before {
          content: "";
          position: absolute;
          inset: 0;
          background-repeat: no-repeat;
          background-size: 100% 100%;
          background-position: center;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 520 70'%3E%3Cpath d='M10 45 C 60 60, 120 20, 180 40 S 300 60, 360 38 S 450 52, 510 34' fill='none' stroke='%23222' stroke-width='6' stroke-linecap='round' stroke-linejoin='round' stroke-dasharray='1200' stroke-dashoffset='1200'/%3E%3C/svg%3E");
          animation: doodleDraw 1.2s ease forwards;
        }

        @keyframes doodleDraw {
          to {
            background-position: center;
          }
        }

        /* floating doodles */
        .doodle-float {
          position: absolute;
          opacity: 0.25;
          animation: floaty 6s ease-in-out infinite;
        }

        .doodle-star {
          width: 18px;
          height: 18px;
          top: 20%;
          right: -6%;
          border: 2px solid #222;
          transform: rotate(45deg);
        }

        .doodle-circle {
          width: 22px;
          height: 22px;
          bottom: 15%;
          left: -6%;
          border: 2px dashed #222;
          border-radius: 999px;
          animation-delay: 1.2s;
        }

        .doodle-spark {
          width: 14px;
          height: 14px;
          top: 55%;
          right: -10%;
          border-left: 2px solid #222;
          border-top: 2px solid #222;
          transform: rotate(20deg);
          animation-delay: 2.4s;
        }

        @keyframes floaty {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        /* corner scribble */
        .corner-scribble {
          position: absolute;
          top: -12px;
          right: -12px;
          width: 60px;
          height: 60px;
          border: 2px solid #222;
          border-radius: 18px;
          transform: rotate(12deg);
          opacity: 0.15;
        }
      `}</style>
    </section>
  );
}
