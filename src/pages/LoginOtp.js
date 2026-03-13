import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/apiFetch";
import {
  clearPendingLogin,
  getPendingLogin,
  getToken,
  getUser,
  setAuth,
  setPendingLogin,
} from "../utils/auth";
import signImg from "../assets/Sign.png";

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

function AnimatedChars({ text, className = "", delay = 18 }) {
  const chars = useMemo(() => text.split(""), [text]);

  return (
    <>
      <h1 className={`${className} sm:hidden`} aria-label={text}>
        {text}
      </h1>

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

function redirectByRole(navigate, role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return navigate("/admin/dashboard");
  if (r === "counselor" || r === "consultant") return navigate("/counselor/dashboard");
  return navigate("/");
}

function maskEmail(email) {
  const value = String(email || "").trim();
  if (!value.includes("@")) return value;
  const [name, domain] = value.split("@");
  if (!name) return value;
  if (name.length <= 2) return `${name[0] || "*"}*@${domain}`;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export default function LoginOtp() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialPending = useMemo(() => {
    const state = location.state && typeof location.state === "object" ? location.state : null;
    return state?.pendingToken ? state : getPendingLogin();
  }, [location.state]);

  const [pending, setPending] = useState(initialPending);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState(
    initialPending?.email
      ? `We sent a 6-digit code to ${maskEmail(initialPending.email)}.`
      : "We sent a 6-digit code to your email."
  );
  const [cooldown, setCooldown] = useState(Number(initialPending?.resendIn || 0));

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (token && user?.role) redirectByRole(navigate, user.role);
  }, [navigate]);

  useEffect(() => {
    if (pending?.pendingToken) {
      setPendingLogin(pending);
    }
  }, [pending]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const canVerify = /^[0-9]{6}$/.test(String(otp).trim()) && !loading;

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!pending?.pendingToken) {
      setError("Login session not found. Please go back and log in again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/api/auth/login/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          pendingToken: pending.pendingToken,
          otp: String(otp).trim(),
        }),
      });

      setAuth({
        token: data.token,
        user: data.user,
        rememberMe: Boolean(pending.rememberMe),
      });
      clearPendingLogin({ notify: false });
      redirectByRole(navigate, data.user?.role);
    } catch (err) {
      setError(err?.message || "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pending?.pendingToken || cooldown > 0 || resending) return;

    setResending(true);
    setError("");

    try {
      const data = await apiFetch("/api/auth/login/resend-otp", {
        method: "POST",
        body: JSON.stringify({ pendingToken: pending.pendingToken }),
      });

      const nextCooldown = Number(data?.cooldownSeconds || 60);
      setCooldown(nextCooldown);
      setNote(
        pending?.email
          ? `We sent a fresh 6-digit code to ${maskEmail(pending.email)}.`
          : "We sent a fresh 6-digit code to your email."
      );
    } catch (err) {
      const msg = err?.message || "Failed to resend OTP. Please log in again.";
      setError(msg);
      if (/log in again|session/i.test(msg)) {
        clearPendingLogin({ notify: false });
      }
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = () => {
    clearPendingLogin({ notify: false });
    navigate("/login");
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

      <div
        className="min-h-[78vh] px-6 py-12 flex items-center justify-center"
        style={{
          background:
            "radial-gradient(900px 480px at 65% 45%, rgba(185,255,102,0.18), transparent 60%)",
        }}
      >
        <div className="w-full max-w-[1180px] grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          <div className="w-full max-w-[520px] mx-auto lg:mx-0">
            <AnimatedChars
              text="LOGIN OTP"
              className="
                text-[20px] xs:text-[22px] sm:text-[28px] lg:text-[30px]
                font-extrabold text-black
                tracking-[0.12em] sm:tracking-[0.18em]
                leading-tight
                break-words
              "
            />

            <p className="text-[13px] sm:text-[14px] text-black/60 mt-3">
              Enter the 6-digit code sent to your email to finish logging in.
            </p>

            <div className="mt-6 rounded-[18px] bg-white border border-black/10 p-5 sm:p-7 shadow-[0_14px_28px_rgba(0,0,0,0.08)]">
              {!pending?.pendingToken ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-[14px] border border-black/10 bg-[#FFF1E7] px-4 py-3 text-[13px]">
                    <span className="font-extrabold">Missing session.</span> Please go back and log in again.
                  </div>

                  <div className="flex items-center justify-between text-[13px]">
                    <button
                      type="button"
                      onClick={handleBackToLogin}
                      className="font-bold underline underline-offset-4"
                    >
                      Back to login
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleVerify} className="flex flex-col gap-4">
                  {error ? (
                    <div className="rounded-[14px] border border-black/10 bg-[#FFECEC] px-4 py-3 text-[13px]">
                      <span className="font-extrabold">Error:</span> {error}
                    </div>
                  ) : null}

                  <div className="rounded-[14px] border border-black/10 bg-[#F4FFE7] px-4 py-3 text-[13px]">
                    <span className="font-extrabold">Code sent!</span> {note}
                  </div>

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
                    disabled={!canVerify || loading}
                    className={`w-full rounded-[12px] py-3 text-[14px] font-extrabold transition
                      ${
                        !canVerify || loading
                          ? "bg-black/20 text-white cursor-not-allowed"
                          : "bg-black text-white hover:opacity-90"
                      }`}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2 justify-center">
                        <Spinner />
                        Verifying…
                      </span>
                    ) : (
                      "Verify and login"
                    )}
                  </button>

                  <div className="flex items-center justify-between text-[13px] pt-1">
                    <button
                      type="button"
                      onClick={handleBackToLogin}
                      className="font-bold underline underline-offset-4"
                    >
                      Back to login
                    </button>

                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending || cooldown > 0}
                      className={`font-bold underline underline-offset-4 ${
                        resending || cooldown > 0 ? "text-black/40 cursor-not-allowed" : ""
                      }`}
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Send again"}
                    </button>
                  </div>

                  <div className="text-[12px] text-black/50">
                    Tip: Use the most recent code sent to {maskEmail(pending.email || "your email")}.
                  </div>
                </form>
              )}
            </div>

            <p className="text-[13px] text-black/80 mt-4">
              Need another try?{" "}
              <Link
                to="/login"
                onClick={() => clearPendingLogin({ notify: false })}
                className="font-extrabold underline underline-offset-4 decoration-black/50 hover:decoration-black/80 whitespace-nowrap"
              >
                Start over
              </Link>
            </p>
          </div>

          <div className="relative flex justify-center">
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
