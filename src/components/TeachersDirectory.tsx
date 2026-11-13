"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Eye, SlidersHorizontal, UserRoundCheck, UserRoundPlus, UsersRound } from "lucide-react";

type Scope = { subjects: string[]; classes: string[] };
type TeacherCard = {
  id: number;
  displayName: string;
  groups: Array<{ id: number; name: string; className: string | null; subjectName: string | null }>;
  followers: number;
  following: Scope | null;
};

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "הפעולה נכשלה");
  return data;
}

const uniq = (list: Array<string | null>) => [...new Set(list.filter((x): x is string => Boolean(x)))];

function scopeText(scope: Scope): string {
  const parts = [...scope.subjects, ...scope.classes.map((c) => `כיתה ${c}`)];
  return parts.length ? `מוצע לי ב: ${parts.join(", ")}` : "מוצע לי בכל רצף שאני בונה";
}

// בחירת היקף המעקב: מתי להציע לי את התוכן של המורה במאגר.
function ScopeEditor({ teacher, onSave, onCancel }: { teacher: TeacherCard; onSave: (scope: Scope) => void; onCancel: () => void }) {
  const subjectOptions = uniq([...teacher.groups.map((g) => g.subjectName), ...(teacher.following?.subjects ?? [])]);
  const classOptions = uniq([...teacher.groups.map((g) => g.className), ...(teacher.following?.classes ?? [])]);
  const [subjects, setSubjects] = useState<string[]>(teacher.following?.subjects ?? []);
  const [classes, setClasses] = useState<string[]>(teacher.following?.classes ?? []);
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const always = subjects.length === 0 && classes.length === 0;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-page p-3">
      <p className="text-sm font-medium">מתי להציע לי פריטים של {teacher.displayName}?</p>
      <button
        type="button"
        className={`self-start rounded-full border px-3 py-1 text-sm transition ${always ? "border-blue bg-blue-soft text-blue-dark" : "border-line bg-white text-muted"}`}
        aria-pressed={always}
        onClick={() => {
          setSubjects([]);
          setClasses([]);
        }}
      >
        תמיד, בכל רצף שאני בונה
      </button>
      {subjectOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">רק בתחום:</span>
          {subjectOptions.map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded-full border px-3 py-1 text-sm transition ${subjects.includes(s) ? "border-blue bg-blue-soft text-blue-dark" : "border-line bg-white text-muted"}`}
              aria-pressed={subjects.includes(s)}
              onClick={() => setSubjects(toggle(subjects, s))}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {classOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">רק בכיתה:</span>
          {classOptions.map((c) => (
            <button
              key={c}
              type="button"
              className={`rounded-full border px-3 py-1 text-sm transition ${classes.includes(c) ? "border-blue bg-blue-soft text-blue-dark" : "border-line bg-white text-muted"}`}
              aria-pressed={classes.includes(c)}
              onClick={() => setClasses(toggle(classes, c))}
            >
              כיתה {c}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={() => onSave({ subjects, classes })}>
          <Check size={16} strokeWidth={2} /> {teacher.following ? "שמירה" : "מעקב"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </div>
  );
}

export default function TeachersDirectory() {
  const [teachers, setTeachers] = useState<TeacherCard[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback((query: string) => {
    fetch(`/api/teachers?q=${encodeURIComponent(query)}`)
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/";
          return null;
        }
        if (!r.ok) throw new Error();
        return (await r.json()) as { teachers: TeacherCard[] };
      })
      .then((d) => d && setTeachers(d.teachers))
      .catch(() => setError("לא הצלחנו לטעון את רשימת המורים"));
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => load(q), q ? 300 : 0);
    return () => clearTimeout(handle);
  }, [q, load]);

  async function save(teacher: TeacherCard, scope: Scope) {
    setError("");
    try {
      await call(`/api/teachers/${teacher.id}/follow`, "PUT", scope);
      setEditing(null);
      load(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "הפעולה נכשלה");
    }
  }

  async function unfollow(teacher: TeacherCard) {
    setError("");
    try {
      await call(`/api/teachers/${teacher.id}/follow`, "DELETE");
      setEditing(null);
      load(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "הפעולה נכשלה");
    }
  }

  // קודם מי שאני כבר עוקבת אחריה.
  const ordered = teachers ? [...teachers].sort((a, b) => Number(Boolean(b.following)) - Number(Boolean(a.following))) : [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">מורים</h1>
        <Link href="/" className="btn btn-ghost ms-auto">
          <ArrowRight size={16} strokeWidth={2} /> הקבוצות שלי
        </Link>
      </div>
      <p className="mb-4 text-muted">
        מורים ששיתפו רצף. אפשר לצפות ברצף שלהם ולעקוב: הפריטים של מי שאת עוקבת אחריה יוצעו לך ראשונים במאגר כשאת בונה שיעור.
      </p>
      <input className="field mb-5 max-w-sm" placeholder="חיפוש לפי שם, תחום או קבוצה" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש מורים" />
      {error && <p className="mb-4 text-coral">{error}</p>}

      {teachers === null ? (
        <p className="text-muted">טוענים…</p>
      ) : ordered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-white p-12 text-center">
          <p className="mb-2 text-xl font-medium">{q ? "לא נמצאו מורים" : "עוד אין מורים ששיתפו רצף"}</p>
          <p className="text-muted">כדי לשתף רצף משלך: פותחים קבוצה, לוחצים על הגדרות הקבוצה ומפעילים &quot;שיתוף הרצף עם מורים אחרים&quot;.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {ordered.map((t) => (
            <li key={t.id} className={`rounded-3xl border bg-white p-5 ${t.following ? "border-blue" : "border-line"}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-soft text-lg font-extrabold text-blue-dark">{t.displayName.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold">{t.displayName}</h2>
                  <p className="flex items-center gap-1 text-sm text-muted tabular-nums">
                    <UsersRound size={14} strokeWidth={2} /> {t.followers} עוקבים
                  </p>
                </div>
                {t.following ? (
                  <button className="btn btn-ghost !py-1.5" onClick={() => setEditing(editing === t.id ? null : t.id)} data-tip="שינוי ההיקף או הפסקת המעקב">
                    <UserRoundCheck size={16} strokeWidth={2} /> במעקב
                  </button>
                ) : (
                  <button className="btn btn-primary !py-1.5" onClick={() => setEditing(editing === t.id ? null : t.id)}>
                    <UserRoundPlus size={16} strokeWidth={2} /> מעקב
                  </button>
                )}
              </div>

              {t.following && editing !== t.id && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-blue-dark">
                  <SlidersHorizontal size={14} strokeWidth={2} /> {scopeText(t.following)}
                </p>
              )}

              {editing === t.id && (
                <>
                  <ScopeEditor teacher={t} onSave={(scope) => save(t, scope)} onCancel={() => setEditing(null)} />
                  {t.following && (
                    <button type="button" className="mt-2 text-sm text-muted underline" onClick={() => unfollow(t)}>
                      הפסקת המעקב
                    </button>
                  )}
                </>
              )}

              {t.groups.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {t.groups.map((g) => (
                    <li key={g.id}>
                      <Link href={`/shared/${g.id}`} className="flex items-center gap-2 rounded-2xl bg-page px-3 py-2 text-sm transition hover:bg-blue-soft">
                        <Eye size={15} strokeWidth={2} className="shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
                        <span className="shrink-0 text-xs text-muted">{[g.className && `כיתה ${g.className}`, g.subjectName].filter(Boolean).join(" · ")}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">אין כרגע רצפים משותפים.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
