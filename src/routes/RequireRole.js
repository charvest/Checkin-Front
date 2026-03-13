import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated, getRole } from "../utils/auth";

export default function RequireRole({ allowedRoles = [] }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;

  const role = String(getRole() || "").trim().toLowerCase();
  const allowed = (allowedRoles || []).map((r) => String(r || "").trim().toLowerCase());

  if (!role || (allowed.length > 0 && !allowed.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
