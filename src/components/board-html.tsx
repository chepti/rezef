"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChartColumn, Check, CircleCheck, CircleX, ClipboardCopy, CodeXml, ExternalLink, Lightbulb, MessageSquareText, RefreshCw, Timer, Users, X } from "lucide-react";
import { REPORT_SKILL, hasReporting } from "@/lib/report-skill";

// טקסט שהודבק נראה כמו דף HTML שלם (ולא קישור או משפט שיש בו תגית).
export function looksLikeHtml(text: string): boolean {
  const t = text.trim();
  return t.length > 150 && /<(!doctype|html|head|body|script|style|div|canvas|svg)[\s>]/i.test(t) && /<\/[a-z]+>/i.test(t);
}

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? (res.status === 413 ? "הקוד ארוך מדי" : "השרת לא ענה כרגע. נסו שוב בעוד רגע"));
  return data;
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function CopySkillButton({ className = "btn btn-ghost" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      data-tip="מדביקים את ההנחיה בשיחה עם הבינה שיצרה את הפעילות, ומחליפים כאן את הקוד בגרסה שהיא מחזירה"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(REPORT_SKILL);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          window.open("/skill", "_blank", "noopener");
        }
      }}
    >
      {copied ? <Check size={16} strokeWidth={2} /> : <ClipboardCopy size={16} strokeWidth={2} />}
      {copied ? "ההנחיה הועתקה" : "העתקת ההנחיה לבינה"}
    </button>
  );
}

/* ---------- הדבקה ועדכון של קוד ---------- */

export type HtmlTarget = { lessonId: number; html?: string } | { itemId: number };

// הדבקת קוד HTML מקנבס של בינה כפריט חי בשיעור, או עדכון הקוד של פריט קיים.
export function HtmlDialog({ target, onClose, onSaved }: { target: HtmlTarget; onClose: () => void; onSaved: () => void }) {
  const editing = "itemId" in target;
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("lessonId" in target ? (target.html ?? "") : "");
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(onClose);

  const itemId = editing ? target.itemId : null;
  useEffect(() => {
    if (itemId == null) return;
    let stale = false;
    call(`/api/items/${itemId}/html`, "GET")
      .then((d: { title: string; html: string }) => {
        if (stale) return;
        setTitle(d.title);
        setHtml(d.html);
        setLoading(false);
      })
      .catch((e) => !stale && (setError(e instanceof Error ? e.message : "שגיאה"), setLoading(false)));
    return () => {
      stale = true;
    };
  }, [itemId]);

  const filled = html.trim().length >= 20;
  const reporting = useMemo(() => hasReporting(html), [html]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      if ("itemId" in target) await call(`/api/items/${target.itemId}/html`, "PATCH", { html, title: title.trim() || undefined });
      else await call(`/api/lessons/${target.lessonId}/html`, "POST", { html, title: title.trim() || undefined });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex w-full max-w-2xl flex-col gap-3 rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-label="פעילות HTML חיה">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange/10 text-orange">
            <CodeXml size={20} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">{editing ? "עדכון קוד הפעילות" : "פעילות HTML חיה"}</h2>
            <p className="text-sm text-muted">משחק, לומדה או סימולציה מקנבס של Gemini, Claude או ChatGPT. הפעילות רצה בתוך השיעור, אצלך ואצל התלמידים.</p>
          </div>
          <button type="button" className="btn-icon shrink-0" aria-label="סגירה" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="שם הפעילות (אם ריק, נלקח מכותרת הקוד)" aria-label="שם הפעילות" disabled={loading} />
        <textarea
          className="block h-56 w-full resize-y rounded-2xl border border-line bg-page/60 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-blue"
          dir="ltr"
          spellCheck={false}
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder={loading ? "טוענים…" : "<!DOCTYPE html> …  מדביקים כאן את כל הקוד"}
          aria-label="קוד HTML"
          disabled={loading}
          autoFocus={!editing}
        />

        {filled && (
          <div className={`flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2.5 text-sm ${reporting ? "bg-green-600/10 text-green-800" : "bg-orange/10 text-ink"}`} role="status">
            {reporting ? <CircleCheck size={18} strokeWidth={2} className="shrink-0 text-green-700" /> : <Lightbulb size={18} strokeWidth={2} className="shrink-0 text-orange" />}
            <span className="min-w-0 flex-1" data-tip={reporting ? "זמן עבודה, אחוז הצלחה, שליטה במושגים ותשובות פתוחות" : "בלי שכבת דיווח הרצף לא יודע מה קרה בתוך הפעילות"}>
              {reporting ? "בקוד יש שכבת דיווח: יתקבלו תשובות, מושגים וציון לכל תלמיד." : "בקוד אין שכבת דיווח: יימדד רק זמן עבודה."}
            </span>
            {!reporting && <CopySkillButton className="btn btn-ghost !bg-white" />}
          </div>
        )}

        {error && (
          <p className="text-sm text-coral" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" disabled={busy || loading || !filled} onClick={save}>
            <Check size={16} strokeWidth={2} />
            {busy ? "שומרים…" : editing ? "עדכון הקוד" : "הוספה לשיעור"}
          </button>
          {(reporting || !filled) && <CopySkillButton />}
          <a className="ms-auto text-xs text-muted underline" href="/skill" target="_blank" rel="noopener" data-tip="הטקסט המלא של ההנחיה, לקריאה או לשיתוף">
            מה כתוב בהנחיה
          </a>
        </div>
      </div>
    </div>
  );
}

/* ---------- נתוני השימוש ---------- */

type Answer = { id?: string; q?: string; concept?: string; correct: boolean | null; response?: string; expected?: string; at: number };
type Attempt = { id: number; seconds: number; answers: Answer[]; progress: number | null; finished: boolean; score: number | null; maxScore: number | null; summary: string; startedAt: string; updatedAt: string };
type Row = { membershipId: number; nickname: string; attempts: Attempt[] };
type Report = { reporting: boolean; rows: Row[] };

const pct = (correct: number, total: number) => (total ? Math.round((correct / total) * 100) : null);

function clock(seconds: number): string {
  if (seconds < 60) return `${seconds} שנ׳`;
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")} דק׳`;
}

// ירוק מ-80, כתום מ-50, אדום מתחת.
const tone = (p: number) => (p >= 80 ? "#15803d" : p >= 50 ? "var(--orange)" : "var(--coral)");

function Bar({ value, label }: { value: number; label?: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2" role="img" aria-label={label ?? `${value}%`}>
      <span className="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-page">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(3, value)}%`, background: tone(value) }} />
      </span>
      <span className="w-10 shrink-0 text-end text-sm font-bold tabular-nums" style={{ color: tone(value) }}>
        {value}%
      </span>
    </span>
  );
}

type StudentStat = {
  row: Row;
  seconds: number;
  // הניסיון שלפיו מחושבת ההצלחה: האחרון שיש בו תשובות.
  main: Attempt | null;
  graded: Answer[];
  correct: number;
  percent: number | null;
  finished: boolean;
  open: Answer[];
};

function statOf(row: Row): StudentStat {
  const withAnswers = row.attempts.filter((a) => a.answers.length > 0);
  const main = withAnswers[withAnswers.length - 1] ?? row.attempts[row.attempts.length - 1] ?? null;
  const graded = (main?.answers ?? []).filter((a) => a.correct !== null);
  const correct = graded.filter((a) => a.correct).length;
  const seen = new Set<string>();
  const open = row.attempts
    .flatMap((a) => a.answers)
    .filter((a) => a.correct === null && a.response)
    .filter((a) => {
      const key = `${a.id ?? a.q ?? ""}|${a.response}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return {
    row,
    seconds: row.attempts.reduce((sum, a) => sum + a.seconds, 0),
    main,
    graded,
    correct,
    percent: pct(correct, graded.length),
    finished: row.attempts.some((a) => a.finished),
    open,
  };
}

function groupBy<T>(list: T[], keyOf: (x: T) => string | undefined): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const x of list) {
    const key = keyOf(x);
    if (!key) continue;
    out.set(key, [...(out.get(key) ?? []), x]);
  }
  return out;
}

function StudentCard({ s }: { s: StudentStat }) {
  const [open, setOpen] = useState(false);
  const started = s.row.attempts.length > 0;
  const concepts = [...groupBy(s.graded, (a) => a.concept)].map(([name, list]) => ({ name, percent: pct(list.filter((a) => a.correct).length, list.length) ?? 0 }));
  const strong = concepts.filter((c) => c.percent >= 80).map((c) => c.name);
  const weak = concepts.filter((c) => c.percent < 50).map((c) => c.name);
  const details = s.main && s.main.answers.length > 0;

  return (
    <li className="rounded-2xl border border-line">
      <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-start disabled:cursor-default" disabled={!details} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="w-28 shrink-0 truncate font-bold">{s.row.nickname}</span>
        {!started ? (
          <span className="rounded-full bg-page px-2.5 py-0.5 text-xs text-muted">עוד לא התחיל/ה</span>
        ) : (
          <>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted tabular-nums" data-tip={s.row.attempts.length > 1 ? `זמן עבודה פעיל, ב-${s.row.attempts.length} ניסיונות` : "זמן עבודה פעיל"}>
              <Timer size={14} strokeWidth={2} /> {clock(s.seconds)}
            </span>
            {s.percent != null ? (
              <Bar value={s.percent} label={`${s.correct} נכונות מתוך ${s.graded.length}`} />
            ) : (
              <span className="flex-1 text-sm text-muted">{s.main?.progress != null ? `התקדמות ${s.main.progress}%` : ""}</span>
            )}
            {s.percent != null && (
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {s.correct}/{s.graded.length}
              </span>
            )}
            {s.finished && (
              <span className="shrink-0 text-green-700" data-tip={s.main?.score != null && s.main.maxScore ? `סיים/ה. ציון בפעילות: ${s.main.score} מתוך ${s.main.maxScore}` : "סיים/ה את הפעילות"}>
                <CircleCheck size={16} strokeWidth={2} />
              </span>
            )}
          </>
        )}
      </button>
      {started && (strong.length > 0 || weak.length > 0) && (
        <p className="flex flex-wrap gap-1.5 px-3 pb-2.5 text-xs">
          {weak.map((c) => (
            <span key={c} className="rounded-full bg-coral/10 px-2.5 py-0.5 text-coral" data-tip="פחות מחצי מהתשובות נכונות">
              לחזק: {c}
            </span>
          ))}
          {strong.map((c) => (
            <span key={c} className="rounded-full bg-green-600/10 px-2.5 py-0.5 text-green-800" data-tip="80% ומעלה">
              {c}
            </span>
          ))}
        </p>
      )}
      {open && s.main && (
        <ol className="flex flex-col gap-1.5 border-t border-line px-3 py-2.5 text-sm">
          {s.main.summary && <li className="rounded-xl bg-blue-soft px-3 py-2 text-blue-dark">{s.main.summary}</li>}
          {s.main.answers.map((a, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0" style={{ color: a.correct === null ? "var(--blue-dark)" : a.correct ? "#15803d" : "var(--coral)" }}>
                {a.correct === null ? <MessageSquareText size={15} strokeWidth={2} /> : a.correct ? <CircleCheck size={15} strokeWidth={2} /> : <CircleX size={15} strokeWidth={2} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-muted">{a.q ?? a.id ?? "שאלה"}</span>
                {a.response && <span className="block whitespace-pre-wrap font-medium">{a.response}</span>}
                {a.correct === false && a.expected && <span className="block text-xs text-muted">התשובה הנכונה: {a.expected}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

const TABS = [
  { key: "students", label: "תלמידים", icon: Users },
  { key: "concepts", label: "מושגים", icon: Lightbulb },
  { key: "questions", label: "שאלות", icon: ChartColumn },
  { key: "open", label: "תשובות פתוחות", icon: MessageSquareText },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// נתוני השימוש של כל תלמידי הקבוצה בפעילות HTML אחת.
export function ActivityDialog({ lessonItemId, title, url, onClose }: { lessonItemId: number; title: string; url: string; onClose: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("students");
  const [refreshing, setRefreshing] = useState(false);
  useEscape(onClose);

  const load = useCallback(() => {
    setRefreshing(true);
    return call(`/api/lesson-items/${lessonItemId}/activity`, "GET")
      .then((d: Report) => {
        setReport(d);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "לא הצלחנו לטעון את הנתונים"))
      .finally(() => setRefreshing(false));
  }, [lessonItemId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // בזמן שיעור הנתונים מתעדכנים מעצמם.
    const t = setInterval(() => document.visibilityState === "visible" && load(), 20000);
    return () => clearInterval(t);
  }, [load]);

  const stats = useMemo(() => (report ? report.rows.map(statOf) : []), [report]);
  const worked = stats.filter((s) => s.row.attempts.length > 0);
  const scored = worked.filter((s) => s.percent != null);
  const avgPercent = scored.length ? Math.round(scored.reduce((sum, s) => sum + (s.percent ?? 0), 0) / scored.length) : null;
  const avgSeconds = worked.length ? Math.round(worked.reduce((sum, s) => sum + s.seconds, 0) / worked.length) : 0;
  const allGraded = worked.flatMap((s) => s.graded.map((a) => ({ ...a, nickname: s.row.nickname })));
  const allOpen = worked.flatMap((s) => s.open.map((a) => ({ ...a, nickname: s.row.nickname })));

  // קודם מי שמתקשה, אחריו מי שעבד בלי ציון, ובסוף מי שעוד לא התחיל.
  const ordered = [...stats].sort((a, b) => {
    const rank = (s: StudentStat) => (s.row.attempts.length === 0 ? 2 : s.percent == null ? 1 : 0);
    return rank(a) - rank(b) || (a.percent ?? 0) - (b.percent ?? 0);
  });

  const concepts = [...groupBy(allGraded, (a) => a.concept)]
    .map(([name, list]) => {
      const byStudent = [...groupBy(list, (a) => a.nickname)].map(([nickname, mine]) => ({ nickname, percent: pct(mine.filter((a) => a.correct).length, mine.length) ?? 0 }));
      return { name, total: list.length, percent: pct(list.filter((a) => a.correct).length, list.length) ?? 0, struggling: byStudent.filter((s) => s.percent < 50).map((s) => s.nickname) };
    })
    .sort((a, b) => a.percent - b.percent);

  const questions = [...groupBy(allGraded, (a) => a.id ?? a.q)]
    .map(([key, list]) => {
      const wrong = [...groupBy(list.filter((a) => !a.correct), (a) => a.response)].map(([response, l]) => ({ response, count: l.length })).sort((a, b) => b.count - a.count);
      return { key, text: list.find((a) => a.q)?.q ?? key, concept: list.find((a) => a.concept)?.concept, total: list.length, percent: pct(list.filter((a) => a.correct).length, list.length) ?? 0, wrong: wrong.slice(0, 3) };
    })
    .sort((a, b) => a.percent - b.percent);

  const openGroups = [...groupBy(allOpen, (a) => a.id ?? a.q ?? "תשובה פתוחה")].map(([key, list]) => ({ key, text: list.find((a) => a.q)?.q ?? key, list }));
  const noData = report && worked.length > 0 && allGraded.length === 0 && allOpen.length === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-label="נתוני שימוש">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold">{title}</h2>
            <p className="text-sm text-muted">נתוני השימוש של הקבוצה בפעילות</p>
          </div>
          <a className="btn-icon shrink-0" href={url} target="_blank" rel="noopener noreferrer" data-tip="פתיחת הפעילות" aria-label="פתיחת הפעילות">
            <ExternalLink size={18} strokeWidth={2} />
          </a>
          <button type="button" className="btn-icon shrink-0" data-tip="רענון (מתעדכן מעצמו כל 20 שניות)" aria-label="רענון" onClick={load}>
            <RefreshCw size={18} strokeWidth={2} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button type="button" className="btn-icon shrink-0" aria-label="סגירה" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}
        {!report && !error && <p className="text-sm text-muted">טוענים…</p>}

        {report && (
          <>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "עבדו בפעילות", value: `${worked.length}/${stats.length}`, tip: "תלמידים שפתחו את הפעילות ועבדו בה" },
                { label: "זמן עבודה ממוצע", value: worked.length ? clock(avgSeconds) : "–", tip: "זמן פעיל בלבד: הלשונית גלויה והתלמיד פועל" },
                { label: "הצלחה ממוצעת", value: avgPercent != null ? `${avgPercent}%` : "–", tip: "ממוצע אחוז התשובות הנכונות, לפי הניסיון האחרון של כל תלמיד" },
                { label: "סיימו", value: `${worked.filter((s) => s.finished).length}/${stats.length}`, tip: "הגיעו למסך הסיום של הפעילות" },
              ].map((t) => (
                <div key={t.label} className="rounded-2xl bg-page px-3 py-2.5" data-tip={t.tip}>
                  <dt className="text-xs text-muted">{t.label}</dt>
                  <dd className="text-2xl font-extrabold tabular-nums">{t.value}</dd>
                </div>
              ))}
            </dl>

            {(!report.reporting || noData) && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-orange/10 px-3 py-2.5 text-sm" role="status">
                <Lightbulb size={18} strokeWidth={2} className="shrink-0 text-orange" />
                <span className="min-w-0 flex-1">{report.reporting ? "הפעילות עוד לא דיווחה על תשובות." : "בקוד אין שכבת דיווח, ולכן נמדד רק זמן עבודה."}</span>
                {!report.reporting && <CopySkillButton className="btn btn-ghost !bg-white" />}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5" role="tablist">
              {TABS.map((t) => {
                const count = t.key === "concepts" ? concepts.length : t.key === "questions" ? questions.length : t.key === "open" ? allOpen.length : null;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${tab === t.key ? "border-ink bg-ink text-white" : "border-line text-muted hover:border-blue"}`}
                    onClick={() => setTab(t.key)}
                  >
                    <t.icon size={15} strokeWidth={2} /> {t.label}
                    {count ? <span className="tabular-nums opacity-70">{count}</span> : null}
                  </button>
                );
              })}
            </div>

            {tab === "students" &&
              (stats.length === 0 ? (
                <p className="text-sm text-muted">עדיין אין תלמידים בקבוצה.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {ordered.map((s) => (
                    <StudentCard key={s.row.membershipId} s={s} />
                  ))}
                </ul>
              ))}

            {tab === "concepts" &&
              (concepts.length === 0 ? (
                <p className="text-sm text-muted">עוד אין תשובות עם מושגים.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {concepts.map((c) => (
                    <li key={c.name} className="rounded-2xl border border-line px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-40 shrink-0 truncate font-bold" data-tip={`${c.total} תשובות`}>
                          {c.name}
                        </span>
                        <Bar value={c.percent} />
                      </div>
                      {c.struggling.length > 0 && <p className="mt-1 text-xs text-coral">מתקשים: {c.struggling.join(", ")}</p>}
                    </li>
                  ))}
                </ul>
              ))}

            {tab === "questions" &&
              (questions.length === 0 ? (
                <p className="text-sm text-muted">עוד אין תשובות לשאלות.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {questions.map((q) => (
                    <li key={q.key} className="rounded-2xl border border-line px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-[2] text-sm font-medium" data-tip={[q.concept, `${q.total} תשובות`].filter(Boolean).join(" · ")}>
                          {q.text}
                        </span>
                        <Bar value={q.percent} />
                      </div>
                      {q.wrong.length > 0 && (
                        <p className="mt-1 text-xs text-muted">
                          טעויות נפוצות: {q.wrong.map((w) => `${w.response}${w.count > 1 ? ` (${w.count})` : ""}`).join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ))}

            {tab === "open" &&
              (openGroups.length === 0 ? (
                <p className="text-sm text-muted">עוד אין תשובות פתוחות.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {openGroups.map((g) => (
                    <section key={g.key}>
                      <h3 className="mb-1.5 text-sm font-bold">{g.text}</h3>
                      <ul className="flex flex-col gap-1.5">
                        {g.list.map((a, i) => (
                          <li key={i} className="rounded-2xl bg-page px-3 py-2 text-sm">
                            <span className="font-bold">{a.nickname}: </span>
                            <span className="whitespace-pre-wrap">{a.response}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
