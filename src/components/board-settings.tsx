"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import TagInput from "./tag-input";
import type { Terms } from "./board-publish";
import type { Topic } from "./board-topics";

export type SettingsGroup = {
  id: number;
  name: string;
  className: string | null;
  subjectName: string | null;
  tags: string[];
};

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "הפעולה נכשלה");
}

const lessonsLabel = (n: number) => (n === 1 ? "שיעור אחד" : `${n} שיעורים`);

/* ---------- ניהול נושאים: שם, סדר ומחיקה ---------- */

function TopicRow({
  topic,
  index,
  total,
  lessonCount,
  others,
  onChanged,
}: {
  topic: Topic;
  index: number;
  total: number;
  lessonCount: number;
  others: Topic[];
  onChanged: () => void;
}) {
  const [name, setName] = useState(topic.name);
  const [confirming, setConfirming] = useState(false);
  const [mode, setMode] = useState<"move" | "delete">("move");
  const [moveTo, setMoveTo] = useState<number>(others[0]?.id ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  const remove = () =>
    run(async () => {
      const query = lessonCount === 0 ? "" : mode === "move" ? `?moveTo=${moveTo}` : "?deleteLessons=1";
      await call(`/api/topics/${topic.id}${query}`, "DELETE");
      setConfirming(false);
    });

  return (
    <li className="rounded-2xl border border-line bg-white p-2.5">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: topic.color }} aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent font-medium outline-none"
          value={name}
          maxLength={60}
          aria-label="שם הנושא"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== topic.name && run(() => call(`/api/topics/${topic.id}`, "PATCH", { name }))}
        />
        <span className="shrink-0 rounded-full bg-page px-2.5 py-0.5 text-xs text-muted tabular-nums">
          {lessonCount === 0 ? "ריק" : lessonsLabel(lessonCount)}
        </span>
        <button
          type="button"
          className="btn-icon !p-1.5"
          data-tip="הקדמה"
          aria-label="הקדמת הנושא"
          disabled={busy || index === 0}
          onClick={() => run(() => call(`/api/topics/${topic.id}`, "PATCH", { index: index - 1 }))}
        >
          <ChevronUp size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="btn-icon !p-1.5"
          data-tip="העברה אחורה"
          aria-label="העברת הנושא אחורה"
          disabled={busy || index === total - 1}
          onClick={() => run(() => call(`/api/topics/${topic.id}`, "PATCH", { index: index + 1 }))}
        >
          <ChevronDown size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="btn-icon !p-1.5"
          data-tip={total <= 1 ? "אי אפשר למחוק את הנושא היחיד" : "מחיקת הנושא"}
          aria-label="מחיקת הנושא"
          disabled={busy || total <= 1}
          onClick={() => setConfirming((v) => !v)}
        >
          <Trash2 size={16} strokeWidth={2} />
        </button>
      </div>

      {confirming && (
        <div className="mt-2.5 flex flex-col gap-2 rounded-2xl bg-page p-3 text-sm">
          {lessonCount === 0 ? (
            <p>למחוק את הנושא &quot;{topic.name}&quot;?</p>
          ) : (
            <>
              <p className="font-medium">
                בנושא &quot;{topic.name}&quot; יש {lessonsLabel(lessonCount)}. מה לעשות {lessonCount === 1 ? "איתו" : "איתם"}?
              </p>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "move"} onChange={() => setMode("move")} />
                להעביר לנושא:
                <select className="rounded-full border border-line bg-white px-3 py-1" value={moveTo} onChange={(e) => setMoveTo(Number(e.target.value))} disabled={mode !== "move"}>
                  {others.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "delete"} onChange={() => setMode("delete")} />
                {lessonCount === 1 ? "למחוק את השיעור עם הנושא" : "למחוק את השיעורים עם הנושא"}
                <span className="text-xs text-muted">(הפריטים נשארים במחסן, תחת &quot;שלי&quot;)</span>
              </label>
            </>
          )}
          {error && <p className="text-coral">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary !py-1.5" disabled={busy} onClick={remove}>
              {busy ? "מוחקים…" : "מחיקה"}
            </button>
            <button type="button" className="btn btn-ghost !py-1.5" onClick={() => setConfirming(false)}>
              ביטול
            </button>
          </div>
        </div>
      )}
      {!confirming && error && <p className="mt-1.5 text-sm text-coral">{error}</p>}
    </li>
  );
}

// הגדרות הקבוצה: שם, כיתה, תחום ותגיות. הכיתה והתחום קובעים מה המחסן מציע ואיך פריטים מתויגים,
// והתגיות נשלחות עם כל פריט שמפרסמים מהרצף לחומר פתוח. ניהול הנושאים (סדר ומחיקה) נמצא כאן
// ולא בסרגל הנושאים, כי זו פעולה נדירה.
export default function GroupSettings({
  group,
  terms,
  topics,
  lessonCounts,
  onSaved,
  onTopicsChanged,
  onClose,
}: {
  group: SettingsGroup;
  terms: Terms;
  topics: Topic[];
  lessonCounts: Record<number, number>;
  onSaved: () => void;
  onTopicsChanged: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [className, setClassName] = useState(group.className ?? "");
  const [subjectName, setSubjectName] = useState(group.subjectName ?? "");
  const [tags, setTags] = useState<string[]>(group.tags ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await call(`/api/groups/${group.id}`, "PATCH", { name, className: className || null, subjectName: subjectName || null, tags });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mb-5 grid max-w-[110rem] gap-5 rounded-3xl border border-line bg-white p-5 lg:grid-cols-[2fr_1fr]">
      <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
        <input className="field md:col-span-2" value={name} onChange={(e) => setName(e.target.value)} aria-label="שם הקבוצה" />
        <select className="field" value={className} onChange={(e) => setClassName(e.target.value)} aria-label="כיתה">
          <option value="">כיתה</option>
          {terms.classes.map((c) => (
            <option key={c} value={c}>
              כיתה {c}
            </option>
          ))}
        </select>
        <select className="field" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} aria-label="תחום דעת">
          <option value="">תחום דעת</option>
          {terms.subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="md:col-span-2">
          <p className="mb-1.5 text-sm text-muted" data-tip="יישמרו כתגיות בפוסטים שתפרסמו מהרצף לחומר פתוח">
            תגיות נוספות
          </p>
          <TagInput value={tags} onChange={setTags} />
        </div>
        {error && <p className="md:col-span-2 text-sm text-coral">{error}</p>}
        <div className="md:col-span-2 flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "שומרים…" : "שמירה"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            סגירה
          </button>
        </div>
      </form>

      <section aria-label="ניהול נושאים">
        <h2 className="mb-2 text-base font-bold" data-tip="שם, סדר ומחיקה של נושאים">
          נושאים
        </h2>
        <ul className="flex flex-col gap-2">
          {topics.map((t, i) => (
            <TopicRow
              key={`${t.id}-${t.name}`}
              topic={t}
              index={i}
              total={topics.length}
              lessonCount={lessonCounts[t.id] ?? 0}
              others={topics.filter((x) => x.id !== t.id)}
              onChanged={onTopicsChanged}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
