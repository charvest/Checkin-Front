import { apiFetch } from "../../api/apiFetch";

// src/pages/CounselorDashboard/counselor.api.js
/**
 * Counselor Dashboard API (STATIC for now)
 * Later: replace implementations with real HTTP calls (fetch/axios).
 *
 * Supports:
 * - Inbox (Ask a Question)
 * - Unmask identity flow (incident required)
 * - Dashboard stats
 * - Activity log (static)
 * - Student Accounts (delete/retrieve - static)
 */


const INBOX_KEY = "checkin:counselor_inbox_items";
const ACTIVITY_KEY = "checkin:counselor_activity_log";
const STUDENTS_KEY = "checkin:student_accounts";

// Static counselor password phrase (used for delete double verification)
const COUNSELOR_PASSWORD_PHRASE = "Are you sure you want to Delete this Account";

// (Optional) second phrase for "Double Verification"
const COUNSELOR_PASSWORD_PHRASE_2 = "if yes it will be gone forever";

/* ===================== HELPERS ===================== */
function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function nowStamp() {
  const d = new Date();
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function counselorSetThreadStatus(askId, status) {
  const res = await fetch(`/api/counselor/asks/${askId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Failed to update status");
  }

  return res.json();
}

function saveInbox(items) {
  localStorage.setItem(INBOX_KEY, JSON.stringify(items));
}

function loadInbox() {
  const raw = localStorage.getItem(INBOX_KEY);
  const parsed = safeParse(raw || "null", null);

  if (Array.isArray(parsed) && parsed.length) return parsed;

  // ✅ Seed demo inbox (STATIC)
  const seeded = [
    {
      id: "ASK-2001",
      date: "2026-01-10",
      topic: "Anxiety / Overthinking",
      message:
        "I feel anxious at night and I can't sleep. I keep thinking about school and my future.",
      anonymous: true,
      studentName: "Hidden",
      read: false,
      flags: [],
      hardBlocked: false,
      unmasked: false,
      studentIdentity: null,
      incidentId: null,
      incidentStatus: null,
      thread: [],

      phq9: {
        total: 12,
        answers: [1, 2, 1, 2, 1, 1, 2, 1, 1],
        submittedAt: "2026-01-10 08:44",
        risk: "Moderate",
      },

      moodTracking: {
        familyConsent: false,
        lastUpdated: "2026-01-10",
        entries: [
          { date: "2026-01-08", mood: "Anxious", note: "Hard to sleep." },
          { date: "2026-01-09", mood: "Sad", note: "Overthinking again." },
        ],
      },
    },
    {
      id: "ASK-2002",
      date: "2026-01-10",
      topic: "Academic stress",
      message:
        "I am overwhelmed with deadlines and I don't know how to manage. I feel like I'm failing.",
      anonymous: false,
      studentName: "Maria Santos",
      read: true,
      flags: [],
      hardBlocked: false,
      unmasked: true,
      studentIdentity: {
        fullName: "Maria Santos",
        studentId: "2023-008899",
        campus: "Main Campus",
        gradeLevel: "Grade 12",
        department: "STEM",
      },
      incidentId: null,
      incidentStatus: null,
      thread: [
        {
          id: "T-1",
          by: "Student",
          at: "2026-01-10 09:18",
          text: "I am overwhelmed with deadlines and I don't know how to manage.",
        },
      ],

      phq9: {
        total: 6,
        answers: [0, 1, 1, 1, 0, 1, 1, 0, 1],
        submittedAt: "2026-01-10 07:30",
        risk: "Mild",
      },

      moodTracking: {
        familyConsent: true,
        lastUpdated: "2026-01-10",
        entries: [
          { date: "2026-01-07", mood: "Okay", note: "Busy week." },
          { date: "2026-01-09", mood: "Stressed", note: "Deadlines piling up." },
          { date: "2026-01-10", mood: "Anxious", note: "Feeling pressure." },
        ],
      },
    },
    {
      id: "ASK-2003",
      date: "2026-01-09",
      topic: "Self-harm / Safety",
      message:
        "Sometimes I feel like I don't want to be here anymore. I don't know who to talk to.",
      anonymous: true,
      studentName: "Hidden",
      read: true,
      flags: ["Safety"],
      hardBlocked: false,
      unmasked: false,
      studentIdentity: null,
      incidentId: "INC-1001",
      incidentStatus: "Open",
      thread: [
        {
          id: "T-1",
          by: "Student",
          at: "2026-01-09 16:02",
          text: "Sometimes I feel like I don't want to be here anymore.",
        },
      ],

      phq9: {
        total: 19,
        answers: [2, 2, 2, 3, 2, 2, 2, 2, 2],
        submittedAt: "2026-01-09 15:40",
        risk: "Moderately Severe",
      },

      moodTracking: {
        familyConsent: false,
        lastUpdated: "2026-01-09",
        entries: [
          { date: "2026-01-06", mood: "Sad", note: "Feel alone." },
          { date: "2026-01-08", mood: "Down", note: "No motivation." },
          { date: "2026-01-09", mood: "Unsafe", note: "I don't feel okay." },
        ],
      },
    },
    {
      id: "ASK-2004",
      date: "2026-01-09",
      topic: "Anger / Profanity",
      message:
        "This is so f***ing stressful. I'm tired of everything and I hate school.",
      anonymous: true,
      studentName: "Hidden",
      read: false,
      flags: ["Profanity"],
      hardBlocked: true,
      unmasked: false,
      studentIdentity: null,
      incidentId: "INC-1002",
      incidentStatus: "Resolved",
      thread: [],
      moodTracking: {
        familyConsent: false,
        lastUpdated: "2026-01-09",
        entries: [{ date: "2026-01-09", mood: "Angry", note: "Very stressed." }],
      },
    },
  ];

  saveInbox(seeded);
  return seeded;
}

/* ===================== ACTIVITY LOG ===================== */
function saveActivity(list) {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list));
}

function loadActivity() {
  const raw = localStorage.getItem(ACTIVITY_KEY);
  const parsed = safeParse(raw || "null", null);
  if (Array.isArray(parsed)) return parsed;
  const seeded = [];
  saveActivity(seeded);
  return seeded;
}


/* ===================== STUDENT ACCOUNTS (STATIC) ===================== */
function saveStudents(list) {
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(list));
}

function loadStudents() {
  const raw = localStorage.getItem(STUDENTS_KEY);
  const parsed = safeParse(raw || "null", null);
  if (Array.isArray(parsed) && parsed.length) return parsed;

  const seeded = [
    {
      email: "mariasantos@gmail.com",
      studentId: "2023-008899",
      createdMonth: "01",
      createdYear: "2023",
      status: "active",
      uploadedIdName: "Maria_ID.png",
    },
    {
      email: "johnreyes@yahoo.com",
      studentId: "2023-001122",
      createdMonth: "07",
      createdYear: "2023",
      status: "active",
      uploadedIdName: "John_ID.png",
    },
    {
      email: "annecruz@gmail.com",
      studentId: "2023-009911",
      createdMonth: "12",
      createdYear: "2022",
      status: "deleted",
      uploadedIdName: "Anne_ID.png",
    },
  ];

  saveStudents(seeded);
  return seeded;
}

/* ===================== GENERAL HELPERS (EXPORTED) ===================== */
export function getCounselorActivityLog() {
  return loadActivity();
}

export function logActivity(entry) {
  const list = loadActivity();
  const next = [
    {
      id: `ACT-${Date.now()}`,
      ...entry,
    },
    ...list,
  ].slice(0, 200);

  saveActivity(next);
  return next[0];
}

function updateInboxItem(askId, updater) {
  const items = loadInbox();
  const idx = items.findIndex((x) => x.id === askId);
  if (idx === -1) return null;

  const current = items[idx];
  const next = typeof updater === "function" ? updater(current) : current;

  const updated = [...items];
  updated[idx] = next;
  saveInbox(updated);
  return next;
}

/* ===================== INBOX EXPORTS ===================== */
export function getAskInboxItems() {
  return loadInbox();
}

export function counselorReplyToAsk(askId, text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  const next = updateInboxItem(askId, (item) => {
    const thread = Array.isArray(item.thread) ? [...item.thread] : [];
    thread.push({
      id: `T-${Date.now()}`,
      by: "Counselor",
      at: nowStamp(),
      text: trimmed,
    });
    return { ...item, read: true, thread };
  });

  if (next) {
    logActivity({
      type: "reply",
      askId,
      message: "Counselor replied to Ask",
      at: nowStamp(),
    });
  }

  return next;
}

// ✅ persist incident creation (so refresh keeps it)
export function createIncidentForAsk(askId) {
  const next = updateInboxItem(askId, (item) => {
    if (item.incidentId) return item;
    return {
      ...item,
      incidentId: `INC-${Date.now()}`,
      incidentStatus: "Open",
    };
  });

  if (next) {
    logActivity({
      type: "incident_create",
      askId,
      message: "Counselor created incident for Ask",
      at: nowStamp(),
    });
  }
  return next;
}

export function requestUnmaskIdentity(askId) {
  const next = updateInboxItem(askId, (item) => {
    if (!item.incidentId) return item;

    const identity = item.studentIdentity || {
      fullName: "Juan Dela Cruz",
      studentId: "2023-004455",
      campus: "Main Campus",
      gradeLevel: "Grade 11",
      department: "ABM",
    };

    return {
      ...item,
      unmasked: true,
      studentIdentity: identity,
      anonymous: false,
      studentName: identity.fullName,
    };
  });

  if (next) {
    logActivity({
      type: "unmask",
      askId,
      message: "Counselor requested unmask",
      at: nowStamp(),
    });
  }

  return next;
}

/* ===================== DASHBOARD STATS ===================== */
export async function getCounselorDashboardStats({ counselorId } = {}) {
  const items = loadInbox();

  const pendingAsk = items.filter((x) => (x.thread || []).length === 0).length;
  const pendingMeet = 2; // placeholder until meet API exists
  const todaysSessions = 1; // placeholder
  const openIncidents = items.filter(
    (x) => x.incidentId && x.incidentStatus !== "Resolved"
  ).length;

  return Promise.resolve({
    counselorId: counselorId || "C-001",
    pendingAsk,
    pendingMeet,
    todaysSessions,
    openIncidents,
  });
}

/* ===================== PASSWORD VERIFICATION ===================== */
export function verifyCounselorPassword(input) {
  return String(input || "").trim() === COUNSELOR_PASSWORD_PHRASE;
}

// optional second phrase for double verify
export function verifyCounselorPassword2(input) {
  return String(input || "").trim() === COUNSELOR_PASSWORD_PHRASE_2;
}

/* ===================== STUDENT ACCOUNTS ===================== */
export async function getStudentAccounts() {
  // Real DB (preferred)
  try {
    const data = await apiFetch("/api/users/students?limit=2000");
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data)) return data;
  } catch {
    // fallback to static
  }
  return loadStudents();
}


export function deleteStudentAccountByEmail(email) {
  const list = loadStudents();
  const e = String(email || "").trim().toLowerCase();

  const idx = list.findIndex((s) => (s.email || "").toLowerCase() === e);
  if (idx === -1) return { ok: false, reason: "Student not found" };

  const updated = [...list];
  updated[idx] = { ...updated[idx], status: "deleted" };
  saveStudents(updated);

  logActivity({
    type: "student_delete",
    email: e,
    message: "Counselor deleted student account (static)",
    at: nowStamp(),
  });

  return { ok: true };
}

export function retrieveStudentAccount({
  email,
  monthOfCreation,
  studentId,
  uploadedIdName,
} = {}) {
  const list = loadStudents();
  const e = String(email || "").trim().toLowerCase();

  const idx = list.findIndex((s) => (s.email || "").toLowerCase() === e);
  if (idx === -1) return { ok: false, reason: "Student not found" };

  const student = list[idx];

  const mm = String(monthOfCreation || "").trim().padStart(2, "0");
  const sid = String(studentId || "").trim();
  const idFile = String(uploadedIdName || "").trim();

  if (student.studentId !== sid) {
    return { ok: false, reason: "Student number mismatch" };
  }
  if (student.createdMonth !== mm) {
    return { ok: false, reason: "Month of creation mismatch" };
  }
  if (!idFile) {
    return { ok: false, reason: "ID upload required" };
  }

  const updated = [...list];
  updated[idx] = { ...updated[idx], status: "active", uploadedIdName: idFile };
  saveStudents(updated);

  logActivity({
    type: "student_retrieve",
    email: e,
    message: "Counselor retrieved student account (static)",
    at: nowStamp(),
  });

  return { ok: true };
}

/**
 * Update a student (Counselor/Admin).
 * Server verifies counselor password against the logged-in counselor's hashed password.
 */
export async function updateStudentAccount({ userId, patch, counselorPassword } = {}) {
  if (!userId) throw new Error("Missing student id");
  const body = { ...(patch || {}), counselorPassword: String(counselorPassword || "") };

  return apiFetch(`/api/users/students/${encodeURIComponent(String(userId))}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
