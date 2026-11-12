"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, LifeBuoy, X } from "lucide-react";

type Row = {
  membershipId: number;
  nickname: string;
  submission: {
    id: number;
    answer: string;
    link: string | null;
    rating: number | null;
    needsHelp: boolean;
    feedback: string;
    updatedAt: string;
  } | null;
};

const RATING = ["", "היה קל", "היה בסדר", "היה קשה"];

function SubmissionCard({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const sub = row.submission;
  const [feedback, setFeedback] = useState(sub?.feedback ?? "");
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");

  async function save() {
    if (!sub || feedback === sub.feedback) return;
    setState("busy");
    try {
      const res = await fetch(`/api/submissions/${sub.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) throw new Error();
      setState("saved");
      onSaved();
    } catch {
      setState("error");
    }
  }

  return (
    <li className={`rounded-2xl border p-3 ${sub?.needsHelp ? "border-coral/50 bg-coral/5" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{row.nickname}</span>
        {sub ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-600/10 px-2.5 py-0.5 text-xs text-green-700">
            <Check size={12} strokeWidth={2} />
            {new Date(sub.updatedAt).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
          </span>
        ) : (
          <span className="rounded-full bg-page px-2.5 py-0.5 text-xs text-muted">עוד לא הגיש/ה</span>
        )}
        {sub?.rating ? <span className="rounded-full bg-page px-2.5 py-0.5 text-xs text-muted">{RATING[sub.rating]}</span> : null}
        {sub?.needsHelp && (
          <span className="inline-flex items-center gap-1 rounded-full bg-coral/10 px-2.5 py-0.5 text-xs font-medium text-coral">
            <LifeBuoy size={12} strokeWidth={2} /> ביקש/ה עזרה
          </span>
        )}
      </div>
      {sub && (
        <div className="mt-2 flex flex-col gap-2">
          {sub.answer && <p className="whitespace-pre-wrap rounded-xl bg-page px-3 py-2 text-sm">{sub.answer}</p>}
          {sub.link && (
            <a href={sub.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start text-sm text-blue-dark underline" dir="ltr">
              <ExternalLink size={14} strokeWidth={2} /> {sub.link.replace(/^https?:\/\//, "").slice(0, 60)}
            </a>
          )}
          {!sub.answer && !sub.link && <p className="text-sm text-muted">סומן כהוגש, בלי תשובה כתובה.</p>}
          <div className="flex items-start gap-2">
            <textarea
              className="block min-h-10 w-full resize-y rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-blue"
              placeholder="משוב קצר לתלמיד/ה"
              rows={1}
              maxLength={1000}
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value);
                setState("idle");
              }}
              onBlur={save}
              aria-label={`משוב ל${row.nickname}`}
            />
            <span className="w-14 shrink-0 pt-2 text-xs text-muted" role="status">
              {state === "busy" ? "שומרים…" : state === "saved" ? "נשמר" : state === "error" ? <span className="text-coral">נכשל</span> : ""}
            </span>
          </div>
        </div>
      )}
    </li>
  );
}

// ההגשות של כל תלמידי הקבוצה למטלה אחת, עם משוב קצר לכל הגשה.
export default function SubmissionsDialog({ lessonItemId, title, onClose }: { lessonItemId: number; title: string; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch(`/api/lesson-items/${lessonItemId}/submissions`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { rows: Row[] }) => setRows(d.rows))
      .catch(() => setError("לא הצלחנו לטעון את ההגשות"));
  }, [lessonItemId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitted = rows?.filter((r) => r.submission) ?? [];
  // קודם מי שביקש עזרה, אחר כך מי שהגיש, ובסוף מי שעוד לא.
  const ordered = rows ? [...rows].sort((a, b) => Number(Boolean(b.submission?.needsHelp)) - Number(Boolean(a.submission?.needsHelp)) || Number(Boolean(b.submission)) - Number(Boolean(a.submission))) : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-label="הגשות">
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold">{title}</h2>
            {rows && (
              <p className="text-sm text-muted tabular-nums">
                הגישו {submitted.length} מתוך {rows.length}
              </p>
            )}
          </div>
          <button type="button" className="btn-icon shrink-0" aria-label="סגירה" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
        {!rows && !error && <p className="text-sm text-muted">טוענים…</p>}
        {rows && rows.length === 0 && <p className="text-sm text-muted">עדיין אין תלמידים בקבוצה.</p>}
        <ul className="flex flex-col gap-2">
          {ordered.map((row) => (
            <SubmissionCard key={`${row.membershipId}-${row.submission?.id ?? 0}`} row={row} onSaved={load} />
          ))}
        </ul>
      </div>
    </div>
  );
}
