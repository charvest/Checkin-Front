import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated, getRole } from "../utils/auth";

export default function RequireRole({ allowedRoles = [] }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;

  const role = getRole();
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}