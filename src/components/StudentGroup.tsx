"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ExternalLink, Eye, Frown, LifeBuoy, Meh, MessageSquareText, Pin, Smile, X } from "lucide-react";
import { TYPE_META, typeOf } from "./content-types";

type Submission = { answer: string; link: string | null; rating: number | null; needsHelp: boolean; feedback: string; updatedAt: string };
type ViewItem = {
  id: number;
  title: string;
  imageUrl: string | null;
  contentType: string | null;
  kind: string;
  url: string;
  phase: string | null;
  isAssignment: boolean;
  submission: Submission | null;
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

const RATINGS = [
  { value: 1, label: "היה קל", icon: Smile },
  { value: 2, label: "היה בסדר", icon: Meh },
  { value: 3, label: "היה קשה", icon: Frown },
] as const;

/* ---------- טבעת התקדמות ---------- */

function Ring({ done, total, color }: { done: number; total: number; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const part = total ? done / total : 0;
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`הוגשו ${done} מתוך ${total} מטלות`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * part} ${c}`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

/* ---------- כרטיס פריט ---------- */

function ItemCard({ item, big, onOpen }: { item: ViewItem; big: boolean; onOpen: () => void }) {
  const type = typeOf(item);
  const { icon: Icon, color } = TYPE_META[type];
  const sub = item.submission;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group/card relative flex flex-col overflow-hidden rounded-3xl border bg-white text-start shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
        big ? "sm:col-span-2 sm:row-span-2" : ""
      } ${item.isAssignment ? "border-orange/60" : "border-line"}`}
    >
      <div className={`relative w-full bg-blue-soft ${big ? "aspect-[16/9] sm:flex-1 sm:aspect-auto sm:min-h-64" : "aspect-[16/10]"}`}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover/card:scale-105" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${color}1a`, color }}>
            <Icon size={big ? 72 : 44} strokeWidth={2} />
          </div>
        )}
        <span className="absolute top-3 start-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-white shadow-md" style={{ background: color }}>
          <Icon size={16} strokeWidth={2} /> {type}
        </span>
        {item.isAssignment && (
          <span
            className={`absolute top-3 end-3 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium shadow-md ${
              sub ? "bg-green-600 text-white" : "bg-white text-orange"
            }`}
          >
            {sub ? <Check size={15} strokeWidth={2} /> : <Pin size={15} strokeWidth={2} />}
            {sub ? "הוגש" : "מטלה"}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        <p className={`font-bold leading-snug line-clamp-2 ${big ? "text-xl" : ""}`}>{item.title}</p>
        <p className="flex items-center gap-2 text-sm text-muted">
          {item.phase}
          {sub?.feedback && (
            <span className="inline-flex items-center gap-1 text-blue-dark">
              <MessageSquareText size={14} strokeWidth={2} /> יש משוב מהמורה
            </span>
          )}
        </p>
      </div>
    </button>
  );
}

/* ---------- צפייה בפריט והגשה ---------- */

function Viewer({
  item,
  isTeacher,
  onClose,
  onSaved,
}: {
  item: ViewItem;
  isTeacher: boolean;
  onClose: () => void;
  onSaved: (sub: Submission | null) => void;
}) {
  const type = typeOf(item);
  const { icon: Icon, color } = TYPE_META[type];
  const isImage = item.kind === "image";
  // undefined = עדיין בודקים אם אפשר להציג בתוך הדף, null = אי אפשר.
  const [embedUrl, setEmbedUrl] = useState<string | null | undefined>(isImage ? null : undefined);
  const [answer, setAnswer] = useState(item.submission?.answer ?? "");
  const [link, setLink] = useState(item.submission?.link ?? "");
  const [rating, setRating] = useState<number | null>(item.submission?.rating ?? null);
  const [needsHelp, setNeedsHelp] = useState(item.submission?.needsHelp ?? false);
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isImage) return;
    let stale = false;
    const path = isTeacher ? `/api/embed?url=${encodeURIComponent(item.url)}` : `/api/student/items/${item.id}/embed`;
    fetch(path)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { embedUrl?: string | null } | null) => !stale && setEmbedUrl(d?.embedUrl ?? null))
      .catch(() => !stale && setEmbedUrl(null));
    return () => {
      stale = true;
    };
  }, [item.id, item.url, isImage, isTeacher]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(remove: boolean) {
    setState("busy");
    setError("");
    try {
      const res = await fetch("/api/student/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(remove ? { lessonItemId: item.id, remove: true } : { lessonItemId: item.id, answer, link: link.trim() || null, rating, needsHelp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "ההגשה לא נשמרה");
      onSaved(
        remove ? null : { answer: answer.trim(), link: link.trim() || null, rating, needsHelp, feedback: item.submission?.feedback ?? "", updatedAt: new Date().toISOString() },
      );
      setState(remove ? "idle" : "saved");
      if (remove) {
        setAnswer("");
        setLink("");
        setRating(null);
        setNeedsHelp(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ההגשה לא נשמרה");
      setState("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-page" role="dialog" aria-label={item.title}>
      <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}>
          <Icon size={18} strokeWidth={2} />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-lg font-extrabold">{item.title}</h2>
        <a className="btn btn-ghost" href={item.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} strokeWidth={2} /> פתיחה בלשונית
        </a>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          <X size={16} strokeWidth={2} /> סגירה
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[45vh] flex-1 bg-white">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.title} className="absolute inset-0 h-full w-full object-contain" />
          ) : embedUrl ? (
            <iframe
              className="absolute inset-0 h-full w-full"
              src={embedUrl}
              title={item.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
              allowFullScreen
              // התוכן המוטמע לא רשאי להחליף את הדף.
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="max-h-[45vh] max-w-full rounded-3xl border border-line object-contain" />
              )}
              {embedUrl === undefined ? (
                <p className="text-muted">טוענים…</p>
              ) : (
                <>
                  <p className="text-muted">הפריט הזה נפתח בלשונית נפרדת.</p>
                  <a className="btn btn-primary !px-6 !py-3 text-lg" href={item.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={20} strokeWidth={2} /> פתיחה
                  </a>
                </>
              )}
            </div>
          )}
        </div>

        {item.isAssignment && (
          <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-line bg-white p-5 lg:w-96 lg:border-s lg:border-t-0">
            <h3 className="flex items-center gap-2 text-lg font-extrabold">
              <Pin size={18} strokeWidth={2} className="text-orange" /> המטלה שלי
            </h3>

            {item.submission?.feedback && (
              <div className="rounded-2xl bg-blue-soft p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-blue-dark">
                  <MessageSquareText size={14} strokeWidth={2} /> משוב מהמורה
                </p>
                <p className="whitespace-pre-wrap text-sm">{item.submission.feedback}</p>
              </div>
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">התשובה שלי</span>
              <textarea
                className="block min-h-32 w-full resize-y rounded-2xl border border-line bg-page/60 px-3 py-2 outline-none focus:border-blue"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                maxLength={4000}
                placeholder="מה למדתי, מה עשיתי, או תשובה לשאלה"
                disabled={isTeacher}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium" data-tip="למשל קישור למסמך, למצגת או לתוצר שהכנתם">
                קישור לעבודה שלי
              </span>
              <input className="field" dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" maxLength={500} disabled={isTeacher} />
            </label>

            <div className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">איך היה לי?</span>
              <div className="flex gap-1.5" role="group" aria-label="איך היה לי">
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-xs transition ${
                      rating === r.value ? "border-blue bg-blue-soft text-blue-dark" : "border-line text-muted hover:border-blue"
                    }`}
                    aria-pressed={rating === r.value}
                    disabled={isTeacher}
                    onClick={() => setRating(rating === r.value ? null : r.value)}
                  >
                    <r.icon size={22} strokeWidth={2} />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                needsHelp ? "border-coral bg-coral/10 text-coral" : "border-line text-muted hover:border-coral"
              }`}
              aria-pressed={needsHelp}
              disabled={isTeacher}
              onClick={() => setNeedsHelp((v) => !v)}
            >
              <LifeBuoy size={16} strokeWidth={2} />
              {needsHelp ? "ביקשתי עזרה מהמורה" : "אני צריך/ה עזרה"}
            </button>

            {error && (
              <p className="text-sm text-coral" role="alert">
                {error}
              </p>
            )}
            {isTeacher ? (
              <p className="text-xs text-muted">תצוגה מקדימה: כך נראה טופס ההגשה לתלמידים.</p>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => send(false)}>
                  <Check size={16} strokeWidth={2} />
                  {state === "busy" ? "שומרים…" : item.submission ? "עדכון ההגשה" : "הגשה"}
                </button>
                {state === "saved" && (
                  <span className="text-sm text-green-700" role="status">
                    נשמר
                  </span>
                )}
                {item.submission && (
                  <button type="button" className="ms-auto text-xs text-muted underline" disabled={state === "busy"} onClick={() => send(true)}>
                    ביטול ההגשה
                  </button>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

/* ---------- דף הקבוצה ---------- */

export default function StudentGroup({ groupId }: { groupId: number }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [openItem, setOpenItem] = useState<number | null>(null);

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

  // בסרגל השיעורים הסדר הוא סדר הלימוד (הישן מימין), והשיעור האחרון שנפתח נבחר כברירת מחדל.
  const ordered = useMemo(() => (view ? [...view.lessons].reverse() : []), [view]);
  const lesson = view ? (view.lessons.find((l) => l.id === selected) ?? view.lessons[0] ?? null) : null;

  if (error && !view) return <p className="p-10 text-coral">{error}</p>;
  if (!view) return <p className="p-10 text-muted">טוענים…</p>;

  const isTeacher = view.viewer.kind === "teacher";
  const topicOf = (id: number | null) => view.topics.find((t) => t.id === id);
  const color = topicOf(lesson?.topicId ?? null)?.color ?? "var(--blue)";
  const allTasks = view.lessons.flatMap((l) => l.items.filter((i) => i.isAssignment));
  const doneTasks = allTasks.filter((i) => i.submission).length;
  const viewing = lesson?.items.find((i) => i.id === openItem) ?? null;

  function patchSubmission(lessonId: number, itemId: number, sub: Submission | null) {
    setView((prev) =>
      prev
        ? {
            ...prev,
            lessons: prev.lessons.map((l) => (l.id === lessonId ? { ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, submission: sub } : i)) } : l)),
          }
        : prev,
    );
  }

  return (
    <main className="pb-12">
      {isTeacher && (
        <p className="flex items-center gap-2 bg-blue-soft px-5 py-2 text-sm text-blue-dark" role="status">
          <Eye size={16} strokeWidth={2} />
          תצוגת תלמיד: כך התלמידים רואים את הקבוצה. מוצגים רק שיעורים שפתחת.
          <a href={`/g/${view.group.id}`} className="ms-auto inline-flex items-center gap-1 font-medium underline">
            <ArrowRight size={14} strokeWidth={2} /> חזרה לרצף
          </a>
        </p>
      )}

      {/* כותרת בצבע הנושא של השיעור הנבחר */}
      <header className="text-white transition-colors duration-300" style={{ background: color }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm opacity-90">
              {[view.group.subjectName, view.viewer.kind === "student" ? `שלום, ${view.viewer.nickname}` : null].filter(Boolean).join(" · ")}
            </p>
            <h1 className="truncate text-3xl font-extrabold sm:text-4xl">{view.group.name}</h1>
          </div>
          {allTasks.length > 0 && (
            <div className="flex items-center gap-3">
              <Ring done={doneTasks} total={allTasks.length} color="#fff" />
              <span className="text-sm leading-tight">
                מטלות
                <br />
                שהוגשו
              </span>
            </div>
          )}
          {view.viewer.kind === "student" && (
            <a href="/s" className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm transition hover:bg-white/30">
              <ArrowRight size={16} strokeWidth={2} /> הקבוצות שלי
            </a>
          )}
        </div>

        {/* סרגל השיעורים: עיגול לכל שיעור שנפתח, בצבע הנושא שלו */}
        {ordered.length > 0 && (
          <div className="mx-auto max-w-6xl overflow-x-auto px-5 pb-5 no-scrollbar">
            <ol className="flex w-max items-stretch gap-2">
              {ordered.map((l) => {
                const topic = topicOf(l.topicId);
                const active = l.id === lesson?.id;
                const tasks = l.items.filter((i) => i.isAssignment);
                const left = tasks.filter((i) => !i.submission).length;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(l.id)}
                      aria-current={active}
                      className={`flex h-full w-36 flex-col gap-1 rounded-2xl px-3 py-2.5 text-start transition ${
                        active ? "bg-white text-ink shadow-lg" : "bg-white/15 hover:bg-white/25"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums text-white ring-2 ring-white/70"
                          style={{ background: topic?.color ?? "var(--blue)" }}
                        >
                          {l.number}
                        </span>
                        {left > 0 && (
                          <span className={`ms-auto rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${active ? "bg-orange/15 text-orange" : "bg-white/25"}`}>
                            {left} להגשה
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 text-sm font-bold leading-snug">{l.title}</span>
                      <span className={`truncate text-[0.7rem] ${active ? "text-muted" : "opacity-80"}`}>{topic?.name}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 pt-6">
        {error && (
          <p className="text-sm text-coral" role="alert">
            {error}
          </p>
        )}

        {!lesson && (
          <p className="rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center text-muted">
            {isTeacher ? "עדיין לא פתחת שיעורים לתלמידים. פותחים שיעור בכפתור העין שבראש השיעור." : "המורה עדיין לא פתחה שיעורים. חזרו לכאן אחרי השיעור הבא."}
          </p>
        )}

        {lesson && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-extrabold text-white tabular-nums" style={{ background: color }}>
                {lesson.number}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-3xl font-extrabold leading-tight">{lesson.title}</h2>
                <p className="text-sm text-muted">
                  {[topicOf(lesson.topicId)?.name, lesson.openedAt ? new Date(lesson.openedAt).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>

            {lines(lesson.goals).length > 0 && (
              <section className="rounded-3xl p-5" style={{ background: `color-mix(in srgb, ${color} 12%, white)` }}>
                <h3 className="mb-2 text-lg font-extrabold">מה נלמד</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {lines(lesson.goals).map((g, i) => (
                    <li key={i} className="flex items-start gap-2.5 rounded-2xl bg-white/80 px-3 py-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white tabular-nums" style={{ background: color }}>
                        {i + 1}
                      </span>
                      {g}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {lesson.items.length > 0 ? (
              <section className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {lesson.items.map((item, i) => (
                  // הפריט הראשון גדול: הוא בדרך כלל לב השיעור.
                  <ItemCard key={item.id} item={item} big={i === 0 && lesson.items.length > 2} onOpen={() => setOpenItem(item.id)} />
                ))}
              </section>
            ) : (
              <p className="text-muted">אין פריטים בשיעור הזה.</p>
            )}

            {lesson.boards.length > 0 && (
              <section>
                <h3 className="mb-3 text-lg font-extrabold">הלוח מהשיעור</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {lesson.boards.map((b) => (
                    <a key={b.id} href={b.image} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm transition hover:shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.image} alt={b.caption || "לוח מהשיעור"} className="w-full" />
                      {b.caption && <p className="px-4 py-2.5 text-sm text-muted">{b.caption}</p>}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {lines(lesson.recap).length > 0 && (
              <section className="rounded-3xl border border-line bg-white p-5">
                <h3 className="mb-2 text-lg font-extrabold">מה למדנו</h3>
                <ul className="flex flex-col gap-2">
                  {lines(lesson.recap).map((g, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check size={18} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color }} />
                      {g}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {lesson && viewing && (
        <Viewer
          key={viewing.id}
          item={viewing}
          isTeacher={isTeacher}
          onClose={() => setOpenItem(null)}
          onSaved={(sub) => patchSubmission(lesson.id, viewing.id, sub)}
        />
      )}
    </main>
  );
}
