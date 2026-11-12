"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Maximize,
  Minimize,
  MonitorPlay,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Timer,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { chime, clock, DrawLayer, ToolButtons, ToolWindows, useToolWindows } from "./board-lesson-tools";

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
type ModeLesson = { id: number; title: string; goals?: string; recap?: string; items: ModeItem[] };

const lines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

// בלוק נקודות שהמורה עורך במקום ("מה נלמד היום" / "אז מה למדנו"). הבקרים שקטים, כי המסך מוקרן לכיתה.
function NotesBlock({
  title,
  addLabel,
  value,
  onSave,
  large,
}: {
  title: string;
  addLabel: string;
  value: string;
  onSave: (text: string) => Promise<boolean>;
  large?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const committed = useRef(false);
  const points = lines(value);

  function start() {
    committed.current = false;
    setDraft(value);
    setFailed(false);
    setEditing(true);
  }
  // שמירה בעזיבת השדה או בכפתור; הדגל מונע שמירה כפולה.
  async function commit() {
    if (committed.current) return;
    committed.current = true;
    setEditing(false);
    if (draft.trim() === value.trim()) return;
    const ok = await onSave(draft);
    if (!ok) {
      // נכשל: חוזרים לעריכה עם הטקסט, כדי שלא יאבד.
      committed.current = false;
      setFailed(true);
      setEditing(true);
    }
  }

  if (editing)
    return (
      <div className="flex w-full flex-col gap-2 text-start">
        <p className="text-sm font-bold">{title}</p>
        <textarea
          autoFocus
          className="block min-h-28 w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-lg outline-none focus:border-blue"
          placeholder="שורה לכל נקודה"
          value={draft}
          maxLength={1500}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              committed.current = true;
              setEditing(false);
            }
          }}
          aria-label={title}
        />
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
            <Check size={16} strokeWidth={2} /> שמירה
          </button>
          {failed && <span className="text-sm text-coral">השמירה נכשלה. אפשר לנסות שוב.</span>}
        </div>
      </div>
    );

  if (points.length === 0)
    return (
      <button type="button" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted/60 transition hover:bg-white hover:text-muted focus-visible:text-muted" onClick={start}>
        <Plus size={15} strokeWidth={2} /> {addLabel}
      </button>
    );

  return (
    <div className="group flex w-full flex-col gap-2 text-start">
      <div className="flex items-center gap-2">
        <h2 className={`font-extrabold ${large ? "text-2xl" : "text-lg"}`}>{title}</h2>
        <button className="btn-icon !p-1.5 opacity-30 transition hover:opacity-100 focus-visible:opacity-100" data-tip="עריכה" aria-label={`עריכת ${title}`} onClick={start}>
          <Pencil size={15} strokeWidth={2} />
        </button>
      </div>
      <ul className={`flex list-disc flex-col gap-1.5 ps-6 marker:text-blue ${large ? "text-2xl" : "text-base"}`}>
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

// שלבי הזום של התוכן המוצג.
const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3];
const stepZoom = (cur: number, dir: 1 | -1) => {
  const at = ZOOMS.reduce((best, z, i) => (Math.abs(z - cur) < Math.abs(ZOOMS[best] - cur) ? i : best), 0);
  return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, at + dir))];
};
// בקרים צפים: לבן שקוף למחצה עם טשטוש, כדי שלא יסתירו את התוכן.
const FLOAT = "rounded-full bg-white/85 shadow-md backdrop-blur";

const MINUTES: Record<string, number> = { five: 5, quarter: 15, half: 30, lesson: 45, double: 90 };
const DURATION_LABEL: Record<string, string> = { five: "חמש דקות", quarter: "רבע שעה", half: "חצי שעה", lesson: "שיעור", double: "שני שיעורים" };
const plannedSeconds = (li: ModeItem) => (li.duration ? (MINUTES[li.duration] ?? 0) * 60 : 0);

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
  groupId,
  groupName,
  topicName,
  nextLesson,
  onClose,
}: {
  lesson: ModeLesson;
  number: number;
  color: string;
  groupId: number;
  groupName: string;
  topicName: string;
  nextLesson: { id: number; title: string } | null;
  onClose: () => void;
}) {
  const items = lesson.items;
  // ‎-1 הוא שקופית הפתיחה, ו-items.length הוא מסך הסיכום.
  const [idx, setIdx] = useState(-1);
  const [railOpen, setRailOpen] = useState(true);
  // זום לפריט הנוכחי (מתאפס במעבר), הסתרת כל הבקרים הצפים, והסתרת טיימר הפריט.
  const [zoom, setZoom] = useState(1);
  const [hidden, setHidden] = useState(false);
  const [timerHidden, setTimerHidden] = useState(false);
  const [shown, setShown] = useState<Set<number>>(() => new Set(readShown(lesson.id)));
  const [links, setLinks] = useState<Record<number, string>>({});
  // כתובת ההטמעה לכל פריט: undefined = עדיין בודקים, null = האתר לא מרשה הצגה בתוך הדף.
  const [embeds, setEmbeds] = useState<Record<number, string | null>>({});
  // כשלפריט יש הטמעה היא מוצגת מיד; "פרטי הפריט" מחליף זמנית לכרטיס הפרטים.
  const [details, setDetails] = useState(false);
  const [dark, setDark] = useState(false);
  const [goals, setGoals] = useState(lesson.goals ?? "");
  const [recap, setRecap] = useState(lesson.recap ?? "");
  const [full, setFull] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [lessonStart] = useState(() => Date.now());
  const [itemStart, setItemStart] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [moving, setMoving] = useState<"idle" | "busy" | "done" | "error">("idle");
  const toolState = useToolWindows(groupId);
  const [drawing, setDrawing] = useState(false);
  const chimedFor = useRef<number | null>(null);

  const current = idx >= 0 && idx < items.length ? items[idx] : null;
  const lessonIsNamed = !/^שיעור\s*\d*$/.test(lesson.title.trim());

  // הקישור לפריט עצמו: לפריט מחומר פתוח הוא נשלף מהפוסט, כדי שבכיתה ייפתח התוכן ולא עמוד הפוסט.
  useEffect(() => {
    let stale = false;
    for (const li of items) {
      const postId = li.item.kind === "openstuff" ? li.item.openstuffPostId : null;
      if (!postId) continue;
      fetch(`/api/warehouse/preview/${postId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { link?: string | null } | null) => {
          if (stale) return;
          // גם כשאין קישור בפוסט מסמנים שהבירור הסתיים, כדי שבדיקת ההטמעה תרוץ על כתובת הפוסט.
          setLinks((prev) => ({ ...prev, [li.item.id]: d?.link || li.item.url }));
        })
        .catch(() => !stale && setLinks((prev) => ({ ...prev, [li.item.id]: li.item.url })));
    }
    return () => {
      stale = true;
    };
  }, [items]);

  const directOf = useCallback(
    (li: ModeItem): string | null => {
      const needsLookup = li.item.kind === "openstuff" && li.item.openstuffPostId;
      return needsLookup ? (links[li.item.id] ?? null) : li.item.url;
    },
    [links],
  );

  // בדיקה אם אפשר להציג את הפריט הנוכחי בתוך הדף (ספק מוכר, או אתר שלא אוסר הטמעה).
  const direct = current ? directOf(current) : null;
  const currentItemId = current?.item.id ?? null;
  const currentLiId = current?.id ?? null;
  const currentIsImage = current?.item.kind === "image";
  useEffect(() => {
    // תמונה מוצגת ישירות, בלי בדיקת הטמעה.
    if (currentItemId == null || currentIsImage || !direct || embeds[currentItemId] !== undefined) return;
    let stale = false;
    fetch(`/api/embed?url=${encodeURIComponent(direct)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { embedUrl?: string | null } | null) => {
        if (stale) return;
        setEmbeds((prev) => ({ ...prev, [currentItemId]: d?.embedUrl ?? null }));
        // הפריט מוצג בתוך הדף מיד כשההטמעה מוכנה, ולכן הוא נחשב "הוצג".
        if (d?.embedUrl && currentLiId != null) setShown((prev) => new Set(prev).add(currentLiId));
      })
      .catch(() => !stale && setEmbeds((prev) => ({ ...prev, [currentItemId]: null })));
    return () => {
      stale = true;
    };
  }, [currentItemId, currentLiId, currentIsImage, direct, embeds]);

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
      const target = Math.max(-1, Math.min(items.length, to));
      setIdx((cur) => {
        // מעבר קדימה מסמן את הפריט שעזבנו כ"הוצג".
        if (target > cur && cur >= 0 && cur < items.length) setShown((prev) => new Set(prev).add(items[cur].id));
        return target;
      });
      // תמונה מוצגת מיד בהגעה אליה, ולכן נחשבת "הוצגה".
      const arriving = items[target];
      if (arriving && arriving.item.kind === "image") setShown((prev) => new Set(prev).add(arriving.id));
      setZoom(1);
      setDetails(false);
      setItemStart(Date.now());
      setPausedAt(null);
      chimedFor.current = null;
    },
    [items],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // במצב חושך רק Esc פעיל: הוא מחזיר את המסך ולא סוגר את מצב השיעור.
      if (dark) {
        if (e.key === "Escape") {
          e.preventDefault();
          setDark(false);
        }
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "+" || e.key === "=") setZoom((z) => stepZoom(z, 1));
        else if (e.key === "-") setZoom((z) => stepZoom(z, -1));
        else if (e.key === "0") setZoom(1);
        else if (e.key === "h" || e.key === "H" || e.key === "י") setHidden((v) => !v);
      }
      // בעברית "הבא" הוא שמאלה.
      if (e.key === "ArrowLeft" || e.key === "PageDown") {
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
  }, [go, idx, onClose, dark]);

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

  // שמירה מיידית בתצוגה; הפונקציה מחזירה אם השרת אישר.
  async function saveNotes(field: "goals" | "recap", text: string): Promise<boolean> {
    const clean = text.trim();
    if (field === "goals") setGoals(clean);
    else setRecap(clean);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: clean }),
      });
      return res.ok;
    } catch {
      return false;
    }
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

  const openUrl = current ? (direct ?? current.item.url) : "";
  const embedUrl = current ? embeds[current.item.id] : undefined;
  const embedded = Boolean(current && !currentIsImage && embedUrl && !details);
  const imageView = Boolean(current && currentIsImage && !details);
  // הפריט ממלא את הבמה (הטמעה או תמונה) ולא כרטיס פרטים.
  const onStage = embedded || imageView;
  const canDetails = Boolean(current && (embedUrl || currentIsImage));
  const detailsImage = current ? (current.item.imageUrl ?? (currentIsImage ? current.item.url : null)) : null;
  const planned = current ? plannedSeconds(current) : 0;
  const tick = pausedAt ?? now;
  const itemElapsed = Math.max(0, (tick - itemStart) / 1000);
  const remaining = planned - itemElapsed;
  const over = planned > 0 && remaining <= 0;
  const totalPlanned = items.reduce((sum, li) => sum + plannedSeconds(li) / 60, 0);

  // הזמן של הפריט נגמר: צליל עדין, פעם אחת, כתזכורת לעבור הלאה.
  useEffect(() => {
    if (current && over && pausedAt == null && chimedFor.current !== current.id) {
      chimedFor.current = current.id;
      chime();
    }
  }, [current, over, pausedAt]);

  const today = useMemo(() => new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }), []);
  const markShown = () => current && setShown((prev) => new Set(prev).add(current.id));


  // תוכן המסכים שאינם הטמעה: פתיחה, כרטיס פרטים וסיכום.
  const slideBody =
    idx === -1 ? (
      <div className="flex w-full max-w-4xl flex-col items-center gap-5 text-center">
        <p className="text-xl text-muted">
          {groupName} · {today}
        </p>
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-extrabold text-white" style={{ background: color }}>
            {number}
          </span>
          <p className="text-2xl font-bold">שיעור מספר {number}</p>
        </div>
        <h1 className="text-6xl font-extrabold leading-tight">{lessonIsNamed ? lesson.title : topicName || lesson.title}</h1>
        {topicName && lessonIsNamed && (
          <p className="rounded-full px-5 py-2 text-xl font-medium text-white" style={{ background: color }}>
            {topicName}
          </p>
        )}
        <div className="mt-2 w-full max-w-2xl">
          <NotesBlock title="מה נלמד היום" addLabel="הוספת מה נלמד היום" value={goals} onSave={(t) => saveNotes("goals", t)} large />
        </div>
        {items.length > 0 && (
          <ol className={`flex max-w-2xl flex-col gap-1.5 text-start ${lines(goals).length ? "text-sm text-muted" : "mt-2 text-lg"}`}>
            {items.slice(0, 7).map((li, i) => (
              <li key={li.id} className="flex items-baseline gap-3">
                <span className="w-6 shrink-0 text-end text-muted tabular-nums">{i + 1}</span>
                <span className="min-w-0 truncate">{li.item.title}</span>
              </li>
            ))}
            {items.length > 7 && <li className="ps-9 text-muted">ועוד {items.length - 7}</li>}
          </ol>
        )}
        <button className="btn btn-primary !px-6 !py-3 text-lg" onClick={() => go(0)}>
          מתחילים <ArrowLeft size={20} strokeWidth={2} />
        </button>
      </div>
    ) : current && embedUrl === undefined && !currentIsImage ? (
      // עדיין בודקים אם אפשר להציג בתוך הדף
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <Loader2 size={36} strokeWidth={2} className="animate-spin text-blue" />
        <h1 className="max-w-xl text-2xl font-bold">{current.item.title}</h1>
        <p className="text-sm text-muted">טוענים את הפריט…</p>
      </div>
    ) : current ? (
      <div className="flex w-full max-w-7xl flex-col items-center gap-6 md:flex-row md:items-stretch">
        {detailsImage && (
          <div className="flex w-full min-w-0 flex-1 items-center justify-center overflow-hidden rounded-3xl border border-line bg-white p-3 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detailsImage} alt="" className="max-h-[70vh] w-full rounded-2xl object-contain" draggable={false} />
          </div>
        )}
        <div className={`flex min-w-0 flex-col justify-center gap-4 ${detailsImage ? "w-full md:w-96 md:shrink-0" : "max-w-3xl flex-1"}`}>
          <p className="text-sm text-muted">{[current.item.contentType, current.phase, current.isAssignment ? "מטלת הגשה" : null].filter(Boolean).join(" · ")}</p>
          <h1 className="text-4xl font-extrabold leading-tight">{current.item.title}</h1>
          {current.note && <p className="whitespace-pre-wrap rounded-2xl border border-line bg-white p-4 text-lg leading-relaxed">{current.note}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {canDetails && (
              <button className="btn btn-primary !px-6 !py-3 text-lg" onClick={() => setDetails(false)}>
                <MonitorPlay size={20} strokeWidth={2} /> חזרה להצגה
              </button>
            )}
            <a className={`btn ${canDetails ? "btn-ghost" : "btn-primary"} !px-6 !py-3 text-lg`} href={openUrl} target="_blank" rel="noopener noreferrer" onClick={markShown}>
              <ExternalLink size={20} strokeWidth={2} /> פתיחה בלשונית
            </a>
          </div>
          {embedUrl === null && <p className="text-sm text-muted">האתר הזה לא מאפשר הצגה בתוך הדף, ולכן הוא ייפתח בלשונית נפרדת.</p>}
        </div>
      </div>
    ) : (
      <div className="flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-extrabold">סיימנו את השיעור</h1>
        <NotesBlock title="אז מה למדנו" addLabel="הוספת אז מה למדנו" value={recap} onSave={(t) => saveNotes("recap", t)} large />
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
    );

  const nextTip = idx === items.length - 1 ? "סיכום" : idx === -1 ? "מתחילים" : "הבא";
  // כשהבקרים מוסתרים החיצים נשארים, אבל עמומים עד ריחוף.
  const arrowDim = hidden ? "opacity-15 hover:opacity-100 focus-visible:opacity-100" : "";

  return (
    <div className="fixed inset-0 z-[120] flex bg-page" role="dialog" aria-label={`מצב שיעור: ${lesson.title}`}>
      {/* סרגל נשלף: פריטי השיעור לפי הסדר */}
      {railOpen && (
        <aside className="flex w-64 shrink-0 flex-col border-e border-line bg-white">
          <div className="flex items-center gap-2 p-3 pb-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: color }}>
              {number}
            </span>
            <h2 className="min-w-0 flex-1 truncate text-base font-extrabold">{lesson.title}</h2>
            <button className="btn-icon" data-tip="הסתרת הסרגל" data-tip-pos="below" aria-label="הסתרת הסרגל" onClick={() => setRailOpen(false)}>
              <PanelRightClose size={18} strokeWidth={2} />
            </button>
          </div>
          <ol className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 pb-3">
            <li>
              <button
                type="button"
                onClick={() => go(-1)}
                className={`w-full rounded-2xl border p-2 text-start text-sm font-medium transition ${
                  idx === -1 ? "border-blue bg-blue-soft" : "border-transparent text-muted hover:bg-page"
                }`}
              >
                פתיחה
              </button>
            </li>
            {items.map((li, i) => {
              const active = i === idx;
              const done = shown.has(li.id);
              const plan = plannedSeconds(li);
              // הקו מתמלא לפי הזמן שתוכנן לפריט; פריט שהוצג נשאר מלא.
              const fill = active && plan > 0 ? Math.min(1, itemElapsed / plan) : done ? 1 : 0;
              return (
                <li key={li.id}>
                  <div className={`relative overflow-hidden rounded-2xl border transition ${active ? "border-blue bg-blue-soft" : "border-transparent hover:bg-page"}`}>
                    <div className="flex items-center gap-2 p-2">
                      <button
                        type="button"
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums transition ${
                          done ? "border-green-600 bg-green-600 text-white" : "border-line bg-white text-muted hover:border-blue"
                        }`}
                        data-tip={done ? "הוצג. לחצו לביטול" : "סימון כהוצג"}
                        data-tip-edge="right"
                        aria-label={done ? "ביטול סימון הוצג" : "סימון כהוצג"}
                        aria-pressed={done}
                        onClick={() => toggleShown(li.id)}
                      >
                        {done ? <Check size={14} strokeWidth={2} /> : i + 1}
                      </button>
                      <button type="button" className="min-w-0 flex-1 text-start" onClick={() => go(i)} aria-current={active}>
                        <span className={`block truncate text-sm ${active ? "font-bold" : "font-medium"} ${done && !active ? "text-muted" : ""}`}>{li.item.title}</span>
                        <span className="block truncate text-[0.7rem] text-muted">
                          {[li.item.contentType, li.phase, li.duration ? DURATION_LABEL[li.duration] : null].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    </div>
                    {active && onStage && li.note && <p className="whitespace-pre-wrap px-3 pb-3 text-xs leading-relaxed text-muted">{li.note}</p>}
                    {plan > 0 && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-line/60" aria-hidden>
                        <div
                          className={`ms-0 h-full transition-[width] duration-1000 ease-linear ${active ? (fill >= 1 ? "bg-coral" : "bg-blue") : "bg-green-600/50"}`}
                          style={{ width: `${fill * 100}%` }}
                        />
                      </div>
                    )}
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

      {/* הבמה ממלאת את כל השטח; כל הבקרים צפים מעליה (בלי שורות בקרה) */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
        {current && embedded && embedUrl ? (
          // הדף המוטמע נטען בחלון קטן/גדול פי z ומוגדל בחזרה: בלי רווח וגלישה, כי הפינה השמאלית העליונה קבועה.
          <div className="absolute inset-0 overflow-hidden bg-white">
            <iframe
              key={embedUrl}
              className="absolute left-0 top-0 border-0 bg-white"
              style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: "top left" }}
              src={embedUrl}
              title={current.item.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
              allowFullScreen
              // התוכן המוטמע לא רשאי להחליף את הדף של מצב השיעור.
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : current && imageView ? (
          // תמונה: מוצגת על הבמה, ובזום מגדילים את התמונה בתוך אזור גלילה כדי שאפשר יהיה לגלול.
          <div className="absolute inset-0 flex overflow-auto bg-white">
            <div className="m-auto shrink-0" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.item.url} alt={current.item.title} className="h-full w-full object-contain" draggable={false} />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex overflow-auto bg-page px-6 pb-20 pt-16">
            <div className="m-auto flex w-full justify-center" style={{ zoom }}>
              {slideBody}
            </div>
          </div>
        )}

        <DrawLayer active={drawing} pageKey={`${lesson.id}:${idx}:${onStage ? "e" : "c"}`} fileName={`לוח - ${lesson.title}`} lessonId={lesson.id} />

        {/* הקודם (ימין) והבא (שמאל): חיצים עגולים באמצע הקצוות */}
        <div className="absolute right-3 top-1/2 z-30 -translate-y-1/2">
          <button
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-ink shadow-md backdrop-blur transition hover:bg-blue-soft disabled:pointer-events-none disabled:opacity-0 ${arrowDim}`}
            data-tip="הקודם"
            aria-label="הקודם"
            disabled={idx <= -1}
            onClick={() => go(idx - 1)}
          >
            <ArrowRight size={24} strokeWidth={2} />
          </button>
        </div>
        <div className="absolute left-3 top-1/2 z-30 -translate-y-1/2">
          <button
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-blue text-white shadow-md transition hover:bg-blue-dark disabled:pointer-events-none disabled:opacity-0 ${arrowDim}`}
            data-tip={nextTip}
            data-tip-edge="left"
            aria-label={nextTip}
            disabled={idx >= items.length}
            onClick={() => go(idx + 1)}
          >
            <ArrowLeft size={24} strokeWidth={2} />
          </button>
        </div>

        {/* אשכול ימני עליון: סרגל, שעון השיעור ומונה */}
        {!hidden && (
          <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
            {!railOpen && (
              <button className={`${FLOAT} btn-icon !p-2.5`} data-tip="פריטי השיעור" data-tip-pos="below" data-tip-edge="right" aria-label="הצגת הסרגל" onClick={() => setRailOpen(true)}>
                <PanelRightOpen size={18} strokeWidth={2} />
              </button>
            )}
            <span
              className={`${FLOAT} inline-flex items-center gap-2 px-3 py-1.5 text-sm tabular-nums`}
              data-tip-pos="below"
              data-tip-edge="right"
              data-tip={totalPlanned ? `זמן מתחילת השיעור. התכנון: כ־${totalPlanned} דקות` : "זמן מתחילת השיעור"}
            >
              <Timer size={15} strokeWidth={2} />
              {clock((now - lessonStart) / 1000)}
              <span className="text-muted">{current ? `${idx + 1} מתוך ${items.length}` : idx === -1 ? "פתיחה" : "סיכום"}</span>
            </span>
          </div>
        )}

        {/* אשכול שמאלי עליון: פרטים, כלים, זום, מסך מלא, סיום והסתרה */}
        <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
          {!hidden && (
            <>
              {canDetails && (
                <div className={`${FLOAT} flex items-center gap-0.5 p-1`}>
                  <button
                    className={`btn-icon !p-2 ${details ? "!bg-blue-soft !text-blue-dark" : ""}`}
                    data-tip={details ? "חזרה להצגה" : "פרטי הפריט"}
                    data-tip-pos="below"
                    aria-label={details ? "חזרה להצגה" : "פרטי הפריט"}
                    aria-pressed={details}
                    onClick={() => setDetails((v) => !v)}
                  >
                    <FileText size={18} strokeWidth={2} />
                  </button>
                  <a className="btn-icon !p-2" href={openUrl} target="_blank" rel="noopener noreferrer" data-tip="פתיחה בלשונית נפרדת" data-tip-pos="below" aria-label="פתיחה בלשונית נפרדת" onClick={markShown}>
                    <ExternalLink size={18} strokeWidth={2} />
                  </a>
                </div>
              )}
              <ToolButtons open={toolState.open} onToggle={toolState.toggle} drawing={drawing} onDraw={() => setDrawing((v) => !v)} onBlackout={() => setDark(true)} />
              <div className={`${FLOAT} flex items-center p-1`} role="group" aria-label="זום">
                <button className="btn-icon !p-2 disabled:opacity-30" data-tip="הקטנה" data-tip-pos="below" aria-label="הקטנת התוכן" disabled={zoom <= ZOOMS[0]} onClick={() => setZoom((z) => stepZoom(z, -1))}>
                  <ZoomOut size={18} strokeWidth={2} />
                </button>
                <button
                  className="min-w-12 rounded-full px-1 text-sm font-medium tabular-nums hover:bg-blue-soft"
                  data-tip="איפוס ל־100%"
                  data-tip-pos="below"
                  aria-label={`זום ${Math.round(zoom * 100)} אחוז. איפוס`}
                  onClick={() => setZoom(1)}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button className="btn-icon !p-2 disabled:opacity-30" data-tip="הגדלה" data-tip-pos="below" aria-label="הגדלת התוכן" disabled={zoom >= ZOOMS[ZOOMS.length - 1]} onClick={() => setZoom((z) => stepZoom(z, 1))}>
                  <ZoomIn size={18} strokeWidth={2} />
                </button>
              </div>
              <div className={`${FLOAT} flex items-center gap-0.5 p-1`}>
                <button className="btn-icon !p-2" data-tip={full ? "יציאה ממסך מלא" : "מסך מלא"} data-tip-pos="below" aria-label="מסך מלא" onClick={toggleFull}>
                  {full ? <Minimize size={18} strokeWidth={2} /> : <Maximize size={18} strokeWidth={2} />}
                </button>
                <button className="btn-icon !p-2" data-tip="סיום" data-tip-pos="below" aria-label="סיום מצב שיעור" onClick={onClose}>
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
            </>
          )}
          <button
            className={`${FLOAT} btn-icon !p-2.5 transition ${hidden ? "opacity-20 hover:opacity-100 focus-visible:opacity-100" : ""}`}
            data-tip={hidden ? "הצגת הכפתורים" : "הסתרת הכפתורים"}
            data-tip-pos="below"
            data-tip-edge="left"
            aria-label={hidden ? "הצגת הכפתורים" : "הסתרת הכפתורים"}
            aria-pressed={hidden}
            onClick={() => setHidden((v) => !v)}
          >
            {hidden ? <Eye size={18} strokeWidth={2} /> : <EyeOff size={18} strokeWidth={2} />}
          </button>
        </div>

        {/* טיימר הפריט: צף למטה במרכז, אפשר להסתיר */}
        {current && planned > 0 && !hidden && (
          <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2">
            {timerHidden ? (
              <button
                className={`${FLOAT} btn-icon !p-2.5 ${over ? "!text-coral" : ""}`}
                data-tip="הצגת הטיימר"
                aria-label="הצגת הטיימר"
                onClick={() => setTimerHidden(false)}
              >
                <Timer size={18} strokeWidth={2} />
              </button>
            ) : (
              <div className={`${FLOAT} flex items-center gap-1 py-1 pe-1.5 ps-4 ${over ? "ring-2 ring-coral" : ""}`}>
                <span
                  className={`text-xl font-bold tabular-nums ${over ? "text-coral" : "text-blue-dark"}`}
                  data-tip={over ? "עברנו את הזמן שתוכנן לפריט" : `נותר מתוך ${DURATION_LABEL[current.duration ?? ""] ?? ""}`}
                  role="timer"
                >
                  {clock(remaining)}
                </span>
                <button
                  className="btn-icon !p-2"
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
                  className="btn-icon !p-2"
                  data-tip="איפוס הטיימר"
                  aria-label="איפוס הטיימר"
                  onClick={() => {
                    setItemStart(Date.now());
                    setPausedAt(null);
                    chimedFor.current = null;
                  }}
                >
                  <RotateCcw size={18} strokeWidth={2} />
                </button>
                <button className="btn-icon !p-2" data-tip="הסתרת הטיימר" aria-label="הסתרת הטיימר" onClick={() => setTimerHidden(true)}>
                  <ChevronDown size={18} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        )}

        <ToolWindows state={toolState} groupId={groupId} />
      </div>

      {/* חושך: מכסה הכול עד לחיצה על הכפתור העמום או Esc. הטיימרים ממשיכים לרוץ מאחור */}
      {dark && (
        <div className="fixed inset-0 z-[300] bg-black">
          <div className="fixed bottom-3 left-3">
            <button
              type="button"
              autoFocus
              className="flex h-9 w-9 items-center justify-center rounded-full text-white opacity-15 transition hover:opacity-80 focus-visible:opacity-80"
              aria-label="החזרת המסך"
              title="החזרת המסך"
              onClick={() => setDark(false)}
            >
              <Moon size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
