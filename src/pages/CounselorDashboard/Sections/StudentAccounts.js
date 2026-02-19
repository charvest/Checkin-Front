// src/pages/CounselorDashboard/Sections/StudentAccounts.jsx
import { useMemo, useState } from "react";
import {
  getStudentAccounts,
  deleteStudentAccountByEmail,
  retrieveStudentAccount,
} from "../counselor.api";
import DoubleVerifyPhraseModal from "../Components/DoubleVerifyPhraseModal";

const DELETE_PHRASE = "Are you sure you want to Delete this Account";

export default function StudentAccounts() {
  const [students, setStudents] = useState(() => getStudentAccounts());

  // Search list
  const [q, setQ] = useState("");

  // Delete flow
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteErr, setDeleteErr] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteToast, setDeleteToast] = useState("");

  // Retrieve flow
  const [rEmail, setREmail] = useState("");
  const [rStudentNo, setRStudentNo] = useState("");
  const [rCreatedMonth, setRCreatedMonth] = useState(""); // YYYY-MM
  const [rIdFile, setRIdFile] = useState(null);
  const [retrieveMsg, setRetrieveMsg] = useState("");

  const refresh = () => setStudents(getStudentAccounts());

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return students;

    return students.filter((s) => {
      const hay = `${s.email} ${s.studentNumber} ${s.createdMonth} ${s.status}`.toLowerCase();
      return hay.includes(query);
    });
  }, [students, q]);

  const notifyDelete = (msg, ms = 1600) => {
    setDeleteToast(msg);
    window.clearTimeout(window.__studentDeleteToastTimer);
    window.__studentDeleteToastTimer = window.setTimeout(() => setDeleteToast(""), ms);
  };

  /* ===================== DELETE ===================== */
  const openDeleteModal = () => {
    setDeleteErr("");
    const email = deleteEmail.trim();
    if (!email) {
      setDeleteErr("Student email is required.");
      return;
    }
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    const email = deleteEmail.trim();
    const res = deleteStudentAccountByEmail(email);

    if (!res?.ok) {
      setDeleteErr("Student not found.");
      return;
    }

    setDeleteEmail("");
    refresh();
    notifyDelete("Student account deleted (static/local).");
  };

  /* ===================== RETRIEVE ===================== */
  const doRetrieve = () => {
    setRetrieveMsg("");

    const email = rEmail.trim();
    const studentNumber = rStudentNo.trim();
    const createdMonth = rCreatedMonth.trim();

    if (!email || !studentNumber || !createdMonth) {
      setRetrieveMsg("Email, student number, and month of creation are required.");
      return;
    }
    if (!rIdFile) {
      setRetrieveMsg("Upload ID is required.");
      return;
    }

    const res = retrieveStudentAccount({
      email,
      studentNumber,
      createdMonth,
      hasUploadedId: true,
    });

    if (!res?.ok) {
      const map = {
        not_found: "Student not found.",
        student_number_mismatch: "Student number does not match.",
        created_month_mismatch: "Month of creation does not match.",
        missing_id_upload: "Upload ID is required.",
      };
      setRetrieveMsg(map[res?.reason] || "Verification failed.");
      return;
    }

    setRetrieveMsg("✅ Account retrieved successfully (Recovered).");
    refresh();

    // reset fields
    setRIdFile(null);
  };

  return (
    <div className="space-y-4">
      {/* Delete Modal (double verification phrase) */}
      <DoubleVerifyPhraseModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        phrase={DELETE_PHRASE}
        title="Delete Student Account"
        warningLine1="Are you sure you want to Delete this Account"
        warningLine2="if yes it will be gone forever"
        confirmLabel="Delete Forever"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black tracking-tight">Student Accounts</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Delete or retrieve student accounts (static/localStorage).
          </p>
        </div>

        <button
          onClick={refresh}
          className="px-3 py-2 rounded-xl text-sm font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search students by email, number, month, status…"
            className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-slate-100"
          />
        </div>
      </div>

      {/* Delete section */}
      <section className="rounded-2xl border border-red-100 bg-red-50 p-4">
        <div className="text-sm font-black text-red-800">Delete Account of Students</div>
        <div className="mt-1 text-[12px] font-bold text-red-700">
          Type the student email. Then you must type the verification phrase inside the modal.
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <input
            value={deleteEmail}
            onChange={(e) => {
              setDeleteEmail(e.target.value);
              setDeleteErr("");
            }}
            placeholder="student@email.com"
            className="h-11 flex-1 min-w-[220px] rounded-xl border border-red-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none"
          />
          <button
            onClick={openDeleteModal}
            className="h-11 px-4 rounded-xl text-sm font-black bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>

        {deleteErr ? (
          <div className="mt-2 text-xs font-extrabold text-red-800">{deleteErr}</div>
        ) : null}

        {deleteToast ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            {deleteToast}
          </div>
        ) : null}
      </section>

      {/* Retrieve section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-black text-slate-900">Retrieve Account of Students</div>
        <div className="mt-1 text-[12px] font-bold text-slate-500">
          Please verify the student identity by asking: month of creation, student number, and upload ID.
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs font-extrabold text-slate-600">Student Email</div>
            <input
              value={rEmail}
              onChange={(e) => setREmail(e.target.value)}
              placeholder="student@email.com"
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none"
            />
          </label>

          <label className="block">
            <div className="text-xs font-extrabold text-slate-600">Student Number</div>
            <input
              value={rStudentNo}
              onChange={(e) => setRStudentNo(e.target.value)}
              placeholder="2023-XXXXXX"
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none"
            />
          </label>

          <label className="block">
            <div className="text-xs font-extrabold text-slate-600">Month of Creation</div>
            <input
              type="month"
              value={rCreatedMonth}
              onChange={(e) => setRCreatedMonth(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none"
            />
          </label>

          <label className="block">
            <div className="text-xs font-extrabold text-slate-600">Upload ID</div>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setRIdFile(e.target.files?.[0] || null)}
              className="mt-1 w-full text-sm font-bold text-slate-700"
            />
            {rIdFile ? (
              <div className="mt-1 text-[12px] font-bold text-slate-500">
                Selected: <span className="text-slate-700">{rIdFile.name}</span>
              </div>
            ) : null}
          </label>
        </div>

        {retrieveMsg ? (
          <div className="mt-3 text-sm font-extrabold text-slate-700">{retrieveMsg}</div>
        ) : null}

        <div className="mt-3 flex justify-end">
          <button
            onClick={doRetrieve}
            className="h-11 px-4 rounded-xl text-sm font-black bg-slate-900 text-white hover:bg-slate-800"
          >
            Verify + Retrieve
          </button>
        </div>
      </section>

      {/* Students list */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="text-sm font-extrabold text-slate-700">
            Students <span className="text-slate-500">({filtered.length})</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-sm font-semibold text-slate-500">
            No students found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <div key={s.email} className="px-4 py-3">
                <div className="text-sm font-extrabold text-slate-800">{s.email}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Student #:{" "}
                  <span className="font-extrabold text-slate-700">{s.studentNumber}</span>{" "}
                  • Created:{" "}
                  <span className="font-extrabold text-slate-700">{s.createdMonth}</span>{" "}
                  • Status:{" "}
                  <span className="font-extrabold text-slate-700">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
