// frontend/src/api/journal.api.js
import { apiFetch } from "./apiFetch";

/**
 * Counselor-only: list submitted (no drafts) mood journal entries for a claimed, non-anonymous thread.
 * GET /api/journal/counselor/threads/:threadId/entries?from&to&limit
 */
export async function listCounselorThreadJournalEntries(threadId, { from, to, limit = 600 } = {}) {
  if (!threadId) throw new Error("Missing threadId");
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (limit) qs.set("limit", String(limit));
  const url = `/api/journal/counselor/threads/${encodeURIComponent(String(threadId))}/entries?${qs.toString()}`;
  return apiFetch(url);
}
