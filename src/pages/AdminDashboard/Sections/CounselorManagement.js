// File: src/pages/AdminDashboard/Sections/CounselorManagement.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Counselor Management / Message (Frontend)
 * - List counselors with filters + pagination (5 rows)
 * - Email button opens in-app modal (To/Subject/Message)
 * - "Open Gmail" opens Gmail compose (popup window) pre-filled
 * - Delete counselor accounts (admin password required)
 * - Responsive: table -> cards on mobile
 * - Fade-right animation on list render/page/filter changes
 * - Delete popup becomes a bottom-sheet on mobile
 *
 * ✅ Campus removed everywhere.
 */

const PAGE_SIZE = 5;

function pad4(n) {
  const s = String(n);
  return s.length >= 4 ? s : "0".repeat(4 - s.length) + s;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function buildNextCounselorId(existing) {
  const nums = existing
    .map((c) => String(c.counselorId || ""))
    .map((id) => {
      const m = id.match(/C-(\d{4,})/i);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((x) => Number.isFinite(x));

  const maxN = nums.length ? Math.max(...nums) : 0;
  return `C-${pad4(maxN + 1)}`;
}

function buildGmailComposeUrl({ to, subject, body }) {
  const base = "https://mail.google.com/mail/?view=cm&fs=1&tf=1";
  const params = new URLSearchParams();
  if (to) params.set("to", String(to).trim());
  if (subject) params.set("su", String(subject));
  if (body) params.set("body", String(body));
  return `${base}&${params.toString()}`;
}

function openPopup(url, name = "cm_gmail_compose") {
  const popupWidth = 920;
  const popupHeight = 720;

  const baseX = Number.isFinite(window.screenX) ? window.screenX : 0;
  const baseY = Number.isFinite(window.screenY) ? window.screenY : 0;

  const outerW = Number.isFinite(window.outerWidth) ? window.outerWidth : window.innerWidth;
  const outerH = Number.isFinite(window.outerHeight) ? window.outerHeight : window.innerHeight;

  const left = Math.max(0, Math.round(baseX + (outerW - popupWidth) / 2));
  const top = Math.max(0, Math.round(baseY + (outerH - popupHeight) / 2));

  const features = [
    "popup=yes",
    `width=${popupWidth}`,
    `height=${popupHeight}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");

  const win = window.open(url, name, features);

  if (!win) {
    window.open(url, "_blank", "noopener,noreferrer");
    return null;
  }

  try {
    win.opener = null;
  } catch {}
  win.focus();
  return win;
}

const initialCounselors = [
  {
    _id: "c1",
    fullName: "Angela Ramos",
    counselorId: "C-0001",
    email: "angela.ramos@checkin.edu.ph",
    createdAt: "2024-08-15T08:10:00.000Z",
  },
  {
    _id: "c2",
    fullName: "Jerome Villanueva",
    counselorId: "C-0002",
    email: "jerome.villanueva@checkin.edu.ph",
    createdAt: "2024-07-02T10:20:00.000Z",
  },
  {
    _id: "c3",
    fullName: "Mika Santos",
    counselorId: "C-0003",
    email: "mika.santos@checkin.edu.ph",
    createdAt: "2024-06-10T03:30:00.000Z",
  },
  {
    _id: "c4",
    fullName: "Paolo Reyes",
    counselorId: "C-0004",
    email: "paolo.reyes@checkin.edu.ph",
    createdAt: "2024-03-11T11:15:00.000Z",
  },
];

export default function CounselorManagement() {
  const [counselors, setCounselors] = useState(initialCounselors);

  // Create form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [counselorId, setCounselorId] = useState("");
  const [formMsg, setFormMsg] = useState({ type: "", text: "" });

  // Filters
  const [query, setQuery] = useState("");

  // Paging
  const [page, setPage] = useState(1);

  // Delete modal + password
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [deleteErr, setDeleteErr] = useState("");

  // Email modal
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // Prevent browser autofill junk (random numbers)
  const [pwReady, setPwReady] = useState(false);
  const [pwFieldName, setPwFieldName] = useState("cm_admin_pw");

  const passRef = useRef(null);
  const containerRef = useRef(null);

  // Animation trigger
  const [animTick, setAnimTick] = useState(0);

  // Auto-suggest counselor id (editable)
  useEffect(() => {
    if (!counselorId) setCounselorId(buildNextCounselorId(counselors));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counselors]);

  // Trigger list animation on changes
  useEffect(() => {
    setAnimTick((t) => t + 1);
  }, [page, query]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    return counselors.filter((c) => {
      if (!q) return true;
      return (
        String(c.fullName || "").toLowerCase().includes(q) ||
        String(c.email || "").toLowerCase().includes(q) ||
        String(c.counselorId || "").toLowerCase().includes(q)
      );
    });
  }, [counselors, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const pageWindow = useMemo(() => {
    const max = totalPages;
    const curr = page;
    const size = 5;

    let start = Math.max(1, curr - Math.floor(size / 2));
    let end = start + size - 1;

    if (end > max) {
      end = max;
      start = Math.max(1, end - size + 1);
    }

    const arr = [];
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }, [page, totalPages]);

  const clearFormMsgSoon = () => {
    window.clearTimeout(clearFormMsgSoon._t);
    clearFormMsgSoon._t = window.setTimeout(() => {
      setFormMsg({ type: "", text: "" });
    }, 2500);
  };

  const handleCreate = (e) => {
    e.preventDefault();

    const name = String(fullName || "").trim();
    const em = String(email || "").trim().toLowerCase();
    const cid = String(counselorId || "").trim().toUpperCase();

    if (!name) {
      setFormMsg({ type: "error", text: "Please enter counselor name." });
      clearFormMsgSoon();
      return;
    }
    if (!em || !isValidEmail(em)) {
      setFormMsg({ type: "error", text: "Please enter a valid counselor email." });
      clearFormMsgSoon();
      return;
    }
    if (!cid) {
      setFormMsg({ type: "error", text: "Counselor ID is required." });
      clearFormMsgSoon();
      return;
    }

    const emailTaken = counselors.some((c) => String(c.email || "").toLowerCase() === em);
    if (emailTaken) {
      setFormMsg({ type: "error", text: "This email is already used." });
      clearFormMsgSoon();
      return;
    }

    const idTaken = counselors.some((c) => String(c.counselorId || "").toUpperCase() === cid);
    if (idTaken) {
      setFormMsg({ type: "error", text: "This Counselor ID already exists." });
      clearFormMsgSoon();
      return;
    }

    const newCounselor = {
      _id: `c_${Date.now()}`,
      fullName: name,
      counselorId: cid,
      email: em,
      createdAt: new Date().toISOString(),
    };

    setCounselors((prev) => [newCounselor, ...prev]);
    setFormMsg({ type: "success", text: "Counselor account created." });
    clearFormMsgSoon();

    setFullName("");
    setEmail("");
    setCounselorId("");
    setAnimTick((t) => t + 1);

    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const deleteCounselor = (id) => {
    setCounselors((prev) => prev.filter((c) => c._id !== id));
    setAnimTick((t) => t + 1);
  };

  const closeDeletePopup = () => {
    setDeleteOpen(false);
    setDeleteTarget(null);
    setAdminPassword("");
    setDeleteErr("");
    setPwReady(false);
  };

  const closeEmailPopup = () => {
    setEmailOpen(false);
    setEmailTarget(null);
    setEmailTo("");
    setEmailSubject("");
    setEmailBody("");
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (deleteOpen) closeDeletePopup();
        if (emailOpen) closeEmailPopup();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteOpen, emailOpen]);

  const openDeletePopup = (c) => {
    setDeleteTarget(c);
    setAdminPassword("");
    setDeleteErr("");
    setDeleteOpen(true);

    setPwFieldName(`cm_admin_pw_${Date.now()}`);
    setPwReady(false);

    setTimeout(() => {
      setAdminPassword("");
      setPwReady(true);
      passRef.current?.focus();
    }, 80);
  };

  const confirmDelete = () => {
    const pw = String(adminPassword || "").trim();
    if (!pw) {
      setDeleteErr("Admin password is required.");
      return;
    }
    deleteCounselor(deleteTarget?._id);
    closeDeletePopup();
  };

  const openEmailModal = (c) => {
    setEmailTarget(c);

    const to = String(c?.email || "").trim();
    const name = String(c?.fullName || "").trim();

    setEmailTo(to);
    setEmailSubject(`CheckIn — Notice for Counselor (${name})`);
    setEmailBody([`Greetings ${name},`, "", "", "", "", ""].join("\n"));

    setEmailOpen(true);
  };

  const openGmailFromModal = () => {
    const to = String(emailTo || "").trim();
    if (!to || !isValidEmail(to)) return;

    const url = buildGmailComposeUrl({
      to,
      subject: emailSubject || "",
      body: emailBody || "",
    });

    openPopup(url, "cm_gmail_compose");
    closeEmailPopup();
  };

  return (
    <div ref={containerRef} className="cm-wrap">
      <style>{`
        @keyframes cmFadeRight {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes cmOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cmSheetUp {
          from { transform: translateY(18px); opacity: .98; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes cmDialogPop {
          from { transform: translateY(6px) scale(.98); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }

        .cm-wrap{
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 0 0 26px;
          min-width: 0;
        }

        .cm-card{
          width: 100%;
          background:#fff;
          border:1px solid #e5eaf2;
          border-radius:14px;
          box-shadow: 0 1px 0 rgba(15,23,42,0.02);
          overflow: hidden;
        }

        .cm-cardHeader{
          padding: 14px 14px 10px;
          border-bottom: 1px solid #edf2f7;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
        }
        .cm-cardHeader h2{
          margin:0;
          font-size: 14px;
          font-weight: 900;
          color:#0f172a;
          letter-spacing: .2px;
        }
        .cm-cardHeader small{
          color:#64748b;
          font-weight: 700;
          font-size: 12px;
        }

        .cm-field label{
          display:block;
          font-size: 12px;
          color:#475569;
          font-weight: 800;
          margin: 0 0 6px;
        }

        .cm-input{
          width:100%;
          height: 42px;
          padding: 10px 12px;
          border-radius: 12px;
          border:1px solid #dbe4f0;
          outline: none;
          font-weight: 700;
          font-size: 14px;
          color:#0f172a;
          background:#fff;
          min-width: 0;
          box-sizing: border-box;
          max-width: 100%;
        }

        .cm-textarea{
          width:100%;
          min-height: 140px;
          padding: 10px 12px;
          border-radius: 12px;
          border:1px solid #dbe4f0;
          outline: none;
          font-weight: 700;
          font-size: 14px;
          color:#0f172a;
          background:#fff;
          resize: vertical;
          box-sizing: border-box;
        }

        .cm-input:focus, .cm-textarea:focus{
          border-color:#93c5fd;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.12);
        }

        .cm-btn{
          height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid #0f172a;
          background:#0f172a;
          color:#fff;
          font-weight: 900;
          cursor:pointer;
          white-space: nowrap;
          font-size: 14px;
        }

        .cm-msg{
          grid-column: 1 / -1;
          margin-top: 2px;
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 900;
          font-size: 13px;
          border: 1px solid transparent;
        }
        .cm-msg--success{
          background: rgba(34,197,94,0.10);
          border-color: rgba(34,197,94,0.25);
          color:#166534;
        }
        .cm-msg--error{
          background: rgba(239,68,68,0.10);
          border-color: rgba(239,68,68,0.25);
          color:#991b1b;
        }

        .cm-form{
          padding: 12px 14px 14px;
          display:grid;
          grid-template-columns: 1.2fr 1fr 0.6fr auto;
          gap: 10px;
          align-items:end;
          min-width: 0;
        }

        .cm-filters{
          margin-top: 14px;
          padding: 12px;
        }
        .cm-filtersGrid{
          display:grid;
          grid-template-columns: 1fr;
          gap: 10px;
          align-items:end;
          min-width: 0;
        }

        .cm-tableWrap{ margin-top: 14px; overflow:hidden; }
        .cm-tableHeader{
          padding: 12px 14px;
          border-bottom: 1px solid #edf2f7;
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap: 10px;
          background: #fff;
        }
        .cm-tableHeaderLeft{ display:flex; flex-direction:column; gap: 2px; }
        .cm-tableHeaderLeft .title{
          font-weight: 950;
          color:#0f172a;
          font-size: 14px;
        }
        .cm-tableHeaderLeft .sub{
          font-weight: 800;
          color:#64748b;
          font-size: 12px;
        }

        .cm-table{
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .cm-table th:nth-child(4),
        .cm-table td:nth-child(4){
          white-space: nowrap;
          overflow: visible !important;
          text-overflow: clip !important;
        }

        .cm-table th{
          text-align:left;
          font-size: 11px;
          letter-spacing: .4px;
          text-transform: uppercase;
          color:#64748b;
          font-weight: 950;
          padding: 10px 14px;
          background:#fbfdff;
          border-bottom: 1px solid #edf2f7;
        }
        .cm-table td{
          padding: 12px 14px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: top;
          color:#0f172a;
          font-weight: 800;
          font-size: 14px;
          overflow:hidden;
          text-overflow: ellipsis;
        }
        .cm-table tr:last-child td{ border-bottom: none; }

        .cm-name{
          display:flex;
          flex-direction:column;
          gap: 3px;
          min-width: 0;
        }
        .cm-nameMain{
          font-weight: 950;
          font-size: 15px;
          line-height: 1.2;
        }

        .cm-actionRow{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          gap: 8px;
        }
        .cm-linkBtn{
          border:1px solid #dbe4f0;
          background:#fff;
          color:#0f172a;
          font-weight: 950;
          padding: 9px 12px;
          border-radius: 12px;
          cursor:pointer;
          white-space: nowrap;
          font-size: 13px;
        }
        .cm-linkBtn:hover{ background:#f8fafc; }
        .cm-danger{
          border-color: rgba(239,68,68,0.30);
          color:#b91c1c;
          background: rgba(239,68,68,0.06);
        }
        .cm-gmail{
          border-color: rgba(15,23,42,0.22);
          background: rgba(15,23,42,0.04);
        }

        .cm-animRow td{
          animation: cmFadeRight 220ms ease both;
          will-change: transform, opacity;
        }
        .cm-animCard{
          animation: cmFadeRight 220ms ease both;
          will-change: transform, opacity;
        }

        .cm-pager{
          display:flex;
          justify-content:center;
          align-items:center;
          gap: 10px;
          padding: 12px;
          border-top: 1px solid #edf2f7;
          background:#fff;
        }
        .cm-pill{
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display:flex;
          align-items:center;
          justify-content:center;
          border:1px solid #dbe4f0;
          background:#fff;
          font-weight: 950;
          color:#0f172a;
          user-select: none;
          font-size: 13px;
        }
        .cm-pill--active{
          border-color:#0f172a;
          background:#0f172a;
          color:#fff;
        }
        .cm-pagerBtn{
          height: 36px;
          padding: 0 12px;
          border-radius: 12px;
          border:1px solid #dbe4f0;
          background:#fff;
          font-weight: 950;
          color:#0f172a;
          cursor:pointer;
          font-size: 13px;
        }
        .cm-pagerBtn:disabled{
          opacity:.55;
          cursor:not-allowed;
        }

        .cm-cards{ display:none; padding: 10px 12px 12px; background:#fff; }
        .cm-cardItem{
          border:1px solid #eef2f7;
          border-radius: 16px;
          padding: 12px;
          background:#fff;
          margin-bottom: 10px;
        }
        .cm-cardItem:last-child{ margin-bottom: 0; }
        .cm-cardTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 10px;
        }
        .cm-cardName{
          font-weight: 950;
          color:#0f172a;
          font-size: 16px;
          line-height: 1.2;
        }
        .cm-subtext{
          font-size: 13px;
          color:#64748b;
          font-weight: 800;
        }
        .cm-grid2{
          margin-top: 10px;
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .cm-k{
          font-size: 11px;
          color:#64748b;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .3px;
          margin-bottom: 4px;
        }
        .cm-v{
          font-size: 14px;
          color:#0f172a;
          font-weight: 900;
          word-break: break-word;
        }
        .cm-cardActions{
          margin-top: 12px;
          display:flex;
          justify-content:flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .cm-modalOverlay{
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.35);
          display:flex;
          align-items:center;
          justify-content:center;
          padding: 18px;
          z-index: 9999;
          animation: cmOverlayIn 140ms ease both;
        }
        .cm-modal{
          width: 100%;
          max-width: 560px;
          background:#fff;
          border:1px solid #e5eaf2;
          border-radius: 18px;
          box-shadow: 0 18px 50px rgba(15,23,42,0.20);
          overflow:hidden;
          animation: cmDialogPop 160ms ease both;
        }
        .cm-modalHeader{
          padding: 12px 14px;
          border-bottom: 1px solid #edf2f7;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          background:#fff;
        }
        .cm-modalTitle{
          font-weight: 950;
          color:#0f172a;
          font-size: 14px;
        }
        .cm-x{
          border:1px solid #dbe4f0;
          background:#fff;
          width: 36px;
          height: 36px;
          border-radius: 12px;
          cursor:pointer;
          font-weight: 950;
          color:#0f172a;
          font-size: 16px;
        }
        .cm-modalBody{
          padding: 12px 14px 14px;
        }
        .cm-dangerText{
          color:#b91c1c;
          font-weight: 950;
          font-size: 12px;
          margin-top: 6px;
        }
        .cm-modalActions{
          margin-top: 12px;
          display:flex;
          justify-content:flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        .cm-secondaryBtn{
          height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid #dbe4f0;
          background:#fff;
          color:#0f172a;
          font-weight: 950;
          cursor:pointer;
          white-space: nowrap;
          font-size: 14px;
        }
        .cm-secondaryBtn:hover{ background:#f8fafc; }

        .cm-sheetHandle{
          display:none;
          height: 20px;
          align-items:center;
          justify-content:center;
          background:#fff;
        }
        .cm-sheetHandle span{
          display:block;
          width: 46px;
          height: 5px;
          border-radius: 999px;
          background: #e5eaf2;
        }

        @media (max-width: 980px){
          .cm-form{ grid-template-columns: 1fr 1fr; }
        }

        @media (max-width: 720px){
          .cm-form{ grid-template-columns: 1fr; }
          .cm-table{ display:none; }
          .cm-cards{ display:block; }

          .cm-modalOverlay{
            align-items: flex-end;
            justify-content: center;
            padding: 10px;
          }
          .cm-modal{
            max-width: none;
            width: 100%;
            border-radius: 18px 18px 14px 14px;
            animation: cmSheetUp 170ms ease both;
          }
          .cm-sheetHandle{ display:flex; }
        }

        @media (max-width: 360px){
          .cm-grid2{ grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Create Counselor */}
      <div className="cm-card">
        <div className="cm-cardHeader">
          <div>
            <h2>Create Counselor Account</h2>
            <small>Set Counselor Email + Counselor ID</small>
          </div>
        </div>

        <form className="cm-form" onSubmit={handleCreate}>
          <div className="cm-field">
            <label>Counselor Name</label>
            <input
              className="cm-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              autoComplete="off"
            />
          </div>

          <div className="cm-field">
            <label>Counselor Email</label>
            <input
              className="cm-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. counselor@checkin.edu.ph"
              autoComplete="off"
              inputMode="email"
            />
          </div>

          <div className="cm-field">
            <label>Counselor ID</label>
            <input
              className="cm-input"
              value={counselorId}
              onChange={(e) => setCounselorId(e.target.value)}
              placeholder="e.g. C-0005"
              autoComplete="off"
            />
          </div>

          <button className="cm-btn" type="submit">
            Create
          </button>

          {formMsg.text ? (
            <div className={"cm-msg " + (formMsg.type === "success" ? "cm-msg--success" : "cm-msg--error")}>
              {formMsg.text}
            </div>
          ) : null}
        </form>
      </div>

      {/* Filters */}
      <div className="cm-card cm-filters">
        <div className="cm-filtersGrid">
          <div className="cm-field">
            <label>Search</label>
            <input
              className="cm-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, counselor id, email..."
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="cm-card cm-tableWrap">
        <div className="cm-tableHeader">
          <div className="cm-tableHeaderLeft">
            <div className="title">Counselors ({filtered.length})</div>
            <div className="sub">
              Page {page} of {totalPages} • Showing {PAGE_SIZE} per page
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <table className="cm-table">
          <thead>
            <tr>
              <th style={{ width: "26%" }}>Counselor</th>
              <th style={{ width: "14%" }}>Counselor ID</th>
              <th style={{ width: "32%" }}>Email</th>
              <th style={{ width: "14%" }}>Created At</th>
              <th style={{ width: "14%", textAlign: "right" }}>Action</th>
            </tr>
          </thead>

          <tbody key={animTick}>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 18, color: "#64748b", fontWeight: 900 }}>
                  No counselors found.
                </td>
              </tr>
            ) : (
              pageItems.map((c, idx) => (
                <tr key={c._id} className="cm-animRow" style={{ animationDelay: `${idx * 18}ms` }}>
                  <td>
                    <div className="cm-name">
                      <div className="cm-nameMain">{c.fullName}</div>
                    </div>
                  </td>

                  <td>{c.counselorId}</td>
                  <td style={{ fontWeight: 900 }}>{c.email}</td>
                  <td>{formatDate(c.createdAt)}</td>

                  <td>
                    <div className="cm-actionRow">
                      <button
                        type="button"
                        className="cm-linkBtn cm-gmail"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openEmailModal(c);
                        }}
                      >
                        Email
                      </button>

                      <button
                        type="button"
                        className="cm-linkBtn cm-danger"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openDeletePopup(c);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Mobile cards */}
        <div className="cm-cards" key={animTick}>
          {pageItems.length === 0 ? (
            <div style={{ padding: 12, color: "#64748b", fontWeight: 900 }}>No counselors found.</div>
          ) : (
            pageItems.map((c, idx) => (
              <div key={c._id} className="cm-cardItem cm-animCard" style={{ animationDelay: `${idx * 18}ms` }}>
                <div className="cm-cardTop">
                  <div>
                    <div className="cm-cardName">{c.fullName}</div>
                    <div className="cm-subtext" style={{ marginTop: 4 }}>
                      {c.counselorId}
                    </div>
                  </div>
                </div>

                <div className="cm-grid2">
                  <div>
                    <div className="cm-k">Email</div>
                    <div className="cm-v">{c.email}</div>
                  </div>
                  <div>
                    <div className="cm-k">Created At</div>
                    <div className="cm-v">{formatDate(c.createdAt)}</div>
                  </div>
                </div>

                <div className="cm-cardActions">
                  <button
                    type="button"
                    className="cm-linkBtn cm-gmail"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEmailModal(c);
                    }}
                  >
                    Email
                  </button>

                  <button
                    type="button"
                    className="cm-linkBtn cm-danger"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openDeletePopup(c);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="cm-pager">
          <button className="cm-pagerBtn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Prev
          </button>

          {pageWindow.map((p) => (
            <div
              key={p}
              className={"cm-pill " + (p === page ? "cm-pill--active" : "")}
              onClick={() => setPage(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setPage(p);
              }}
              style={{ cursor: "pointer" }}
            >
              {p}
            </div>
          ))}

          <button
            className="cm-pagerBtn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {/* Email Modal */}
      {emailOpen && emailTarget ? (
        <div
          className="cm-modalOverlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEmailPopup();
          }}
        >
          <div className="cm-modal" role="dialog" aria-modal="true" aria-label="Send Email (Gmail)">
            <div className="cm-sheetHandle">
              <span />
            </div>

            <div className="cm-modalHeader">
              <div className="cm-modalTitle">Send Email (Gmail)</div>
              <button type="button" className="cm-x" onClick={closeEmailPopup} aria-label="Close">
                ×
              </button>
            </div>

            <div className="cm-modalBody">
              <div className="cm-field" style={{ marginTop: 12 }}>
                <label>To</label>
                <input className="cm-input" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} inputMode="email" />
              </div>

              <div className="cm-field" style={{ marginTop: 12 }}>
                <label>Subject</label>
                <input className="cm-input" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
              </div>

              <div className="cm-field" style={{ marginTop: 12 }}>
                <label>Message</label>
                <textarea className="cm-textarea" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
              </div>

              <div className="cm-modalActions">
                <button type="button" className="cm-secondaryBtn" onClick={closeEmailPopup}>
                  Cancel
                </button>

                <button
                  type="button"
                  className="cm-btn"
                  onClick={openGmailFromModal}
                  disabled={!emailTo || !isValidEmail(emailTo)}
                  title={!emailTo || !isValidEmail(emailTo) ? "Enter a valid email address" : "Open Gmail compose"}
                >
                  Open Gmail
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Modal */}
      {deleteOpen && deleteTarget ? (
        <div
          className="cm-modalOverlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDeletePopup();
          }}
        >
          <div className="cm-modal" role="dialog" aria-modal="true" aria-label="Confirm Delete">
            <div className="cm-sheetHandle">
              <span />
            </div>

            <div className="cm-modalHeader">
              <div className="cm-modalTitle">Confirm Delete</div>
              <button type="button" className="cm-x" onClick={closeDeletePopup} aria-label="Close">
                ×
              </button>
            </div>

            <div className="cm-modalBody">
              <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 16 }}>{deleteTarget.fullName}</div>
              <div className="cm-subtext" style={{ marginTop: 3 }}>
                {deleteTarget.counselorId}
              </div>

              <div className="cm-dangerText">This will permanently delete the counselor account.</div>

              <input
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                autoComplete="username"
                tabIndex={-1}
                aria-hidden="true"
              />
              <input
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                autoComplete="current-password"
                tabIndex={-1}
                aria-hidden="true"
              />

              <div className="cm-field" style={{ marginTop: 12 }}>
                <label>Admin Password</label>
                <input
                  ref={passRef}
                  className="cm-input"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setDeleteErr("");
                  }}
                  placeholder="Enter admin password"
                  autoComplete="new-password"
                  name={pwFieldName}
                  data-lpignore="true"
                  spellCheck={false}
                  readOnly={!pwReady}
                  onFocus={() => setPwReady(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmDelete();
                  }}
                />
                {deleteErr ? (
                  <div style={{ marginTop: 6, color: "#991b1b", fontWeight: 950, fontSize: 12 }}>{deleteErr}</div>
                ) : null}
              </div>

              <div className="cm-modalActions">
                <button type="button" className="cm-secondaryBtn" onClick={closeDeletePopup}>
                  Cancel
                </button>
                <button type="button" className="cm-linkBtn cm-danger" onClick={confirmDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
