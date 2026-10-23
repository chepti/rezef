"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import TagInput from "./tag-input";

export type Terms = { classes: string[]; subjects: string[]; categories: string[] };

export type PublishItem = {
  id: number;
  title: string;
  url: string;
  imageUrl: string | null;
  kind: string;
  siteName: string | null;
};

export type PublishContext = { className: string | null; subjectName: string | null; tags: string[] };

// ניחוש קטגוריה לפי סוג הפריט; המורה יכולה לשנות.
const KIND_CATEGORY: Record<string, string> = {
  slides: "מצגת",
  youtube: "סרטון",
  video: "סרטון",
  game: "כלי דיגיטלי",
  file: "להדפסה",
  doc: "מערך שיעור",
};

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "הפרסום נכשל");
  return data;
}

export default function PublishDialog({
  item,
  note,
  context,
  terms,
  onClose,
  onDone,
}: {
  item: PublishItem;
  note: string;
  context: PublishContext;
  terms: Terms;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [intro, setIntro] = useState(note);
  const [category, setCategory] = useState(KIND_CATEGORY[item.kind] ?? "אחר");
  const [classes, setClasses] = useState<string[]>(context.className ? [context.className] : []);
  const [subject, setSubject] = useState(context.subjectName ?? "");
  const [tags, setTags] = useState<string[]>(context.tags);
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? "");
  const [credit, setCredit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // קרדיט ברירת מחדל: שם המורה. אפשר לשנות אם היוצר המקורי אחר.
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.teacher?.displayName && setCredit((c) => c || d.teacher.displayName))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const missing = [
    !title.trim() && "כותרת",
    !intro.trim() && "פתיח",
    classes.length === 0 && "כיתה",
    !subject && "תחום דעת",
    !imageUrl.trim() && "תמונה",
  ].filter(Boolean) as string[];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missing.length) {
      setError(`חסר: ${missing.join(", ")}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post(`/api/items/${item.id}/publish`, {
        title,
        intro,
        category,
        classes,
        subjects: [subject],
        tags,
        credit: credit || undefined,
        imageUrl,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "הפרסום נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl" role="dialog" aria-label="פרסום בחומר פתוח">
        <div className="flex items-center gap-2 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/openstuff-mark.png" alt="" width={28} height={28} draggable={false} />
          <h2 className="text-xl font-extrabold">פרסום בחומר פתוח</h2>
          <button type="button" className="btn-icon ms-auto" aria-label="סגירה" data-tip="סגירה" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <p className="text-sm text-muted mb-4">הפריט יישלח לבדיקה, ויופיע באתר אחרי אישור. כל השדות מולאו מראש מהרצף.</p>

        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1 text-sm font-medium">
            כותרת
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            פתיח
            <textarea
              className="rounded-3xl border border-line px-4 py-2.5 text-sm font-normal outline-none focus:border-blue focus:ring-4 focus:ring-blue-soft resize-none"
              rows={3}
              maxLength={600}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="משפט או שניים: מה זה, ולמי זה מתאים"
            />
          </label>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              קטגוריה
              <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                {terms.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              תחום דעת
              <select className="field" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">בחירה</option>
                {terms.subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium mb-1">כיתות</legend>
            <div className="flex flex-wrap gap-1.5">
              {terms.classes.map((c) => {
                const on = classes.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setClasses(on ? classes.filter((x) => x !== c) : [...classes, c])}
                    className={`rounded-full border px-3 py-1 text-sm transition ${on ? "bg-blue text-white border-blue" : "border-line text-muted hover:border-blue"}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" data-tip="התגיות של הקבוצה נוספו אוטומטית">
              תגיות
            </span>
            <TagInput value={tags} onChange={setTags} />
          </div>

          <div className="flex items-start gap-3">
            <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-blue-soft border border-line">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-muted text-center px-2">אין תמונה</div>
              )}
            </div>
            <label className="flex-1 flex flex-col gap-1 text-sm font-medium">
              כתובת תמונה
              <input className="field" dir="ltr" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              <span className="text-xs font-normal text-muted">התמונה נשלפה מהקישור. אפשר להחליף בכתובת של תמונה אחרת.</span>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            קרדיט
            <input className="field" value={credit} onChange={(e) => setCredit(e.target.value)} maxLength={80} />
          </label>
        </div>

        {error && <p className="mt-4 text-coral text-sm">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "שולחים…" : "שליחה לבדיקה"}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
}
