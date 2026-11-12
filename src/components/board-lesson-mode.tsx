"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Maximize,
  Minimize,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RotateCcw,
  Timer,
  X,
} from "lucide-react";

type ModeItem = {
  id: number;
  note: string;
  phase: string | null;
  duration: string | null;
  isAssignment: boolean;
  item: {
    id: number;
    title: string;
    url: string;
    imageUrl: string | null;
    kind: string;
    contentType: string | null;
    siteName: string | null;
    openstuffPostId: number | null;
  };
};
type ModeLesson = { id: number; title: string; items: ModeItem[] };

const MINUTES: Record<string, number> = { five: 5, quarter: 15, half: 30, lesson: 45, double: 90 };
const DURATION_LABEL: Record<string, string> = { five: "חמש דקות", quarter: "רבע שעה", half: "חצי שעה", lesson: "שיעור", double: "שני שיעורים" };

function clock(totalSeconds: number): string {
  const s = Math.abs(Math.round(totalSeconds));
  return `${totalSeconds < 0 ? "-" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
      return m ? m[1] : null;
    }
  } catch {
    // כתובת לא תקינה פשוט לא מוטמעת.
  }
  return null;
}

function readShown(lessonId: number): number[] {
  try {
    const raw = localStorage.getItem(`rezef-shown-${lessonId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

export default function LessonMode({
  lesson,
  number,
  color,
  nextLesson,
  onClose,
}: {
  lesson: ModeLesson;
  number: number;
  color: string;
  nextLesson: { id: number; title: string } | null;
  onClose: () => void;
}) {
  const items = lesson.items;
  // idx === items.length הוא מסך הסיכום.
  const [idx, setIdx] = useState(0);
  const [railOpen, setRailOpen] = useState(true);
  const [shown, setShown] = useState<Set<number>>(() => new Set(readShown(lesson.id)));
  const [links, setLinks] = useState<Record<number, string>>({});
  const [embed, setEmbed] = useState(false);
  const [full, setFull] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [lessonStart] = useState(() => Date.now());
  const [itemStart, setItemStart] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [moving, setMoving] = useState<"idle" | "busy" | "done" | "error">("idle");

  const current = idx < items.length ? items[idx] : null;

  // הקישור לפריט עצמו: לפריט מחומר פתוח הוא נשלף מהפוסט, כדי שבכיתה ייפתח התוכן ולא עמוד הפוסט.
  useEffect(() => {
    let stale = false;
    for (const li of items) {
      const postId = li.item.kind === "openstuff" ? li.item.openstuffPostId : null;
      if (!postId) continue;
      fetch(`/api/warehouse/preview/${postId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { link?: string | null } | null) => {
          if (!stale && d?.link) setLinks((prev) => ({ ...prev, [li.item.id]: d.link as string }));
        })
        .catch(() => {});
    }
    return () => {
      stale = true;
    };
  }, [items]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(`rezef-shown-${lesson.id}`, JSON.stringify([...shown]));
    } catch {
      // בלי אחסון מקומי הסימון פשוט לא נשמר בין פתיחות.
    }
  }, [shown, lesson.id]);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    // הלחיצה שפתחה את מצב השיעור עדיין "טרייה", ולכן אפשר לבקש מסך מלא מיד.
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const go = useCallback(
    (to: number) => {
      const target = Math.max(0, Math.min(items.length, to));
      setIdx((cur) => {
        // מעבר קדימה מסמן את הפריט שעזבנו כ"הוצג".
        if (target > cur && cur < items.length) setShown((prev) => new Set(prev).add(items[cur].id));
        return target;
      });
      setEmbed(false);
      setItemStart(Date.now());
      setPausedAt(null);
    },
    [items],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      // בעברית "הבא" הוא שמאלה.
      if (e.key === "ArrowLeft" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(idx + 1);
      } else if (e.key === "ArrowRight" || e.key === "PageUp") {
        e.preventDefault();
        go(idx - 1);
      } else if (e.key === "Escape" && !document.fullscreenElement) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, idx, onClose]);

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function toggleShown(id: number) {
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const leftovers = useMemo(() => items.filter((li) => !shown.has(li.id)), [items, shown]);

  async function moveLeftovers() {
    if (!nextLesson) return;
    setMoving("busy");
    try {
      // לפי הסדר, לראש השיעור הבא.
      for (let i = 0; i < leftovers.length; i++) {
        const res = await fetch(`/api/lesson-items/${leftovers[i].id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ move: { lessonId: nextLesson.id, index: i } }),
        });
        if (!res.ok) throw new Error();
      }
      setMoving("done");
    } catch {
      setMoving("error");
    }
  }

  const direct = current ? (links[current.item.id] ?? current.item.url) : "";
  const yt = current ? youtubeId(direct) : null;
  const planned = current?.duration ? (MINUTES[current.duration] ?? 0) * 60 : 0;
  const tick = pausedAt ?? now;
  const itemElapsed = Math.max(0, (tick - itemStart) / 1000);
  const remaining = planned - itemElapsed;
  const over = planned > 0 && remaining < 0;
  const totalPlanned = items.reduce((sum, li) => sum + (li.duration ? (MINUTES[li.duration] ?? 0) : 0), 0);

  return (
    <div className="fixed inset-0 z-[120] flex bg-page" role="dialog" aria-label={`מצב שיעור: ${lesson.title}`}>
      {/* סרגל נשלף: פריטי השיעור לפי הסדר */}
      {railOpen && (
        <aside className="flex w-80 shrink-0 flex-col border-e border-line bg-white">
          <div className="flex items-center gap-2 p-4 pb-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: color }}>
              {number}
            </span>
            <h2 className="min-w-0 flex-1 truncate text-lg font-extrabold">{lesson.title}</h2>
            <button className="btn-icon" data-tip="הסתרת הסרגל" aria-label="הסתרת הסרגל" onClick={() => setRailOpen(false)}>
              <PanelRightClose size={18} strokeWidth={2} />
            </button>
          </div>
          <ol className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
            {items.map((li, i) => {
              const active = i === idx;
              const done = shown.has(li.id);
              return (
                <li key={li.id}>
                  <div
                    className={`flex items-center gap-2 rounded-2xl border p-2 transition ${
                      active ? "border-blue bg-blue-soft" : "border-transparent hover:bg-page"
                    }`}
                  >
                    <button
                      type="button"
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums transition ${
                        done ? "border-green-600 bg-green-600 text-white" : "border-line bg-white text-muted hover:border-blue"
                      }`}
                      data-tip={done ? "הוצג. לחצו לביטול" : "סימון כהוצג"}
                      aria-label={done ? "ביטול סימון הוצג" : "סימון כהוצג"}
                      aria-pressed={done}
                      onClick={() => toggleShown(li.id)}
                    >
                      {done ? <Check size={14} strokeWidth={2} /> : i + 1}
                    </button>
                    <button type="button" className="min-w-0 flex-1 text-start" onClick={() => go(i)} aria-current={active}>
                      <span className={`block truncate text-sm ${active ? "font-bold" : "font-medium"} ${done && !active ? "text-muted" : ""}`}>
                        {li.item.title}
                      </span>
                      <span className="block truncate text-[0.7rem] text-muted">
                        {[li.item.contentType, li.phase, li.duration ? DURATION_LABEL[li.duration] : null].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => go(items.length)}
                className={`w-full rounded-2xl border p-2 text-start text-sm font-medium transition ${
                  idx === items.length ? "border-blue bg-blue-soft" : "border-transparent text-muted hover:bg-page"
                }`}
              >
                סיכום השיעור
              </button>
            </li>
          </ol>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* שורת בקרה */}
        <div className="flex items-center gap-2 px-5 py-3">
          {!railOpen && (
            <button className="btn-icon bg-white border border-line" data-tip="פריטי השיעור" aria-label="הצגת הסרגל" onClick={() => setRailOpen(true)}>
              <PanelRightOpen size={18} strokeWidth={2} />
            </button>
          )}
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-white border border-line px-3 py-1.5 text-sm tabular-nums"
            data-tip={totalPlanned ? `זמן מתחילת השיעור. התכנון: כ־${totalPlanned} דקות` : "זמן מתחילת השיעור"}
          >
            <Timer size={15} strokeWidth={2} />
            {clock((now - lessonStart) / 1000)}
          </span>
          <span className="text-sm text-muted tabular-nums">
            {current ? `${idx + 1} מתוך ${items.length}` : "סיכום"}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <button className="btn-icon bg-white border border-line" data-tip={full ? "יציאה ממסך מלא" : "מסך מלא"} aria-label="מסך מלא" onClick={toggleFull}>
              {full ? <Minimize size={18} strokeWidth={2} /> : <Maximize size={18} strokeWidth={2} />}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              <X size={16} strokeWidth={2} /> סיום
            </button>
          </div>
        </div>

        {/* הבמה */}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 pb-4">
          {current ? (
            embed && yt ? (
              <div className="aspect-video w-full max-w-6xl overflow-hidden rounded-3xl bg-ink shadow-xl">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0&autoplay=1`}
                  title={current.item.title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex w-full max-w-5xl flex-col items-center gap-6 md:flex-row md:items-stretch">
                {current.item.imageUrl && (
                  <div className="w-full max-w-md shrink-0 overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={current.item.imageUrl} alt="" className="h-full max-h-[50vh] w-full object-cover" draggable={false} />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-4">
                  <p className="text-sm text-muted">
                    {[current.item.contentType, current.phase, current.isAssignment ? "מטלת הגשה" : null].filter(Boolean).join(" · ")}
                  </p>
                  <h1 className="text-4xl font-extrabold leading-tight">{current.item.title}</h1>
                  {current.note && <p className="whitespace-pre-wrap rounded-2xl bg-white border border-line p-4 text-lg leading-relaxed">{current.note}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      className="btn btn-primary !px-6 !py-3 text-lg"
                      href={direct}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShown((prev) => new Set(prev).add(current.id))}
                    >
                      <ExternalLink size={20} strokeWidth={2} /> פתיחה
                    </a>
                    {yt && (
                      <button
                        className="btn btn-ghost !px-5 !py-3 text-lg"
                        onClick={() => {
                          setEmbed(true);
                          setShown((prev) => new Set(prev).add(current.id));
                        }}
                      >
                        <Play size={20} strokeWidth={2} /> הצגה כאן
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
              <h1 className="text-3xl font-extrabold">סיימנו את השיעור</h1>
              <p className="text-muted tabular-nums">
                הוצגו {items.length - leftovers.length} מתוך {items.length} פריטים, ב־{clock((now - lessonStart) / 1000)} דקות.
              </p>
              {leftovers.length > 0 && (
                <div className="flex flex-col gap-2 text-start">
                  <p className="text-sm font-medium">לא הספקנו:</p>
                  <ul className="flex flex-col gap-1">
                    {leftovers.map((li) => (
                      <li key={li.id} className="truncate rounded-xl bg-page px-3 py-2 text-sm">
                        {li.item.title}
                      </li>
                    ))}
                  </ul>
                  {nextLesson && moving !== "done" && (
                    <button className="btn btn-primary justify-center" disabled={moving === "busy"} onClick={moveLeftovers}>
                      <ArrowLeft size={16} strokeWidth={2} />
                      {moving === "busy" ? "מעבירים…" : `העברה לשיעור הבא: ${nextLesson.title}`}
                    </button>
                  )}
                  {moving === "done" && <p className="text-sm text-green-700">הפריטים עברו לשיעור הבא.</p>}
                  {moving === "error" && <p className="text-sm text-coral">ההעברה נכשלה. אפשר לגרור אותם בלוח.</p>}
                </div>
              )}
              <button className="btn btn-ghost justify-center" onClick={onClose}>
                חזרה לרצף
              </button>
            </div>
          )}
        </div>

        {/* ניווט וטיימר הפריט */}
        <div className="flex items-center gap-3 border-t border-line bg-white px-5 py-3">
          <button className="btn btn-ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>
            <ArrowRight size={18} strokeWidth={2} /> הקודם
          </button>

          <div className="mx-auto flex items-center gap-2">
            {current && planned > 0 && (
              <>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xl font-bold tabular-nums ${
                    over ? "bg-coral/10 text-coral" : "bg-blue-soft text-blue-dark"
                  }`}
                  data-tip={over ? "עברנו את הזמן שתוכנן לפריט" : `נותר מתוך ${DURATION_LABEL[current.duration ?? ""] ?? ""}`}
                  role="timer"
                >
                  {clock(remaining)}
                </span>
                <button
                  className="btn-icon"
                  data-tip={pausedAt ? "המשך" : "השהיה"}
                  aria-label={pausedAt ? "המשך הטיימר" : "השהיית הטיימר"}
                  onClick={() => {
                    if (pausedAt) {
                      setItemStart((s) => s + (Date.now() - pausedAt));
                      setPausedAt(null);
                    } else setPausedAt(Date.now());
                  }}
                >
                  {pausedAt ? <Play size={18} strokeWidth={2} /> : <Pause size={18} strokeWidth={2} />}
                </button>
                <button
                  className="btn-icon"
                  data-tip="איפוס הטיימר"
                  aria-label="איפוס הטיימר"
                  onClick={() => {
                    setItemStart(Date.now());
                    setPausedAt(null);
                  }}
                >
                  <RotateCcw size={18} strokeWidth={2} />
                </button>
              </>
            )}
            {embed && (
              <button className="btn btn-ghost" onClick={() => setEmbed(false)}>
                חזרה לפרטי הפריט
              </button>
            )}
          </div>

          <button className="btn btn-primary" disabled={idx >= items.length} onClick={() => go(idx + 1)}>
            {idx === items.length - 1 ? "סיכום" : "הבא"} <ArrowLeft size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
