"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, X } from "lucide-react";
import TagInput from "./tag-input";
import type { PublishContext, Terms } from "./board-publish";

export type LessonForPublish = {
  id: number;
  title: string;
  publishedCollectionUrl: string | null;
  items: Array<{
    id: number;
    note: string;
    item: {
      id: number;
      title: string;
      url: string;
      imageUrl: string | null;
      kind: string;
      contentType: string | null;
      siteName: string | null;
      publishedPostId: number | null;
    };
  }>;
};

type Row = { include: boolean; note: string; title: string; intro: string; category: string; imageUrl: string; open: boolean };
type Result = { url: string | null; added: number; failed: Array<{ lessonItemId: number; title: string; error: string }> };

const KIND_CATEGORY: Record<string, string> = { slides: "מצגת", youtube: "סרטון", video: "סרטון", game: "פעילות", file: "להדפסה", doc: "מערך שיעור" };

type RowItem = LessonForPublish["items"][number];
const isNew = (r: RowItem) => r.item.kind !== "openstuff" && !r.item.publishedPostId;

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? (res.status >= 500 ? "השרת לא ענה כרגע. נסו שוב בעוד רגע" : "הפרסום נכשל"));
  return data as Result;
}

export default function PublishLessonDialog({
  lesson,
  context,
  terms,
  onClose,
  onDone,
}: {
  lesson: LessonForPublish;
  context: PublishContext;
  terms: Terms;
  onClose: () => void;
  onDone: () => void;
}) {
  const defaultName = /^שיעור\s*\d*$/.test(lesson.title.trim()) ? "" : lesson.title;
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [classes, setClasses] = useState<string[]>(context.className ? [context.className] : []);
  const [subject, setSubject] = useState(context.subjectName ?? "");
  const [tags, setTags] = useState<string[]>(context.tags);
  const [rows, setRows] = useState<Record<number, Row>>(() =>
    Object.fromEntries(
      lesson.items.map((r) => [
        r.id,
        {
          include: true,
          note: r.note,
          title: r.item.title,
          intro: r.note,
          category: r.item.contentType ?? KIND_CATEGORY[r.item.kind] ?? "אחר",
          imageUrl: r.item.imageUrl ?? "",
          open: false,
        },
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const set = (id: number, patch: Partial<Row>) => setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const included = lesson.items.filter((r) => rows[r.id]?.include);
  const newOnes = included.filter(isNew);

  function problems(): string[] {
    const out: string[] = [];
    if (!name.trim()) out.push("שם האוסף");
    if (included.length === 0) out.push("לפחות פריט אחד");
    if (newOnes.length > 0) {
      if (classes.length === 0) out.push("כיתה");
      if (!subject) out.push("תחום דעת");
      for (const r of newOnes) {
        const row = rows[r.id];
        const missing = [!row.title.trim() && "כותרת", !row.intro.trim() && "פתיח", !row.imageUrl.trim() && "תמונה"].filter(Boolean);
        if (missing.length) out.push(`${r.item.title.slice(0, 28)}: ${missing.join(", ")}`);
      }
    }
    return out;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = problems();
    if (missing.length) {
      setError(`חסר: ${missing.join(" · ")}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await post(`/api/lessons/${lesson.id}/publish`, {
        name,
        description,
        classes,
        subjects: subject ? [subject] : [],
        tags,
        items: lesson.items.map((r) => ({
          lessonItemId: r.id,
          include: rows[r.id].include,
          note: rows[r.id].note,
          ...(isNew(r)
            ? { title: rows[r.id].title, intro: rows[r.id].intro, category: rows[r.id].category, imageUrl: rows[r.id].imageUrl }
            : {}),
        })),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "הפרסום נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form onSubmit={submit} className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-label="פרסום השיעור כאוסף">
        <div className="flex items-center gap-2 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/openstuff-mark.png" alt="" width={28} height={28} draggable={false} />
          <h2 className="text-xl font-extrabold">פרסום השיעור כאוסף בחומר פתוח</h2>
          <button type="button" className="btn-icon ms-auto" aria-label="סגירה" data-tip="סגירה" onClick={onClose} disabled={busy}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {result ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="rounded-2xl bg-blue-soft px-4 py-3 text-blue-dark">
              האוסף {lesson.publishedCollectionUrl ? "עודכן" : "נוצר"} עם {result.added} פריטים. פריטים חדשים ממתינים לאישור, ויופיעו באוסף אחרי שיאושרו.
            </p>
            {result.failed.length > 0 && (
              <div className="rounded-2xl border border-coral/40 px-4 py-3 text-sm">
                <p className="font-medium text-coral mb-1">לא כל הפריטים נשלחו:</p>
                <ul className="list-disc ps-5">
                  {result.failed.map((f) => (
                    <li key={f.lessonItemId}>
                      {f.title}: {f.error}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-muted">אפשר לתקן ולפרסם שוב: האוסף יתעדכן, בלי כפילויות.</p>
              </div>
            )}
            <div className="flex gap-2">
              {result.url && (
                <a href={result.url} target="_blank" rel="noreferrer" className="btn btn-primary">
                  <ExternalLink size={16} strokeWidth={2} /> לצפייה באוסף
                </a>
              )}
              <button type="button" className="btn btn-ghost" onClick={onDone}>
                סגירה
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted mb-4">
              השיעור יהפוך לאוסף בבעלותך. פריט שכבר באתר נכנס כמו שהוא, וקישור חיצוני יישלח לבדיקה כפוסט חדש. ההערה של כל פריט תוצג באוסף.
              {lesson.publishedCollectionUrl && " השיעור כבר פורסם: שליחה תעדכן את אותו אוסף."}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <input className="field sm:col-span-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם האוסף" maxLength={120} aria-label="שם האוסף" />
              <textarea
                className="sm:col-span-2 rounded-3xl border border-line px-4 py-2.5 text-sm outline-none focus:border-blue focus:ring-4 focus:ring-blue-soft resize-none"
                rows={2}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="תיאור קצר של האוסף (לא חובה)"
                aria-label="תיאור האוסף"
              />
            </div>

            <ul className="mt-4 flex flex-col gap-2">
              {lesson.items.map((r) => {
                const row = rows[r.id];
                const fresh = isNew(r);
                const status = r.item.kind === "openstuff" ? "כבר בחומר פתוח" : r.item.publishedPostId ? "נשלח לבדיקה קודם" : "הגשה חדשה";
                return (
                  <li key={r.id} className={`rounded-2xl border p-3 ${row.include ? "border-line bg-white" : "border-line/60 bg-page opacity-70"}`}>
                    <div className="flex items-center gap-2.5">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--blue)]" checked={row.include} onChange={(e) => set(r.id, { include: e.target.checked })} aria-label={`הכללת ${r.item.title}`} />
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-blue-soft">
                        {r.item.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.item.imageUrl} alt="" draggable={false} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.item.title}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${fresh ? "bg-orange/10 text-orange" : "bg-blue-soft text-blue-dark"}`}>{status}</span>
                    </div>
                    {row.include && (
                      <div className="mt-2 flex flex-col gap-2">
                        <textarea
                          className="rounded-2xl border border-line bg-page/60 px-3 py-2 text-sm outline-none focus:border-blue resize-none"
                          rows={2}
                          maxLength={500}
                          value={row.note}
                          onChange={(e) => set(r.id, { note: e.target.value, ...(fresh && row.intro === row.note ? { intro: e.target.value } : {}) })}
                          placeholder="איך משתמשים בזה? (יוצג באוסף)"
                          aria-label="הערת שימוש"
                        />
                        {fresh && (
                          <>
                            <button type="button" className="inline-flex items-center gap-1 self-start text-xs text-blue-dark" onClick={() => set(r.id, { open: !row.open })} aria-expanded={row.open}>
                              פרטי ההגשה החדשה {row.open ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
                            </button>
                            {row.open && (
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input className="field sm:col-span-2" value={row.title} onChange={(e) => set(r.id, { title: e.target.value })} placeholder="כותרת" maxLength={200} aria-label="כותרת" />
                                <textarea
                                  className="sm:col-span-2 rounded-2xl border border-line px-3 py-2 text-sm outline-none focus:border-blue resize-none"
                                  rows={2}
                                  maxLength={600}
                                  value={row.intro}
                                  onChange={(e) => set(r.id, { intro: e.target.value })}
                                  placeholder="פתיח: מה זה, ולמי זה מתאים"
                                  aria-label="פתיח"
                                />
                                <select className="field" value={row.category} onChange={(e) => set(r.id, { category: e.target.value })} aria-label="קטגוריה">
                                  {terms.categories.map((c) => (
                                    <option key={c}>{c}</option>
                                  ))}
                                </select>
                                <input className="field" dir="ltr" value={row.imageUrl} onChange={(e) => set(r.id, { imageUrl: e.target.value })} placeholder="כתובת תמונה" aria-label="כתובת תמונה" />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {newOnes.length > 0 && (
              <div className="mt-4 grid gap-3 rounded-2xl bg-page p-3.5">
                <p className="text-sm font-medium">לפריטים החדשים ({newOnes.length})</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className="field" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="תחום דעת">
                    <option value="">תחום דעת</option>
                    {terms.subjects.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-1.5">
                    {terms.classes.map((c) => {
                      const on = classes.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setClasses(on ? classes.filter((x) => x !== c) : [...classes, c])}
                          className={`rounded-full border px-2.5 py-0.5 text-sm transition ${on ? "bg-blue text-white border-blue" : "border-line bg-white text-muted hover:border-blue"}`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <TagInput value={tags} onChange={setTags} />
              </div>
            )}

            {error && <p className="mt-4 text-sm text-coral">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "מפרסמים…" : lesson.publishedCollectionUrl ? "עדכון האוסף" : "פרסום האוסף"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={onClose} disabled={busy}>
                ביטול
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
