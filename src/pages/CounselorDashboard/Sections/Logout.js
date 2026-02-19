import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../../../utils/auth"; // adjust path if different

const BRAND = "#B9FF66";

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear auth tokens + role + user
    try {
      clearAuth?.();
    } catch {
      // fallback if clearAuth isn't available
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
    }

    // Optional: clear other counselor UI keys if you want
    // localStorage.removeItem("checkin:counselor_prefs");

    const t = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 700);

    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-lg font-black tracking-tight text-slate-900">
            Logging out…
          </div>
          <div className="mt-1 text-sm font-bold text-slate-500">
            Please wait. You will be redirected to Login.
          </div>
        </div>

        <div
          className="h-2 w-32 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${BRAND}, rgba(185,255,102,0))`,
          }}
        />
      </div>
    </div>
  );
}
