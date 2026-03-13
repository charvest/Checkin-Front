// src/routes/ProtectedRoute.js
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";

export default function ProtectedRoute() {
  const location = useLocation();
  const { isAuthed } = useAuth();

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
