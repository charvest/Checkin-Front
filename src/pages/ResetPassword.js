// src/pages/ResetPassword.js
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/apiFetch";
import signImg from "../assets/Sign.png"; // make sure filename matches exactly

function Spinner({ size = 16 }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/* Responsive title:
   - normal text on mobile
   - animated characters on desktop
*/
function AnimatedChars({ text, className = "", delay = 18 }) {
  const chars = useMemo(() => text.split(""), [text]);

  return (
    <>
      {/* Mobile */}
      <h1 className={`${className} sm:hidden`} aria-label={text}>
        {text}
      </h1>

      {/* Desktop */}
      <h1 className={`${className} hidden sm:block`} aria-label={text}>
        {chars.map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            className="inline-block opacity-0 translate-y-[8px] animate-[charIn_420ms_ease-out_forwards]"
            style={{ animationDelay: `${i * delay}ms` }}
            aria-hidden="true"
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        ))}
      </h1>
    </>
  );
}

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const token = useMemo(() => {
    const qs = new URLSearchParams(location.search);
    return (qs.get("token") || "").trim();
  }, [location.search]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  // view states: checking | otp | form | success | expired
  const [view, setView] = useState(() => (!token ? "expired" : "checking"));
  const [note, setNote] = useState(() =>
    !token
      ? "Reset link is missing or invalid. Please request a new one."
      : ""
  );
  const [error, setError] = useState("");


  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpNote, setOtpNote] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const otpCanVerify = !otpLoading && /^[0-9]{6}$/.test(String(otp).trim());


  // Validate token on page load to avoid showing the form for used/expired links.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setView("expired");
        setNote("Reset link is missing or invalid. Please request a new one.");
        return;
      }

      setView("checking");
      setError("");
      setNote("Checking your reset link…");

      try {
        const data = await apiFetch(
          `/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`
        );

        if (cancelled) return;

        if (data && data.valid) {
          const alreadyVerified = Boolean(data.otpVerified);
          setOtpVerified(alreadyVerified);
          if (alreadyVerified) {
            setView("form");
            setNote("");
            return;
          }
          setView("otp");
          setNote("");
          // auto-send OTP once
          setTimeout(() => {
            handleResendOtp();
          }, 50);
          return;
        }

        setView("expired");
        setNote(
          (data && data.message) ||
            "Expired! Reset link is invalid or has already been used. Please request a new one."
        );
      } catch (err) {
        if (cancelled) return;
        setView("expired");
        setNote("Expired! Reset link is invalid or expired. Please request a new one.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);


  const handleResendOtp = async () => {
    if (!token) return;
    if (cooldown > 0) return;

    setOtpLoading(true);
    setOtpError("");
    setOtpNote("");

    try {
      const data = await apiFetch("/api/auth/reset-password/send-otp", {
        method: "POST",
        body: JSON.stringify({ token }),
      });

      // backend may return a cooldownSeconds value
      const nextCooldown =
        data && typeof data.cooldownSeconds === "number" ? data.cooldownSeconds : 60;

      setCooldown(nextCooldown || 60);
      setOtpNote("We sent a 6-digit code to your email. Please check your inbox.");
    } catch (err) {
      setOtpError(err?.message || "Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!token) return;

    setOtpLoading(true);
    setOtpError("");
    setOtpNote("");

    try {
      await apiFetch("/api/auth/reset-password/verify-otp", {
        method: "POST",
        body: JSON.stringify({ token, otp: String(otp).trim() }),
      });

      setOtpVerified(true);
      setView("form");
      setOtpNote("Verified. You can now set a new password.");
      setOtpError("");
    } catch (err) {
      setOtpVerified(false);
      setOtpError(err?.message || "Invalid code. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };



  
  // Cooldown countdown for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

const canSubmit = view === "form" && otpVerified && !!token && password.length >= 8 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (view !== "form") return;

    setError("");

    if (!token) {
      setView("expired");
      setNote("Reset link is missing or invalid. Please request a new one.");
      return;
    }

    if (!otpVerified) {
      setView("otp");
      setOtpError("Please verify the 6-digit code sent to your email first.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });

      setView("success");
      setNote("Password updated. Redirecting to login…");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      const msg = err?.message || "Reset link is invalid or expired.";

      // Treat token issues as an "expired/invalid link" UX state.
      if (/expired|invalid|token/i.test(msg)) {
        setView("expired");
        setNote(msg);
        setPassword("");
        setConfirm("");
        return;
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <style>{`
        @keyframes charIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* calm mental-health glow */
        @keyframes glowPulse {
          0% { transform: scale(1); opacity: .18; }
          50% { transform: scale(1.06); opacity: .28; }
          100% { transform: scale(1); opacity: .18; }
        }

        @media (prefers-reduced-motion: reduce) {
          .mh-anim {
            animation: none !important;
          }
        }
      `}</style>

      {/* Page wrapper */}
      <div
        className="min-h-[78vh] px-6 py-12 flex items-center justify-center"
        style={{
          background:
            "radial-gradient(900px 480px at 65% 45%, rgba(185,255,102,0.18), transparent 60%)",
        }}
      >
        <div className="w-full max-w-[1180px] grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* LEFT SIDE */}
          <div className="w-full max-w-[520px] mx-auto lg:mx-0">
            <AnimatedChars
              text="RESET PASSWORD"
              className="
                text-[20px] xs:text-[22px] sm:text-[28px] lg:text-[30px]
                font-extrabold text-black
                tracking-[0.12em] sm:tracking-[0.18em]
                leading-tight
                break-words
              "
            />

            <p className="text-[13px] sm:text-[14px] text-black/60 mt-3">
              {view === "form"
                ? "Enter a new password for your account."
                : view === "otp"
                ? "Enter the 6-digit code we emailed you."
                : "This reset link can only be used for a short time."}
            </p>

            {/* Card */}
            <div className="mt-6 rounded-[18px] bg-white border border-black/10 p-5 sm:p-7 shadow-[0_14px_28px_rgba(0,0,0,0.08)]">
              
              {view === "otp" ? (
                <div className="flex flex-col gap-4">
                  {otpError ? (
                    <div className="rounded-[14px] border border-black/10 bg-[#FFECEC] px-4 py-3 text-[13px]">
                      <span className="font-extrabold">Error:</span> {otpError}
                    </div>
                  ) : null}

                  <div className="rounded-[14px] border border-black/10 bg-[#F4FFE7] px-4 py-3 text-[13px]">
                    <span className="font-extrabold">Code sent!</span>{" "}
                    {otpNote || "We sent a 6-digit code to your email. Please check your inbox."}
                  </div>

                  <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <label className="text-[13px] font-bold text-black">
                        One-time code (OTP)
                      </label>
                      <input
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(String(e.target.value || "").replace(/\D/g, "").slice(0, 6))}
                        className="
                          w-full rounded-[12px]
                          bg-[#EEF5FF]
                          px-4 py-3 text-[14px]
                          outline-none
                          border border-black/10
                          focus:ring-2 focus:ring-black/10
                        "
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!otpCanVerify || otpLoading}
                      className={`w-full rounded-[12px] py-3 text-[14px] font-extrabold transition
                        ${
                          !otpCanVerify || otpLoading
                            ? "bg-black/20 text-white cursor-not-allowed"
                            : "bg-black text-white hover:opacity-90"
                        }`}
                    >
                      {otpLoading ? (
                        <span className="inline-flex items-center gap-2 justify-center">
                          <Spinner />
                          Verifying…
                        </span>
                      ) : (
                        "Verify code"
                      )}
                    </button>

                    <div className="flex items-center justify-between text-[13px] pt-1">
                      <Link
                        to="/login"
                        className="font-bold underline underline-offset-4"
                      >
                        Back to login
                      </Link>

                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={otpLoading || cooldown > 0}
                        className={`font-bold underline underline-offset-4 ${
                          otpLoading || cooldown > 0 ? "text-black/40 cursor-not-allowed" : ""
                        }`}
                      >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : "Send again"}
                      </button>
                    </div>

                    <div className="text-[12px] text-black/50">
                      Tip: Use the most recent code sent to your email.
                    </div>
                  </form>
                </div>
              ) : view === "form" ? (

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {error ? (
                    <div className="rounded-[14px] border border-black/10 bg-[#FFECEC] px-4 py-3 text-[13px]">
                      <span className="font-extrabold">Error:</span> {error}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-black">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter a new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="
                        w-full rounded-[12px]
                        bg-[#EEF5FF]
                        px-4 py-3 text-[14px]
                        outline-none
                        border border-black/10
                        focus:ring-2 focus:ring-black/10
                      "
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-black">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Confirm password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      className="
                        w-full rounded-[12px]
                        bg-[#EEF5FF]
                        px-4 py-3 text-[14px]
                        outline-none
                        border border-black/10
                        focus:ring-2 focus:ring-black/10
                      "
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !canSubmit}
                    className={`w-full rounded-[12px] py-3 text-[14px] font-extrabold transition
                      ${
                        loading || !canSubmit
                          ? "bg-black/20 text-white cursor-not-allowed"
                          : "bg-black text-white hover:opacity-90"
                      }`}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2 justify-center">
                        <Spinner />
                        Updating…
                      </span>
                    ) : (
                      "Update password"
                    )}
                  </button>

                  <div className="flex items-center justify-between text-[13px] pt-1">
                    <Link
                      to="/login"
                      className="font-bold underline underline-offset-4"
                    >
                      Back to login
                    </Link>

                    <Link
                      to="/forgotpassword"
                      className="font-bold underline underline-offset-4"
                    >
                      Request new link
                    </Link>
                  </div>

                  <div className="text-[12px] text-black/50">
                    Tip: Choose a strong password you haven’t used before.
                  </div>
                </form>
              ) : view === "success" ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-[14px] border border-black/10 bg-[#F4FFE7] px-4 py-3 text-[13px]">
                    <span className="font-extrabold">Updated!</span> {note}
                  </div>

                  <div className="flex items-center justify-between text-[13px]">
                    <Link
                      to="/login"
                      className="font-bold underline underline-offset-4"
                    >
                      Back to login
                    </Link>

                    <span className="text-black/60 font-bold">
                      Redirecting…
                    </span>
                  </div>

                  <div className="text-[12px] text-black/50">
                    Tip: If you don’t get redirected, go back to login manually.
                  </div>
                </div>
              ) : (
                // EXPIRED / INVALID LINK (matches the "Sent!" UX from ForgotPassword)
                <div className="flex flex-col gap-4">
                  <div className="rounded-[14px] border border-black/10 bg-[#FFF1E7] px-4 py-3 text-[13px]">
                    {view === "checking" ? (
                      <span className="font-extrabold">Checking…</span>
                    ) : (
                      <span className="font-extrabold">Expired!</span>
                    )}{" "}{note || "This reset link is invalid or expired. Please request a new one."}
                  </div>

                  <div className="flex items-center justify-between text-[13px]">
                    <Link
                      to="/login"
                      className="font-bold underline underline-offset-4"
                    >
                      Back to login
                    </Link>

                    <Link
                      to="/forgotpassword"
                      className="font-bold underline underline-offset-4"
                    >
                      Send again
                    </Link>
                  </div>

                  <div className="text-[12px] text-black/50">
                    Tip: Request a new link and open the most recent email.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="relative flex justify-center">
            {/* subtle glow behind illustration */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] lg:w-[460px] lg:h-[460px] rounded-full bg-[#B9FF66]/30 blur-[90px] mh-anim animate-[glowPulse_7s_ease-in-out_infinite]" />
            </div>

            <img
              src={signImg}
              alt="Mental health support illustration"
              className="
                relative
                w-full
                max-w-[320px]
                sm:max-w-[420px]
                lg:max-w-[700px]
                object-contain
              "
              draggable="false"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
