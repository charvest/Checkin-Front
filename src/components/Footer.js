import { useEffect, useRef, useState } from "react";

import facebook from "../assets/Facebook.png";
import twitter from "../assets/Twitter.png";
import instagram from "../assets/Instagram.png";
import linkedin from "../assets/Linkedin.png";
import logoOutlined from "../assets/logo-outlined 1.png";

export default function Footer() {
  const [visible, setVisible] = useState(false);
  const footerRef = useRef(null);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const baseFade =
    "transition-all duration-700 ease-out will-change-transform will-change-opacity";

  const socials = [
    { icon: facebook, label: "Facebook", href: "https://www.facebook.com/profile.php?id=61586209235539&rdid=p1enOBvaQIHQK7bl&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1Ea23LhzS5%2F#" },
    { icon: twitter, label: "Twitter", href: "https://x.com/CheckIn_AUABC?fbclid=IwY2xjawPQl95leHRuA2FlbQIxMQBzcnRjBmFwcF9pZAEwAAEeuIWwEmXicK7Q3wfNKNHwJE Dpi1n3-W3TE5SLM_6gG1j90tzhKbReD-4s1VQ_aem_IPXZcapEhSiSyA0gEJ4orQ" },
    { icon: instagram, label: "Instagram", href: "https://www.instagram.com/checkin_auabc/?fbclid=IwY2xjawPQl-xleHRuA2FlbQIxMQBzcnRjBmFwcF9pZAEwAAEedlwwepgueKRZL3MKBwLAK9pLtAAq1TBBLgxUwP_2-04ZMgxr08ER9dIoI_E_aem_XMsYKGiYcfitsdyAUMJypw" },
    { icon: linkedin, label: "LinkedIn", href: "https://www.linkedin.com/in/check-in-3386013a5/?fbclid=IwY2xjawPQl-NleHRuA2FlbQIxMQBzcnRjBmFwcF9pZAEwAAEefNj7dbKjDk67dOU2YDZ6zEEjLNCPJUMuikuadhcEw1_ygfvHD3BtpG0cxj0_aem_qT-PixUk2oWwa9w0xKZvmA" },
  ];

  return (
    <footer
      ref={footerRef}
      className="w-full bg-[#B9FF66] overflow-x-hidden"
      style={{ fontFamily: "Nunito, sans-serif" }}
    >
      {/* Optional top line (remove if you don’t want it) */}
      <div className="w-full h-[2px] bg-black/15" />

      <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-8 py-10 sm:py-12">
        {/* SOCIAL ICONS */}
        <div className="flex justify-center items-center gap-6 sm:gap-7 mb-4 sm:mb-5">
          {socials.map((s, i) => (
            <a
              key={s.label}
              href={s.href}
              aria-label={s.label}
              className={`
                inline-flex items-center justify-center
                ${baseFade}
                ${
                  visible
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-4 scale-90"
                }
              `}
              style={{ transitionDelay: visible ? `${i * 90}ms` : "0ms" }}
            >
              <img
                src={s.icon}
                alt={s.label}
                className="
                  w-[37px] h-[37px]
                  select-none
                  transition-transform duration-200
                  hover:scale-110 hover:-translate-y-1
                "
                draggable="false"
              />
            </a>
          ))}
        </div>

        {/* TAGLINE */}
        <p
          className={`
            text-center text-[13px] sm:text-[14px] font-semibold text-black mb-5 sm:mb-6
            ${baseFade}
            ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: visible ? "380ms" : "0ms" }}
        >
          Student-Centered Mental Wellness Support
        </p>

        {/* LOGO */}
        <div
          className={`
            flex justify-center mb-3 sm:mb-4
            ${baseFade}
            ${
              visible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-6 scale-95"
            }
          `}
          style={{ transitionDelay: visible ? "500ms" : "0ms" }}
        >
          <img
            src={logoOutlined}
            alt="CheckIn Logo"
            className="
              w-[258px] h-[110px]
              object-contain
              max-w-full
              select-none
            "
            draggable="false"
          />
        </div>

        {/* COPYRIGHT */}
        <p
          className={`
            text-center text-[12px] sm:text-[12.5px] text-black/70 leading-relaxed
            ${baseFade}
            ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: visible ? "650ms" : "0ms" }}
        >
          © 2024 All Rights Reserved
          <br />
          Arellano University – Andres Bonifacio Campus
        </p>
      </div>
    </footer>
  );
}
