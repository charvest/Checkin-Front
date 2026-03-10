// src/pages/Services/SessionType/Request.js
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FloatingMessagesPill from "../../../components/Message/FloatingMessagesPill";
import MessagesDrawer from "../../../components/Message/MessagesDrawer";
import * as MessagesAPI from "../../../api/messages.api";
/* ===================== THEME ===================== */
const LOGIN_PRIMARY = "#B9FF66";
const TEXT_MAIN = "#141414";
const TEXT_MUTED = "rgba(20,20,20,0.82)";
const TEXT_SOFT = "rgba(20,20,20,0.66)";
const ERROR_TEXT = "#C62828";
const PH_TZ = "Asia/Manila";

/* ===================== DATA ===================== */
const REASONS = [
  "Academic stress",
  "Anxiety / Overthinking",
  "Depression / Low mood",
  "Family / Relationships",
  "Self-esteem",
  "Grief / Loss",
  "Other",
];

const COUNSELORS = [
  { id: "C-101", name: "Counselor A" },
  { id: "C-102", name: "Counselor B" },
  { id: "C-103", name: "Counselor C" },
  { id: "C-104", name: "Counselor D" },
];

const HOLIDAYS = [
  "2026-01-01",
  "2026-04-09",
  "2026-04-10",
  "2026-05-01",
  "2026-06-12",
  "2026-08-21",
  "2026-11-30",
  "2026-12-25",
  "2026-12-30",
];

/* ===================== SLOTS ===================== */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toMin(h, m) {
  return h * 60 + m;
}
function minToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}
function buildSlots(start = "08:00", end = "17:00", stepMin = 30) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = toMin(sh, sm);
  const e = toMin(eh, em);

  const out = [];
  for (let t = s; t <= e; t += stepMin) out.push(minToTime(t));
  return out;
}
const SCHOOL_SLOTS = buildSlots("08:00", "17:00", 30);

/* ===================== PH TIME HELPERS ===================== */
function getPHParts(date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;

  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hh: get("hour"),
    mm: get("minute"),
  };
}
function todayISO_PH() {
  const p = getPHParts();
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}
function nowHHMM_PH() {
  const p = getPHParts();
  return `${p.hh}:${p.mm}`;
}
function dayOfWeekFromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.getUTCDay();
}
function compareISO(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
function hhmmToMin(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return h * 60 + m;
}
function isWithinWorkHours(hhmm) {
  const t = hhmmToMin(hhmm);
  const start = hhmmToMin("08:00");
  const end = hhmmToMin("17:00");
  return t >= start && t <= end;
}
function isWeekend(iso) {
  if (!iso) return false;
  const day = dayOfWeekFromISO(iso);
  return day === 0 || day === 6;
}
function isHoliday(iso) {
  return !!iso && HOLIDAYS.includes(iso);
}
function getDayState(iso) {
  if (!iso) return { ok: false, label: "Select a date" };
  if (compareISO(iso, todayISO_PH()) < 0) return { ok: false, label: "Past date (not allowed)" };
  if (isHoliday(iso)) return { ok: false, label: "Holiday (No service)" };
  if (isWeekend(iso)) return { ok: false, label: "Weekend (No service)" };
  return { ok: true, label: "Available" };
}
function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}
function isoToNice(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function findNextWorkingDay(startISO) {
  let cur = startISO;
  for (let i = 0; i < 60; i++) {
    if (getDayState(cur).ok) return cur;
    cur = addDaysISO(cur, 1);
  }
  return startISO;
}
function getAskInfoPH() {
  const today = todayISO_PH();
  const ds = getDayState(today);
  const within = isWithinWorkHours(nowHHMM_PH());

  if (ds.ok && within) {
    return {
      ok: true,
      title: "Within 24 hours",
      desc: "Submitted during working hours, reviewed within 24 hours.",
      next: "Review is open now (until 5:00 PM).",
    };
  }

  const nextDay = ds.ok && !within ? findNextWorkingDay(addDaysISO(today, 1)) : findNextWorkingDay(today);
  const when = nextDay === addDaysISO(today, 1) ? "tomorrow" : `on ${isoToNice(nextDay)}`;

  return {
    ok: false,
    title: "Queued",
    desc: !ds.ok
      ? `Today is ${ds.label}. Your question will be queued.`
      : "Outside working hours (8:00 AM – 5:00 PM). Your question will be queued.",
    next: `Next review starts ${when} at 8:00 AM.`,
  };
}

/* ===================== AVAILABILITY (DEMO) ===================== */
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function getCounselorAvailability(counselorId, dateStr) {
  const ds = getDayState(dateStr);
  if (!ds.ok) return { onLeave: true, booked: new Set(SCHOOL_SLOTS) };

  const seed = hashStr(`${counselorId}|${dateStr}`);
  const rnd = mulberry32(seed);

  const onLeave = rnd() < 0.08;
  if (onLeave) return { onLeave: true, booked: new Set(SCHOOL_SLOTS) };

  const bookedRatio = 0.25 + rnd() * 0.4;
  const bookCount = Math.max(3, Math.floor(SCHOOL_SLOTS.length * bookedRatio));

  const booked = new Set();
  while (booked.size < bookCount) {
    const idx = Math.floor(rnd() * SCHOOL_SLOTS.length);
    booked.add(SCHOOL_SLOTS[idx]);
  }
  return { onLeave: false, booked };
}
function counselorStatus(onLeave, openCount) {
  if (onLeave) return "On Leave";
  if (openCount <= 0) return "Fully Booked";
  if (openCount <= 4) return "Limited";
  return "Available";
}

/* ===================== COMPONENT ===================== */
export default function Request({ onClose }) {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingThreads(true);
        const res = await MessagesAPI.listThreads();
        if (mounted) setThreads(res.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoadingThreads(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  const unreadTotal = useMemo(
    () => threads.reduce((sum, t) => sum + (t.unread || 0), 0),
    [threads]
  );

  const onSendMessage = async ({ threadId, text }) => {
    await MessagesAPI.sendMessage({ threadId, text });

    // refresh threads list (simple + reliable)
    const res = await MessagesAPI.listThreads();
    setThreads(res.items || []);
  };

  const [msgOpen, setMsgOpen] = useState(false);

  const [step, setStep] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const MAX_CHARS = 300;

  const [ask, setAsk] = useState({
    anonymous: true,
    topic: "",
    message: "",
    requestMeeting: false,
  });

  const [meet, setMeet] = useState({
    sessionType: "Online",
    reason: "",
    counselorId: "",
    date: "",
    time: "",
    notes: "",
  });

  const [askError, setAskError] = useState("");
  const [askSuccess, setAskSuccess] = useState("");
  const [meetError, setMeetError] = useState("");
  const [meetSuccess, setMeetSuccess] = useState("");

  const close = () => {
    if (typeof onClose === "function") return onClose();
    navigate(-1);
  };

  const panelStyle = useMemo(
    () => ({
      transform: `translate3d(-${step * 100}%, 0, 0)`,
      transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
      willChange: "transform",
    }),
    [step]
  );

  const askInfo = useMemo(() => getAskInfoPH(), []);
  const dayState = useMemo(() => getDayState(meet.date), [meet.date]);

  const counselorsComputed = useMemo(() => {
    return COUNSELORS.map((c) => {
      if (!meet.date) {
        return { ...c, _status: "Select date", _openCount: 0, _onLeave: false, _booked: new Set() };
      }
      const info = getCounselorAvailability(c.id, meet.date);
      const openCount = Math.max(0, SCHOOL_SLOTS.length - info.booked.size);
      return {
        ...c,
        _onLeave: info.onLeave,
        _booked: info.booked,
        _openCount: openCount,
        _status: counselorStatus(info.onLeave, openCount),
      };
    }).sort((a, b) => {
      const rank = { Available: 0, Limited: 1, "Fully Booked": 2, "On Leave": 3, "Select date": 4 };
      return (rank[a._status] ?? 9) - (rank[b._status] ?? 9);
    });
  }, [meet.date]);

  const slotAvailability = useMemo(() => {
    const out = {};
    if (!meet.date || !dayState.ok) {
      SCHOOL_SLOTS.forEach((t) => (out[t] = { enabled: false, reason: dayState.label }));
      return out;
    }

    if (meet.counselorId) {
      const info = getCounselorAvailability(meet.counselorId, meet.date);
      SCHOOL_SLOTS.forEach((t) => {
        const enabled = !info.onLeave && !info.booked.has(t);
        out[t] = { enabled, reason: enabled ? "" : info.onLeave ? "On leave" : "Booked" };
      });
      return out;
    }

    SCHOOL_SLOTS.forEach((t) => {
      let any = false;
      for (const c of COUNSELORS) {
        const info = getCounselorAvailability(c.id, meet.date);
        if (!info.onLeave && !info.booked.has(t)) {
          any = true;
          break;
        }
      }
      out[t] = { enabled: any, reason: any ? "" : "No counselors available" };
    });
    return out;
  }, [meet.date, meet.counselorId, dayState.ok, dayState.label]);

  const selectedCounselor = useMemo(
    () => COUNSELORS.find((c) => c.id === meet.counselorId) || null,
    [meet.counselorId]
  );

  const autoAssignCounselor = (dateStr, timeStr) => {
    for (const c of COUNSELORS) {
      const info = getCounselorAvailability(c.id, dateStr);
      if (!info.onLeave && !info.booked.has(timeStr)) return c;
    }
    return null;
  };

  const onDateChange = (val) => {
    setMeet((p) => ({ ...p, date: val, time: "" }));
    setMeetError("");
    setMeetSuccess("");
    if (!getDayState(val).ok) setMeet((p) => ({ ...p, date: val, time: "", counselorId: "" }));
  };

  /* ===================== GATE ACCESS (TERMS) ===================== */
  const openStepWithTerms = (nextStep) => {
    setAskError("");
    setAskSuccess("");
    setMeetError("");
    setMeetSuccess("");

    if (!termsAccepted) {
      setShowTerms(true);
      return;
    }
    setStep(nextStep);
  };

  /* ===================== ASK STATES ===================== */
  const askMessageEmpty = ask.message.trim().length === 0;
  const canSubmitAsk = termsAccepted && !!ask.topic && !askMessageEmpty;

  /* ===================== MEET STATES ===================== */
  const meetSummary = useMemo(() => {
    const parts = [];
    if (meet.sessionType) parts.push(meet.sessionType);
    if (meet.date) parts.push(isoToNice(meet.date));
    if (meet.time) parts.push(meet.time);
    return parts.length ? `You selected: ${parts.join(" • ")}` : "You selected: —";
  }, [meet.sessionType, meet.date, meet.time]);

  const meetRequiredDone = !!meet.sessionType && !!meet.reason && !!meet.date && !!meet.time;
  const canSubmitMeet = termsAccepted && meetRequiredDone && dayState.ok && !!slotAvailability[meet.time]?.enabled;

  /* ===================== SUBMIT ===================== */
  const submitAsk = () => {
    setAskError("");
    setAskSuccess("");

    if (!termsAccepted) return setShowTerms(true);
    if (!ask.topic) return setAskError("Select a topic.");
    if (askMessageEmpty) return setAskError("Message is required.");

    setAskSuccess("Submitted. You’ll receive a confirmation once approved.");

    if (ask.requestMeeting) {
      setMeet((p) => ({ ...p, reason: ask.topic }));
      setStep(2);
    }
  };

  const submitMeet = () => {
    setMeetError("");
    setMeetSuccess("");

    if (!termsAccepted) return setShowTerms(true);
    if (!meet.reason) return setMeetError("Select a reason.");
    if (!meet.date) return setMeetError("Select a date.");
    if (!dayState.ok) return setMeetError(dayState.label);
    if (!meet.time) return setMeetError("Select a time.");

    const slot = slotAvailability[meet.time];
    if (!slot || !slot.enabled) return setMeetError(`Time not available${slot?.reason ? ` (${slot.reason})` : ""}.`);

    const assigned = meet.counselorId ? selectedCounselor : autoAssignCounselor(meet.date, meet.time);
    if (!assigned) return setMeetError("No counselor available for that slot.");

    setMeetSuccess("Request sent. You’ll receive a confirmation once approved.");
  };

  return (
    
    <div className="w-full min-h-screen flex items-start justify-center px-4 pt-6 pb-6">

    <FloatingMessagesPill onClick={() => setMsgOpen(true)} unread={unreadTotal} />

    <MessagesDrawer
      open={msgOpen}
      onClose={() => setMsgOpen(false)}
      threads={threads}
      onSendMessage={onSendMessage}
    />



      <div className="w-full max-w-4xl">
        <div className="relative overflow-hidden rounded-[22px] bg-transparent">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-2 top-2 z-20 h-10 w-10 rounded-full bg-white/80 hover:bg-white transition flex items-center justify-center"
          >
            <span className="text-2xl leading-none" style={{ color: TEXT_MAIN }}>
              ×
            </span>
          </button>

          {/* ===================== TERMS MODAL ===================== */}
          {showTerms ? (
            <TermsModal
              accent={LOGIN_PRIMARY}
              onAccept={() => {
                setTermsAccepted(true);
                setShowTerms(false);
              }}
              onClose={() => setShowTerms(false)}
            />
          ) : null}

          <div className="relative flex w-full" style={panelStyle}>
            {/* ===================== PANEL 1 ===================== */}
            <section className="w-full flex-none px-2 py-6 md:px-6 md:py-10">
              <div className="text-center">
                <h2 className="font-[Nunito] text-[30px] md:text-[38px] font-extrabold" style={{ color: TEXT_MAIN }}>
                  How would you like to be heard?
                </h2>
                <p className="mt-2 font-[Lora] text-[15.5px] md:text-[16.5px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                  Choose what feels comfortable. Your request stays confidential.
                </p>
              </div>

              {/* Info (NO SAVE DRAFT) */}
              <div className="mt-6 rounded-2xl bg-white/85 px-5 py-4">
                <div className="font-[Nunito] font-extrabold text-[16.5px]" style={{ color: TEXT_MAIN }}>
                  Review (PH time)
                </div>
                <div className="mt-1 font-[Lora] text-[15px]" style={{ color: TEXT_MUTED }}>
                  {askInfo.ok ? "Reviewed within 24 hours (working hours)." : "Queued when review is closed."}
                </div>
                <div className="mt-2 font-[Lora] text-[14.5px]" style={{ color: TEXT_SOFT }}>
                  {askInfo.next}
                </div>

                <div className="mt-3 grid gap-1 text-[14px] font-[Lora]" style={{ color: TEXT_SOFT }}>
                  <div>• No service on holidays</div>
                  <div>• No service on weekends</div>
                  <div>• Outside 8:00 AM – 5:00 PM: queued</div>
                </div>
              </div>

              {/* Choices */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <ChoiceRow
                  accent={LOGIN_PRIMARY}
                  title="Ask a Question"
                  subtitle="Anonymous message + counselor reply"
                  disabled={!termsAccepted}
                  onClick={() => openStepWithTerms(1)}
                  icon={<QuestionIcon accent={LOGIN_PRIMARY} />}
                />
                <ChoiceRow
                  accent={LOGIN_PRIMARY}
                  title="Meet a Counselor"
                  subtitle="Pick date + available slot"
                  disabled={!termsAccepted}
                  onClick={() => openStepWithTerms(2)}
                  icon={<ChatIcon accent={LOGIN_PRIMARY} />}
                />
              </div>

              {/* Terms row */}
              <div className="mt-6 rounded-2xl bg-white/85 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-[Nunito] font-extrabold text-[16.5px]" style={{ color: TEXT_MAIN }}>
                      Terms
                    </div>
                    <div className="mt-1 font-[Lora] text-[15px]" style={{ color: TEXT_MUTED }}>
                      Required before continuing.
                    </div>
                  </div>

                  <button type="button" onClick={() => setShowTerms(true)} className={miniBtn}>
                    View
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <OutlinedToggle accent={LOGIN_PRIMARY} checked={termsAccepted} onChange={(v) => setTermsAccepted(v)} />
                  <div className="text-[15.5px] font-[Nunito] font-extrabold" style={{ color: TEXT_MAIN }}>
                    I accept the Terms
                  </div>
                </div>

                {!termsAccepted ? (
                  <div className="mt-2 text-[13.5px] font-[Lora]" style={{ color: TEXT_SOFT }}>
                    Turn this on to open Ask / Meet.
                  </div>
                ) : null}
              </div>
            </section>

            {/* ===================== PANEL 2 (ASK) ===================== */}
            <section className="w-full flex-none px-2 py-6 md:px-6 md:py-10">
              <PanelHeader title="Ask a Question" subtitle="Write your concern. For emergencies, use the hotline." />

              <div className="mt-5 rounded-2xl bg-white/85 px-5 py-4">
                <div className="font-[Nunito] font-extrabold text-[16.5px]" style={{ color: TEXT_MAIN }}>
                  {askInfo.ok ? "Review is open" : "Review is closed"}
                </div>
                <div className="mt-1 font-[Lora] text-[15px]" style={{ color: TEXT_MUTED }}>
                  {askInfo.desc}
                </div>
                <div className="mt-2 font-[Lora] text-[14.5px]" style={{ color: TEXT_SOFT }}>
                  {askInfo.next}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Field label="Topic">
                  <select
                    className={inputClass}
                    value={ask.topic}
                    onChange={(e) => {
                      setAskError("");
                      setAskSuccess("");
                      setAsk((p) => ({ ...p, topic: e.target.value }));
                    }}
                  >
                    <option value="">Select</option>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* ✅ Respond timeframe dropdown removed */}
                <div className="lg:col-span-1">
                  <ToggleRow
                    accent={LOGIN_PRIMARY}
                    label="Anonymous"
                    desc="Your name will not be shown."
                    checked={ask.anonymous}
                    onChange={(v) => {
                      setAskError("");
                      setAskSuccess("");
                      setAsk((p) => ({ ...p, anonymous: v }));
                    }}
                  />
                </div>

                <Field label="Message" className="lg:col-span-2">
                  <textarea
                    rows={7}
                    className={textareaClass}
                    value={ask.message}
                    maxLength={MAX_CHARS}
                    onChange={(e) => {
                      setAskError("");
                      setAskSuccess("");
                      setAsk((p) => ({ ...p, message: e.target.value.slice(0, MAX_CHARS) }));
                    }}
                    placeholder="Write here…"
                  />

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-[13.5px] font-[Lora]" style={{ color: ask.message.trim() ? TEXT_SOFT : ERROR_TEXT }}>
                      {ask.message.trim() ? " " : "Message is required."}
                    </div>
                    <div className="text-[13.5px] font-[Nunito] font-extrabold" style={{ color: TEXT_SOFT }}>
                      {ask.message.length} / {MAX_CHARS}
                    </div>
                  </div>
                </Field>

                <div className="lg:col-span-2">
                  <ToggleRow
                    accent={LOGIN_PRIMARY}
                    label="Request meeting"
                    desc="Continue to scheduling after submitting."
                    checked={ask.requestMeeting}
                    onChange={(v) => {
                      setAskError("");
                      setAskSuccess("");
                      setAsk((p) => ({ ...p, requestMeeting: v }));
                    }}
                  />
                </div>

                <div className="lg:col-span-2">
                  {askError ? (
                    <div className="rounded-2xl bg-white/85 px-4 py-3 text-[14.5px] font-[Lora]" style={{ color: ERROR_TEXT }}>
                      {askError}
                    </div>
                  ) : null}
                  {askSuccess ? (
                    <div className="mt-2 rounded-2xl bg-white/85 px-4 py-3 text-[14.5px] font-[Lora]" style={{ color: TEXT_MAIN }}>
                      {askSuccess}
                    </div>
                  ) : null}
                </div>

                {/* ✅ BACK ALIGNMENT FIX: same row, same height, centered */}
                <div className="lg:col-span-2 flex items-center justify-between gap-3 pt-2">
                  <button type="button" onClick={() => setStep(0)} className={ghostBtn}>
                    ← Back
                  </button>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={submitAsk}
                      className={[primaryBtn, !canSubmitAsk ? "opacity-60 cursor-not-allowed" : ""].join(" ")}
                      style={{ backgroundColor: LOGIN_PRIMARY }}
                      disabled={!canSubmitAsk}
                    >
                      Submit
                    </button>

                    <div className="text-[12.5px] font-[Lora] text-right" style={{ color: TEXT_SOFT }}>
                      For emergencies, use the hotline.
                    </div>
                    <div className="text-[12.5px] font-[Lora] text-right" style={{ color: TEXT_SOFT }}>
                      You’ll receive a confirmation once approved.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ===================== PANEL 3 (MEET) ===================== */}
            <section className="w-full flex-none px-2 py-6 md:px-6 md:py-10">
              <PanelHeader title="Meet a Counselor" subtitle="Pick a valid date and an available slot." />

              <div className="mt-6 rounded-2xl bg-white/85 px-5 py-4">
                <div className="font-[Nunito] font-extrabold text-[16.5px]" style={{ color: TEXT_MAIN }}>
                  Selected
                </div>
                <div className="mt-1 font-[Lora] text-[15px]" style={{ color: TEXT_MUTED }}>
                  {meetSummary}
                </div>
                <div className="mt-2 text-[12.5px] font-[Lora]" style={{ color: TEXT_SOFT }}>
                  For urgent concerns, use the hotline.
                </div>
              </div>

              <div className="mt-7 grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Field label="Session type">
                  <div className="grid grid-cols-2 gap-3">
                    <RadioCard
                      active={meet.sessionType === "Online"}
                      title="Online"
                      subtitle="Link via email"
                      onClick={() => {
                        setMeetError("");
                        setMeetSuccess("");
                        setMeet((p) => ({ ...p, sessionType: "Online" }));
                      }}
                    />
                    <RadioCard
                      active={meet.sessionType === "In-person"}
                      title="In-person"
                      subtitle="On campus"
                      onClick={() => {
                        setMeetError("");
                        setMeetSuccess("");
                        setMeet((p) => ({ ...p, sessionType: "In-person" }));
                      }}
                    />
                  </div>
                </Field>

                <Field label="Reason">
                  <select
                    className={inputClass}
                    value={meet.reason}
                    onChange={(e) => {
                      setMeetError("");
                      setMeetSuccess("");
                      setMeet((p) => ({ ...p, reason: e.target.value }));
                    }}
                  >
                    <option value="">Select</option>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-[Nunito] font-extrabold text-[16px]" style={{ color: TEXT_MAIN }}>
                      Date
                    </div>
                    <DayChip ok={dayState.ok} label={dayState.label} accent={LOGIN_PRIMARY} />
                  </div>

                  <div className="mt-2 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-start">
                    <input
                      type="date"
                      className={inputClass}
                      min={todayISO_PH()}
                      value={meet.date}
                      onChange={(e) => onDateChange(e.target.value)}
                    />

                    <div className="text-[14.5px] font-[Lora] leading-relaxed" style={{ color: TEXT_MUTED }}>
                      <div>• No weekends</div>
                      <div>• No holidays</div>
                      <div>• 8:00 AM – 5:00 PM</div>
                      <div>• 30-minute slots</div>
                    </div>
                  </div>

                  {!dayState.ok && meet.date ? (
                    <div className="mt-2 text-[14px] font-[Lora]" style={{ color: ERROR_TEXT }}>
                      {dayState.label}
                    </div>
                  ) : null}
                </div>

                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-[Nunito] font-extrabold text-[16px]" style={{ color: TEXT_MAIN }}>
                      Counselors
                    </div>
                    <div className="text-[14px] font-[Lora]" style={{ color: TEXT_SOFT }}>
                      {meet.date && dayState.ok ? "Based on date" : "Select a date"}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {counselorsComputed.map((c) => {
                      const disabled =
                        !meet.date || !dayState.ok || c._status === "On Leave" || c._status === "Fully Booked";
                      const active = meet.counselorId === c.id;

                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setMeetError("");
                            setMeetSuccess("");
                            setMeet((p) => ({ ...p, counselorId: active ? "" : c.id, time: "" }));
                          }}
                          className={[
                            "w-full text-left rounded-2xl px-4 py-3 transition",
                            "bg-white/85 hover:bg-white",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            active ? "ring-2 ring-black/10" : "",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-[Nunito] font-extrabold text-[15.5px]" style={{ color: TEXT_MAIN }}>
                                {c.name}
                              </div>
                              <div className="text-[14.5px] font-[Lora]" style={{ color: TEXT_MUTED }}>
                                ID: {c.id}
                              </div>
                              {meet.date && dayState.ok ? (
                                <div className="text-[13.5px] font-[Lora] mt-1" style={{ color: TEXT_SOFT }}>
                                  Open: {Math.max(0, c._openCount)}
                                </div>
                              ) : null}
                            </div>
                            <StatusPill status={c._status} accent={LOGIN_PRIMARY} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-[Nunito] font-extrabold text-[16px]" style={{ color: TEXT_MAIN }}>
                        Time
                      </div>
                      <div className="text-[14.5px] font-[Lora] mt-1" style={{ color: TEXT_MUTED }}>
                        30-minute slots
                      </div>
                    </div>
                    <div className="text-[14px] font-[Lora]" style={{ color: TEXT_SOFT }}>
                      {meet.counselorId ? "Selected counselor" : "Any counselor"}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {SCHOOL_SLOTS.map((t) => {
                      const slot = slotAvailability[t];
                      const enabled = !!slot?.enabled;
                      const active = meet.time === t;

                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={!enabled}
                          onClick={() => {
                            setMeetError("");
                            setMeetSuccess("");
                            setMeet((p) => ({ ...p, time: t }));
                          }}
                          title={!enabled ? slot?.reason || "Not available" : "Available"}
                          className={[
                            "h-10 rounded-xl text-[14px] font-[Nunito] font-extrabold transition",
                            enabled ? "bg-white/90 hover:bg-white" : "bg-white/70 opacity-40 cursor-not-allowed",
                          ].join(" ")}
                          style={active ? { backgroundColor: LOGIN_PRIMARY, color: TEXT_MAIN } : { color: TEXT_MAIN }}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field label="Notes (optional)" className="lg:col-span-2">
                  <textarea
                    rows={5}
                    className={textareaClass}
                    value={meet.notes}
                    onChange={(e) => {
                      setMeetError("");
                      setMeetSuccess("");
                      setMeet((p) => ({ ...p, notes: e.target.value }));
                    }}
                    placeholder="Add details…"
                  />
                </Field>

                {/* ✅ Removed: reminders toggle (approval updates) */}

                <div className="lg:col-span-2">
                  {meetError ? (
                    <div className="rounded-2xl bg-white/85 px-4 py-3 text-[14.5px] font-[Lora]" style={{ color: ERROR_TEXT }}>
                      {meetError}
                    </div>
                  ) : null}
                  {meetSuccess ? (
                    <div className="mt-2 rounded-2xl bg-white/85 px-4 py-3 text-[14.5px] font-[Lora]" style={{ color: TEXT_MAIN }}>
                      {meetSuccess}
                    </div>
                  ) : null}
                </div>

                {/* ✅ BACK ALIGNMENT FIX: same row, same height, centered */}
                <div className="lg:col-span-2 flex items-center justify-between gap-3 pt-2">
                  <button type="button" onClick={() => setStep(0)} className={ghostBtn}>
                    ← Back
                  </button>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={submitMeet}
                      className={[primaryBtn, !canSubmitMeet ? "opacity-60 cursor-not-allowed" : ""].join(" ")}
                      style={{ backgroundColor: LOGIN_PRIMARY }}
                      disabled={!canSubmitMeet}
                    >
                      Request
                    </button>

                    <div className="text-[12.5px] font-[Lora] text-right" style={{ color: TEXT_SOFT }}>
                      For emergencies, use the hotline.
                    </div>
                    <div className="text-[12.5px] font-[Lora] text-right" style={{ color: TEXT_SOFT }}>
                      You’ll receive a confirmation once approved.
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== CLASSES ===================== */
const inputClass =
  "w-full h-12 px-4 rounded-xl bg-white/90 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-black/10 font-[Nunito] text-[15.5px] text-[#141414]";

const textareaClass =
  "w-full px-4 py-3 rounded-xl bg-white/90 hover:bg-white focus:bg-white outline-none focus:ring-2 focus:ring-black/10 font-[Nunito] text-[15.5px] text-[#141414] resize-none";

const primaryBtn =
  "h-12 px-7 rounded-xl hover:brightness-95 transition font-[Nunito] text-[15.5px] font-extrabold text-[#141414]";

const ghostBtn =
  "h-12 px-6 rounded-xl bg-white/90 hover:bg-white transition font-[Nunito] text-[15.5px] font-bold text-[#141414]";

const miniBtn =
  "h-9 px-4 rounded-xl bg-white/90 hover:bg-white transition font-[Nunito] text-[14px] font-extrabold text-[#141414]";

/* ===================== UI ===================== */
function PanelHeader({ title, subtitle }) {
  return (
    <div className="text-center">
      <h2 className="font-[Nunito] text-[30px] md:text-[38px] font-extrabold" style={{ color: TEXT_MAIN }}>
        {title}
      </h2>
      <p className="mt-2 font-[Lora] text-[15.5px] md:text-[16.5px] leading-relaxed" style={{ color: TEXT_MUTED }}>
        {subtitle}
      </p>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block mb-2 font-[Nunito] font-extrabold text-[16px]" style={{ color: TEXT_MAIN }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ChoiceRow({ title, subtitle, onClick, icon, accent, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full rounded-2xl px-5 py-5 transition text-left",
        disabled ? "bg-white/70 opacity-60 cursor-not-allowed" : "bg-white/90 hover:bg-white",
      ].join(" ")}
      title={disabled ? "Accept Terms to continue" : ""}
    >
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${accent}33` }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-[Nunito] text-[18px] font-extrabold" style={{ color: TEXT_MAIN }}>
            {title}
          </div>
          <div className="mt-1 font-[Lora] text-[15px] leading-relaxed" style={{ color: TEXT_MUTED }}>
            {subtitle}
          </div>
        </div>
        <div className="ml-auto" style={{ color: TEXT_SOFT }}>
          <ArrowRightIcon />
        </div>
      </div>
    </button>
  );
}

/* ✅ OUTLINED TOGGLE */
function OutlinedToggle({ checked, onChange, accent }) {
  const offBg = "rgba(255,255,255,0.95)";
  const offBorder = "rgba(20,20,20,0.28)";

  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-12 h-7 rounded-full transition flex items-center"
      style={{
        backgroundColor: checked ? accent : offBg,
        border: `1.5px solid ${checked ? "rgba(0,0,0,0.10)" : offBorder}`,
      }}
      aria-pressed={checked}
    >
      <span
        className="h-5 w-5 rounded-full shadow-sm transition"
        style={{
          backgroundColor: "#000",
          transform: checked ? "translateX(22px)" : "translateX(2px)",
        }}
      />
    </button>
  );
}

function ToggleRow({ label, desc, checked, onChange, accent }) {
  return (
    <div className="rounded-2xl px-4 py-4 bg-white/90">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-[Nunito] font-extrabold text-[16px]" style={{ color: TEXT_MAIN }}>
            {label}
          </div>
          <div className="mt-1 font-[Lora] text-[15px] leading-relaxed" style={{ color: TEXT_MUTED }}>
            {desc}
          </div>
        </div>
        <OutlinedToggle checked={checked} onChange={onChange} accent={accent} />
      </div>
    </div>
  );
}

function RadioCard({ active, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-12 rounded-2xl px-4 flex items-center justify-between transition bg-white/90 hover:bg-white",
        active ? "ring-2 ring-black/10" : "",
      ].join(" ")}
    >
      <div className="text-left">
        <div className="font-[Nunito] font-extrabold text-[15.5px]" style={{ color: TEXT_MAIN }}>
          {title}
        </div>
        <div className="font-[Lora] text-[13.5px]" style={{ color: TEXT_MUTED }}>
          {subtitle}
        </div>
      </div>
      <span className="h-4 w-4 rounded-full border border-black/20 flex items-center justify-center">
        {active ? <span className="h-2 w-2 rounded-full bg-[#141414]" /> : null}
      </span>
    </button>
  );
}

function DayChip({ ok, label, accent }) {
  const bg = ok ? `${accent}55` : "rgba(255,255,255,0.92)";
  const color = ok ? TEXT_MAIN : "rgba(20,20,20,0.78)";
  return (
    <span className="px-3 py-1 rounded-full text-[13.5px] font-[Nunito] font-extrabold" style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  );
}

function StatusPill({ status, accent }) {
  const bg = status === "Available" ? `${accent}55` : "rgba(255,255,255,0.95)";
  const color = status === "Available" ? TEXT_MAIN : "rgba(20,20,20,0.75)";
  return (
    <span className="px-3 py-1 rounded-full text-[13px] font-[Nunito] font-extrabold" style={{ backgroundColor: bg, color }}>
      {status}
    </span>
  );
}

/* ===================== MODAL UI + DATA COLLECTION TERMS ===================== */
function TermsModal({ accent, onAccept, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl rounded-[22px] bg-white shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Terms and Conditions"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-black/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-[Nunito] text-[22px] md:text-[24px] font-extrabold" style={{ color: TEXT_MAIN }}>
                Terms & Data Collection
              </div>
              <div className="mt-1 font-[Lora] text-[14.5px] md:text-[15px]" style={{ color: TEXT_MUTED }}>
                Please read before continuing.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-full bg-black/5 hover:bg-black/10 transition flex items-center justify-center"
              aria-label="Close"
            >
              <span className="text-2xl leading-none" style={{ color: TEXT_MAIN }}>
                ×
              </span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[65vh] overflow-auto">
          <div className="rounded-2xl p-4" style={{ backgroundColor: `${accent}22` }}>
            <div className="font-[Nunito] font-extrabold text-[16px]" style={{ color: TEXT_MAIN }}>
              What we collect
            </div>
            <div className="mt-2 grid gap-2 text-[15px] font-[Lora]" style={{ color: TEXT_MUTED }}>
              <div>• Message content you submit (question, topic, notes)</div>
              <div>• Scheduling details (date, time, session type, selected counselor)</div>
              <div>• Account identifiers (if not anonymous): name, email, student number</div>
              <div>• Basic technical logs for security (e.g., timestamps)</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl p-4 border border-black/10">
            <div className="font-[Nunito] font-extrabold text-[16px]" style={{ color: TEXT_MAIN }}>
              Why we collect it
            </div>
            <div className="mt-2 grid gap-2 text-[15px] font-[Lora]" style={{ color: TEXT_MUTED }}>
              <div>• To route your concern to authorized counselors</div>
              <div>• To schedule and manage appointments</div>
              <div>• To maintain safety, prevent misuse, and audit access</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl p-4 border border-black/10">
            <div className="font-[Nunito] font-extrabold text-[16px]" style={{ color: TEXT_MAIN }}>
              Who can access it
            </div>
            <div className="mt-2 grid gap-2 text-[15px] font-[Lora]" style={{ color: TEXT_MUTED }}>
              <div>• Authorized guidance counselors and system admins</div>
              <div>• Access is limited to student-support purposes only</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl p-4 border border-black/10">
            <div className="font-[Nunito] font-extrabold text-[16px]" style={{ color: TEXT_MAIN }}>
              Important notes
            </div>
            <div className="mt-2 grid gap-2 text-[15px] font-[Lora]" style={{ color: TEXT_MUTED }}>
              <div>• Not an emergency service</div>
              <div>• For emergencies, use the hotline or local emergency services</div>
              <div>• Reviewed only on working days, 8:00 AM – 5:00 PM (PH time)</div>
            </div>
          </div>

          <div className="mt-4 text-[13.5px] font-[Lora]" style={{ color: TEXT_SOFT }}>
            By tapping “Accept”, you agree to these terms and allow processing of your submitted information for counseling support.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/10 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-6 rounded-xl bg-black/5 hover:bg-black/10 transition font-[Nunito] font-extrabold text-[#141414]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onAccept}
            className="h-11 px-7 rounded-xl hover:brightness-95 transition font-[Nunito] text-[15.5px] font-extrabold text-[#141414]"
            style={{ backgroundColor: accent }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== ICONS ===================== */
function QuestionIcon({ accent }) {
  return (
    <svg width="34" height="34" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill={accent} opacity="0.9" />
      <path
        d="M20.5 19.2c.4-2.3 2.2-3.9 4.9-3.9 2.8 0 5 1.7 5 4.4 0 2.4-1.5 3.6-3.3 4.6-1.4.8-1.8 1.3-1.8 2.7v.6"
        stroke={TEXT_MAIN}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="23.9" cy="34.2" r="1.6" fill={TEXT_MAIN} />
    </svg>
  );
}

function ChatIcon({ accent }) {
  return (
    <svg width="34" height="34" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M12 22c0-5 4.9-9 11-9h2c6.1 0 11 4 11 9s-4.9 9-11 9h-4l-6 4v-6.4C13.1 27 12 24.7 12 22Z"
        fill="#FFFFFF"
        opacity="0.95"
        stroke={TEXT_MAIN}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M16 21.8h.01M24 21.8h.01M32 21.8h.01" stroke={accent} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 7l5 5-5 5"
        stroke={TEXT_MAIN}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}
