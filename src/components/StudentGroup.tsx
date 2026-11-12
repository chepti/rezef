"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Eye, Pin } from "lucide-react";
import { TYPE_META, typeOf } from "./content-types";

type ViewItem = {
  id: number;
  title: string;
  imageUrl: string | null;
  contentType: string | null;
  kind: string;
  url: string;
  phase: string | null;
  isAssignment: boolean;
  done: boolean;
};
type ViewLesson = {
  id: number;
  number: number;
  title: string;
  topicId: number | null;
  openedAt: string | null;
  goals: string;
  recap: string;
  boards: Array<{ id: number; image: string; caption: string }>;
  items: ViewItem[];
};
type View = {
  viewer: { kind: "student"; nickname: string } | { kind: "teacher" };
  group: { id: number; name: string; subjectName: string | null };
  topics: Array<{ id: number; name: string; color: string }>;
  lessons: ViewLesson[];
};

const lines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

function ItemCard({ item, canSubmit, onToggle }: { item: ViewItem; canSubmit: boolean; onToggle: (done: boolean) => void }) {
  const type = typeOf(item);
  const { icon: Icon, color } = TYPE_META[type];
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:border-blue hover:shadow-sm">
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex flex-1 flex-col">
        <div className="relative aspect-[16/10] bg-blue-soft">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ color }}>
              <Icon size={40} strokeWidth={2} />
            </div>
          )}
          <span className="absolute top-2 start-2 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white" style={{ background: color }}>
            <Icon size={18} strokeWidth={2} />
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="font-medium leading-snug line-clamp-2">{item.title}</p>
          <p className="text-xs text-muted">{[type, item.phase].filter(Boolean).join(" · ")}</p>
        </div>
      </a>
      {item.isAssignment && (
        <div className="flex items-center gap-2 border-t border-line px-3 py-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange">
            <Pin size={13} strokeWidth={2} /> מטלה
          </span>
          <button
            type="button"
            className={`ms-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
              item.done ? "border-green-600 bg-green-600 text-white" : "border-line text-muted hover:border-blue"
            }`}
            aria-pressed={item.done}
            disabled={!canSubmit}
            onClick={() => onToggle(!item.done)}
          >
            <Check size={14} strokeWidth={2} />
            {item.done ? "הגשתי" : "סימון שהגשתי"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudentGroup({ groupId }: { groupId: number }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  // השיעור האחרון פתוח, הקודמים מקופלים.
  const [closed, setClosed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let stale = false;
    fetch(`/api/student/groups/${groupId}`)
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/s";
          return null;
        }
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error ?? "לא הצלחנו לטעון את הקבוצה");
        return data as View;
      })
      .then((d) => !stale && d && setView(d))
      .catch((e) => !stale && setError(e instanceof Error ? e.message : "שגיאה"));
    return () => {
      stale = true;
    };
  }, [groupId]);

  async function toggle(lessonId: number, itemId: number, done: boolean) {
    const patch = (value: boolean) =>
      setView((prev) =>
        prev
          ? {
              ...prev,
              lessons: prev.lessons.map((l) => (l.id === lessonId ? { ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, done: value } : i)) } : l)),
            }
          : prev,
      );
    patch(done);
    try {
      const res = await fetch("/api/student/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonItemId: itemId, done }),
      });
      if (!res.ok) throw new Error();
    } catch {
      patch(!done);
      setError("הסימון לא נשמר. נסו שוב.");
    }
  }

  if (error && !view) return <p className="p-10 text-coral">{error}</p>;
  if (!view) return <p className="p-10 text-muted">טוענים…</p>;

  const isTeacher = view.viewer.kind === "teacher";
  const topicOf = (id: number | null) => view.topics.find((t) => t.id === id);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-5 py-8">
      {isTeacher && (
        <p className="flex items-center gap-2 rounded-full bg-blue-soft px-4 py-2 text-sm text-blue-dark" role="status">
          <Eye size={16} strokeWidth={2} />
          תצוגת תלמיד: כך התלמידים רואים את הקבוצה. מוצגים רק שיעורים שפתחת.
          <a href={`/g/${view.group.id}`} className="ms-auto inline-flex items-center gap-1 font-medium underline">
            <ArrowRight size={14} strokeWidth={2} /> חזרה לרצף
          </a>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{view.group.name}</h1>
        {view.group.subjectName && <span className="rounded-full bg-blue-soft px-3 py-1 text-sm text-blue-dark">{view.group.subjectName}</span>}
        {view.viewer.kind === "student" && (
          <a href="/s" className="btn btn-ghost ms-auto">
            <ArrowRight size={16} strokeWidth={2} /> הקבוצות שלי
          </a>
        )}
      </div>

      {error && (
        <p className="text-sm text-coral" role="alert">
          {error}
        </p>
      )}

      {view.lessons.length === 0 && (
        <p className="rounded-3xl border border-dashed border-line bg-white/60 p-8 text-center text-muted">
          {isTeacher ? "עדיין לא פתחת שיעורים לתלמידים. פותחים שיעור בכפתור העין שבראש השיעור." : "המורה עדיין לא פתחה שיעורים. חזרו לכאן אחרי השיעור הבא."}
        </p>
      )}

      {view.lessons.map((lesson, index) => {
        const topic = topicOf(lesson.topicId);
        const isClosed = closed[lesson.id] ?? index > 0;
        const goals = lines(lesson.goals);
        const recap = lines(lesson.recap);
        const tasks = lesson.items.filter((i) => i.isAssignment);
        return (
          <section key={lesson.id} className="rounded-3xl border border-line bg-white/70 p-4 sm:p-5">
            <button
              type="button"
              className="flex w-full items-center gap-3 text-start"
              aria-expanded={!isClosed}
              onClick={() => setClosed((prev) => ({ ...prev, [lesson.id]: !isClosed }))}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white tabular-nums"
                style={{ background: topic?.color ?? "var(--blue)" }}
              >
                {lesson.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xl font-extrabold">{lesson.title}</span>
                <span className="block truncate text-sm text-muted">
                  {[
                    topic?.name,
                    lesson.openedAt ? new Date(lesson.openedAt).toLocaleDateString("he-IL", { day: "numeric", month: "long" }) : null,
                    tasks.length ? `${tasks.filter((t) => t.done).length} מתוך ${tasks.length} מטלות הוגשו` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {index === 0 && <span className="shrink-0 rounded-full bg-blue-soft px-3 py-1 text-xs font-medium text-blue-dark">השיעור האחרון</span>}
              <span className="shrink-0 text-muted">{isClosed ? <ChevronDown size={18} strokeWidth={2} /> : <ChevronUp size={18} strokeWidth={2} />}</span>
            </button>

            {!isClosed && (
              <div className="mt-4 flex flex-col gap-4">
                {goals.length > 0 && (
                  <div className="rounded-2xl bg-blue-soft/60 p-4">
                    <h3 className="mb-1.5 text-sm font-bold text-blue-dark">מה נלמד</h3>
                    <ul className="flex list-disc flex-col gap-1 ps-5">
                      {goals.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {lesson.items.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {lesson.items.map((item) => (
                      <ItemCard key={item.id} item={item} canSubmit={!isTeacher} onToggle={(done) => toggle(lesson.id, item.id, done)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">אין פריטים בשיעור הזה.</p>
                )}

                {lesson.boards.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-bold">הלוח מהשיעור</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {lesson.boards.map((b) => (
                        <a key={b.id} href={b.image} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-2xl border border-line bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={b.image} alt={b.caption || "לוח מהשיעור"} className="w-full" />
                          {b.caption && <p className="px-3 py-2 text-sm text-muted">{b.caption}</p>}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {recap.length > 0 && (
                  <div className="rounded-2xl bg-page p-4">
                    <h3 className="mb-1.5 text-sm font-bold">מה למדנו</h3>
                    <ul className="flex list-disc flex-col gap-1 ps-5">
                      {recap.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
