import { NavLink, useLocation } from "react-router-dom";

export default function Navbar() {
  const { pathname } = useLocation();
  const isSignup = pathname.startsWith("/sign-up");

  return (
    <header className="h-16 px-9 border-b border-border bg-white flex items-center justify-between">
      {/* BRAND */}
      <div className="flex items-center gap-2.5">
        <span className="text-[22px] font-extrabold text-[#7cdc3b]">✓</span>
        <span className="text-[18px] font-extrabold">CheckIn</span>
      </div>

      {/* RIGHT SIDE (NAV + ACTIONS) */}
      <div className="flex items-center gap-6">
        {/* NAV LINKS */}
        <nav className="hidden lg:flex gap-[26px] text-[14px] font-semibold">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `hover:opacity-70 ${isActive ? "font-bold text-green" : ""}`
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/about-us"
            className={({ isActive }) =>
              `hover:opacity-70 ${isActive ? "font-bold text-green" : ""}`
            }
          >
            About us
          </NavLink>

          <NavLink
            to="/privacy-policy"
            className={({ isActive }) =>
              `hover:opacity-70 ${isActive ? "font-bold text-green" : ""}`
            }
          >
            Privacy Policy
          </NavLink>

          <NavLink
            to="/faqs"
            className={({ isActive }) =>
              `hover:opacity-70 ${isActive ? "font-bold text-green" : ""}`
            }
          >
            FAQS
          </NavLink>
        </nav>

        {/* AUTH PILL (LOGIN / SIGN-UP) */}
        <div className="relative inline-flex h-10 rounded-full border-2 border-[#8b8b8b] bg-white overflow-hidden">
          {/* ACTIVE BACKGROUND */}
          <div
            className={`
              absolute top-0 bottom-0 w-1/2
              bg-[#B9FF66]
              transition-transform duration-300 ease-out
              ${isSignup ? "translate-x-full" : "translate-x-0"}
            `}
          />

          {/* DIVIDER */}
          <div className="absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-1/2 bg-[#8b8b8b]" />

          {/* LOGIN */}
          <NavLink
            to="/login"
            end
            className={({ isActive }) =>
              `
              relative z-10
              inline-flex items-center justify-center gap-2
              w-28 text-[14px] font-extrabold
              transition-colors duration-200
              ${isActive ? "text-[#141414]" : "text-[#141414]/80"}
              `
            }
          >
            {!isSignup && <span className="text-[16px] leading-none">✓</span>}
            Login
          </NavLink>

          {/* SIGN-UP */}
          <NavLink
            to="/sign-up"
            className={({ isActive }) =>
              `
              relative z-10
              inline-flex items-center justify-center
              w-28 text-[14px] font-extrabold
              transition-colors duration-200
              ${isActive ? "text-[#141414]" : "text-[#141414]/80"}
              `
            }
          >
            Sign-up
          </NavLink>
        </div>
      </div>
    </header>
  );
}
