// src/pages/AdminDashboard/Sections/adminApi.js
import { apiFetch } from "../../../api/apiFetch";

/**
 * Admin Analytics
 * GET /api/users/admin/analytics
 */
export function getAdminAnalytics() {
  return apiFetch("/api/users/admin/analytics", { method: "GET" });
}
