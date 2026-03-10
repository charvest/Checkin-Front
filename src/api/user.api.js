// frontend/src/api/user.api.js
import { getToken } from "../utils/auth";

/**
 * Fetch currently logged-in user profile
 * Backend: GET /api/users/me
 */
export async function fetchMyProfile() {
  const token = getToken();
  if (!token) throw new Error("Not authorized: missing token");

  const res = await fetch("/api/users/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || "Failed to load profile");
  }

  // ✅ return flat user object (matches your console output)
  return data;
}
