"use client";

import { useEffect, useState, type RefObject } from "react";

// אירוע דיווח כפי שהוא נשלח לשרת (אחרי ניקוי של מה שהפעילות שלחה).
type Ev =
  | { t: "start" }
  | { t: "answer"; id?: string; q?: string; concept?: string; correct: boolean | null; response?: string; expected?: string }
  | { t: "progress"; percent: number }
  | { t: "finish"; score?: number | null; maxScore?: number | null; summary?: string };

export type TrackState = "idle" | "saved" | "offline";

// בלי פעולה במשך שתי דקות (בתוך הפעילות) הזמן מפסיק להיספר.
const IDLE_MS = 120_000;
const FLUSH_EVERY_MS = 15_000;
const BATCH = 30;

function text(v: unknown, max: number): string | undefined {
  let s = "";
  if (typeof v === "string") s = v;
  else if (typeof v === "number" || typeof v === "boolean") s = String(v);
  else if (v && typeof v === "object") {
    try {
      s = JSON.stringify(v);
    } catch {
      s = "";
    }
  }
  s = s.trim().slice(0, max);
  return s || undefined;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.min(n, 100000) : null;
}

// הקוד של הפעילות נכתב על ידי בינה ולא נבדק: כל שדה מומר לטיפוס הצפוי ונחתך לאורך סביר.
function normalize(type: unknown, d: Record<string, unknown>): Ev | null {
  if (type === "start") return { t: "start" };
  if (type === "progress") {
    const p = num(d.percent);
    return p == null ? null : { t: "progress", percent: Math.min(100, p) };
  }
  if (type === "finish") return { t: "finish", score: num(d.score), maxScore: num(d.maxScore), summary: text(d.summary, 1000) };
  if (type === "answer") {
    const open = d.type === "open" || d.kind === "open";
    const correct = open ? null : d.correct === true || d.correct === "true" ? true : d.correct === false || d.correct === "false" ? false : null;
    const ev: Ev = { t: "answer", id: text(d.id, 80), q: text(d.question ?? d.q, 500), concept: text(d.concept, 80), correct, response: text(d.response ?? d.answer, 2000), expected: text(d.expected, 500) };
    // תשובה בלי שום תוכן לא שווה שורה.
    return ev.q || ev.id || ev.response ? ev : null;
  }
  return null;
}

function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

// מודד זמן עבודה פעיל בפעילות HTML מוטמעת, אוסף את מה שהיא מדווחת (תשובות, התקדמות, סיום) ושולח לשרת.
// הפעילות עצמה רצה בארגז חול בלי הרשאות: היא רק שולחת הודעות לדף הזה, והדף הוא ששומר אותן בשם התלמיד.
export function useActivityTracker(frame: RefObject<HTMLIFrameElement | null>, lessonItemId: number, enabled: boolean): TrackState {
  const [state, setState] = useState<TrackState>("idle");

  useEffect(() => {
    if (!enabled) return;
    const clientKey = newKey();
    const queue: Ev[] = [];
    let activeMs = 0;
    let lastTick = Date.now();
    let lastAlive = Date.now();
    let sentSeconds = 0;
    let inflight = false;
    let soon: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const seconds = () => Math.round(activeMs / 1000);
    const worthSending = () => queue.length > 0 || (seconds() >= 5 && seconds() !== sentSeconds);

    async function flush() {
      if (inflight || !worthSending()) return;
      inflight = true;
      const batch = queue.splice(0, BATCH);
      const secs = seconds();
      try {
        const res = await fetch("/api/student/activity", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lessonItemId, clientKey, activeSeconds: secs, events: batch }),
          keepalive: true,
        });
        if (!res.ok) throw new Error(String(res.status));
        sentSeconds = secs;
        if (!closed) setState("saved");
      } catch {
        // נכשל (אין רשת, או השרת מתעדכן): האירועים חוזרים לתור ויישלחו בסבב הבא.
        queue.unshift(...batch);
        if (!closed) setState("offline");
      } finally {
        inflight = false;
      }
      if (queue.length && !closed) flushSoon();
    }

    function flushSoon() {
      if (soon) return;
      soon = setTimeout(() => {
        soon = null;
        flush();
      }, 1500);
    }

    // בסגירת הדף אין זמן לחכות לתשובה: שולחים את מה שנשאר כמשואה.
    function flushOnExit() {
      if (!worthSending()) return;
      const batch = queue.splice(0, BATCH);
      const body = JSON.stringify({ lessonItemId, clientKey, activeSeconds: seconds(), events: batch });
      sentSeconds = seconds();
      try {
        if (!navigator.sendBeacon("/api/student/activity", new Blob([body], { type: "application/json" }))) throw new Error();
      } catch {
        fetch("/api/student/activity", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    }

    function onMessage(e: MessageEvent) {
      // רק הודעות מהמסגרת של הפעילות הזו, ורק במבנה של שכבת הדיווח.
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const msg = e.data as { rezef?: unknown; type?: unknown; data?: unknown } | null;
      if (!msg || typeof msg !== "object" || msg.rezef !== 1) return;
      lastAlive = Date.now();
      if (msg.type === "alive") return;
      const ev = normalize(msg.type, msg.data && typeof msg.data === "object" ? (msg.data as Record<string, unknown>) : {});
      if (!ev || queue.length >= 500) return;
      queue.push(ev);
      flushSoon();
    }

    const tick = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible" && now - lastAlive < IDLE_MS) activeMs += Math.min(now - lastTick, 2000);
      lastTick = now;
    }, 1000);
    const periodic = setInterval(flush, FLUSH_EVERY_MS);
    const onHide = () => document.visibilityState === "hidden" && flushOnExit();

    window.addEventListener("message", onMessage);
    window.addEventListener("pagehide", flushOnExit);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      closed = true;
      clearInterval(tick);
      clearInterval(periodic);
      if (soon) clearTimeout(soon);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("pagehide", flushOnExit);
      document.removeEventListener("visibilitychange", onHide);
      // סגירת הפעילות: שליחה אחרונה של הזמן ושל מה שנשאר בתור.
      flushOnExit();
    };
  }, [frame, lessonItemId, enabled]);

  return state;
}
