"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  Check,
  Copy,
  FileText,
  Gamepad2,
  GripVertical,
  Link2,
  Paperclip,
  Pin,
  Play,
  Plus,
  Presentation,
  StickyNote,
  X,
} from "lucide-react";

type Item = {
  id: number;
  url: string;
  title: string;
  imageUrl: string | null;
  siteName: string | null;
  kind: string;
  meta: { classes?: string[]; subjects?: string[]; author?: string };
};
type LessonItem = {
  id: number;
  lessonId: number;
  phase: string | null;
  note: string;
  isAssignment: boolean;
  item: Item;
};
type Lesson = { id: number; title: string; items: LessonItem[] };
type CrossItem = { id: number; note: string; item: Item };
type BoardData = {
  group: { id: number; name: string; className: string | null; subjectName: string | null; joinCode: string };
  lessons: Lesson[];
  crossItems: CrossItem[];
};

const PHASES = ["הקניה", "תרגול", "הערכה", "רקע", "העשרה"] as const;

const KIND_ICON: Record<string, typeof Link2> = {
  openstuff: BookOpen,
  youtube: Play,
  video: Play,
  slides: Presentation,
  doc: FileText,
  file: Paperclip,
  game: Gamepad2,
  link: Link2,
};

const KIND_LABEL: Record<string, string> = {
  openstuff: "חומר פתוח",
  youtube: "סרטון",
  video: "סרטון",
  slides: "מצגת",
  doc: "מסמך",
  file: "קובץ",
  game: "משחק",
  link: "קישור",
};

function extractUrls(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s));
}

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "שגיאה");
  return res.json();
}

function Thumb({ item }: { item: Item }) {
  const Icon = KIND_ICON[item.kind] ?? Link2;
  return item.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
  ) : (
    <div className="h-full w-full flex items-center justify-center bg-blue-soft text-blue">
      <Icon size={26} strokeWidth={2} />
    </div>
  );
}

function ItemCard({
  li,
  onChange,
  onDelete,
}: {
  li: LessonItem;
  onChange: (patch: Partial<Pick<LessonItem, "phase" | "note" | "isAssignment">>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `li-${li.id}` });
  const [noteOpen, setNoteOpen] = useState(li.note.length > 0);
  const [note, setNote] = useState(li.note);
  const tags = [...(li.item.meta.classes ?? []).slice(0, 3).map((c) => `כיתה ${c}`), ...(li.item.meta.subjects ?? []).slice(0, 2)];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm"
    >
      <div className="flex gap-3 p-3">
        <button
          className="btn-icon cursor-grab touch-none self-start"
          data-tip="גרירה"
          aria-label="גרירה"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} strokeWidth={2} />
        </button>
        <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden">
          <Thumb item={li.item} />
        </div>
        <div className="min-w-0 flex-1">
          <a href={li.item.url} target="_blank" rel="noreferrer" className="block font-medium leading-snug line-clamp-2 hover:text-blue-dark">
            {li.item.title}
          </a>
          <p className="text-xs text-muted mt-0.5">
            {KIND_LABEL[li.item.kind] ?? "קישור"}
            {li.item.siteName ? ` · ${li.item.siteName}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            className={`btn-icon ${li.isAssignment ? "!text-orange !bg-orange/10" : ""}`}
            data-tip={li.isAssignment ? "מטלת הגשה" : "סימון כמטלת הגשה"}
            aria-label="מטלת הגשה"
            onClick={() => onChange({ isAssignment: !li.isAssignment })}
          >
            <Pin size={16} strokeWidth={2} />
          </button>
          <button className="btn-icon" data-tip="הסרה" aria-label="הסרה" onClick={onDelete}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
        <select
          value={li.phase ?? ""}
          onChange={(e) => onChange({ phase: e.target.value || null })}
          className="rounded-full border border-line bg-page text-xs px-2.5 py-1 outline-none focus:border-blue"
          aria-label="שלב בשיעור"
        >
          <option value="">שלב בשיעור</option>
          {PHASES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        {tags.map((t) => (
          <span key={t} className="rounded-full bg-blue-soft text-blue-dark text-xs px-2.5 py-1">
            {t}
          </span>
        ))}
        <button className="btn-icon ms-auto" data-tip="הערה" aria-label="הערה" onClick={() => setNoteOpen((v) => !v)}>
          <StickyNote size={16} strokeWidth={2} />
        </button>
      </div>

      {noteOpen && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== li.note && onChange({ note })}
          placeholder="איך אשתמש בזה בשיעור?"
          rows={2}
          className="block w-full border-t border-line bg-page/60 px-4 py-2.5 text-sm outline-none resize-none"
        />
      )}
    </div>
  );
}

function PasteZone({ onUrls, busy, compact }: { onUrls: (urls: string[]) => void; busy: boolean; compact?: boolean }) {
  const [value, setValue] = useState("");
  function submit(text: string) {
    const urls = extractUrls(text);
    if (urls.length) {
      onUrls(urls);
      setValue("");
    }
  }
  return (
    <div className={`rounded-2xl border border-dashed border-blue/50 bg-blue-soft/50 ${compact ? "p-2" : "p-3"}`}>
      <input
        className="w-full bg-transparent outline-none text-sm placeholder:text-blue-dark/70 text-center"
        placeholder={busy ? "מוסיפים…" : "הדביקו קישור, או כמה קישורים"}
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (extractUrls(text).length) {
            e.preventDefault();
            submit(text);
          }
        }}
        onKeyDown={(e) => e.key === "Enter" && submit(value)}
        aria-label="הדבקת קישורים"
      />
    </div>
  );
}

function LessonColumn({
  lesson,
  index,
  active,
  busy,
  onActivate,
  onAddUrls,
  onRename,
  onItemChange,
  onItemDelete,
}: {
  lesson: Lesson;
  index: number;
  active: boolean;
  busy: boolean;
  onActivate: () => void;
  onAddUrls: (urls: string[]) => void;
  onRename: (title: string) => void;
  onItemChange: (id: number, patch: Partial<Pick<LessonItem, "phase" | "note" | "isAssignment">>) => void;
  onItemDelete: (id: number) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `lesson-${lesson.id}` });
  const [title, setTitle] = useState(lesson.title);
  return (
    <section
      ref={setNodeRef}
      onPointerEnter={onActivate}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const text = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
        const urls = extractUrls(text);
        if (urls.length) {
          e.preventDefault();
          onAddUrls(urls);
        }
      }}
      className={`w-[22rem] shrink-0 rounded-3xl bg-white/70 border p-4 flex flex-col gap-3 transition ${
        active ? "border-blue shadow-md" : "border-line"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-full bg-blue text-white text-sm font-bold flex items-center justify-center">{index + 1}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== lesson.title && onRename(title)}
          className="flex-1 bg-transparent font-bold text-lg outline-none"
          aria-label="שם השיעור"
        />
      </div>

      <SortableContext items={lesson.items.map((li) => `li-${li.id}`)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3 min-h-8">
          {lesson.items.map((li) => (
            <ItemCard key={li.id} li={li} onChange={(p) => onItemChange(li.id, p)} onDelete={() => onItemDelete(li.id)} />
          ))}
        </div>
      </SortableContext>

      <PasteZone onUrls={onAddUrls} busy={busy} />
    </section>
  );
}

export default function Board({ groupId }: { groupId: number }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeLesson, setActiveLesson] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const activeRef = useRef<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => {
    try {
      setData(await api(`/api/groups/${groupId}/board`, "GET"));
    } catch {
      setError("לא הצלחנו לטעון את הרצף");
    }
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    activeRef.current = activeLesson;
  }, [activeLesson]);

  const addUrls = useCallback(
    async (lessonId: number, urls: string[]) => {
      setBusy(true);
      setError("");
      try {
        await api(`/api/lessons/${lessonId}/links`, "POST", { urls });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  // הדבקה בכל מקום בעמוד (מחוץ לשדה טקסט) נתלית על השיעור שהעכבר עומד מעליו.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const urls = extractUrls(e.clipboardData?.getData("text") ?? "");
      const target = activeRef.current;
      if (urls.length && target) {
        e.preventDefault();
        addUrls(target, urls);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addUrls]);

  async function onDragEnd(e: DragEndEvent) {
    if (!data || !e.over) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    if (!activeId.startsWith("li-") || activeId === overId) return;
    const itemId = Number(activeId.slice(3));

    let toLessonId: number;
    let toIndex: number;
    if (overId.startsWith("lesson-")) {
      toLessonId = Number(overId.slice(7));
      toIndex = data.lessons.find((l) => l.id === toLessonId)?.items.length ?? 0;
    } else {
      const overLi = Number(overId.slice(3));
      const lesson = data.lessons.find((l) => l.items.some((x) => x.id === overLi));
      if (!lesson) return;
      toLessonId = lesson.id;
      toIndex = lesson.items.findIndex((x) => x.id === overLi);
    }

    // עדכון מיידי במסך, ואז סנכרון מול השרת.
    setData((prev) => {
      if (!prev) return prev;
      const moving = prev.lessons.flatMap((l) => l.items).find((x) => x.id === itemId);
      if (!moving) return prev;
      const lessons = prev.lessons.map((l) => ({ ...l, items: l.items.filter((x) => x.id !== itemId) }));
      const target = lessons.find((l) => l.id === toLessonId);
      if (target) target.items.splice(Math.min(toIndex, target.items.length), 0, { ...moving, lessonId: toLessonId });
      return { ...prev, lessons };
    });
    try {
      await api(`/api/lesson-items/${itemId}`, "PATCH", { move: { lessonId: toLessonId, index: toIndex } });
    } catch {
      setError("ההעברה נכשלה");
    }
    await load();
  }

  async function itemChange(id: number, patch: Partial<Pick<LessonItem, "phase" | "note" | "isAssignment">>) {
    setData((prev) =>
      prev
        ? { ...prev, lessons: prev.lessons.map((l) => ({ ...l, items: l.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) })) }
        : prev,
    );
    try {
      await api(`/api/lesson-items/${id}`, "PATCH", patch);
    } catch {
      setError("השמירה נכשלה");
      await load();
    }
  }

  async function itemDelete(id: number) {
    try {
      await api(`/api/lesson-items/${id}`, "DELETE");
    } finally {
      await load();
    }
  }

  async function addLesson() {
    await api(`/api/groups/${groupId}/lessons`, "POST", {});
    await load();
  }

  async function addCross(urls: string[]) {
    setBusy(true);
    try {
      await api(`/api/groups/${groupId}/cross`, "POST", { urls });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  async function removeCross(id: number) {
    await api(`/api/cross/${id}`, "DELETE");
    await load();
  }

  if (!data) return <div className="p-10 text-muted">{error || "טוענים…"}</div>;

  const { group } = data;
  return (
    <div className="px-5 py-8">
      <div className="mx-auto max-w-7xl mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{group.name}</h1>
        {group.className && <span className="rounded-full bg-blue-soft text-blue-dark px-3 py-1 text-sm">כיתה {group.className}</span>}
        {group.subjectName && <span className="rounded-full bg-blue-soft text-blue-dark px-3 py-1 text-sm">{group.subjectName}</span>}
        <button
          className="btn btn-ghost ms-auto"
          data-tip="הקוד שהתלמידים יזינו כדי להצטרף"
          onClick={() => {
            navigator.clipboard?.writeText(group.joinCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={2} />}
          <span dir="ltr" className="font-mono tracking-widest">
            {group.joinCode}
          </span>
        </button>
      </div>

      {error && <p className="mx-auto max-w-7xl text-coral mb-3">{error}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-5 items-start w-max mx-auto min-w-full px-1 pt-5 relative">
            <div className="absolute top-2 inset-x-0 border-t-2 border-dashed border-blue/40" aria-hidden />
            {data.lessons.map((l, i) => (
              <LessonColumn
                key={l.id}
                lesson={l}
                index={i}
                active={activeLesson === l.id}
                busy={busy}
                onActivate={() => setActiveLesson(l.id)}
                onAddUrls={(urls) => addUrls(l.id, urls)}
                onRename={(title) => api(`/api/lessons/${l.id}`, "PATCH", { title }).then(load)}
                onItemChange={itemChange}
                onItemDelete={itemDelete}
              />
            ))}
            <button className="btn btn-ghost shrink-0 self-start mt-1" onClick={addLesson}>
              <Plus size={18} strokeWidth={2} /> שיעור
            </button>
          </div>
        </div>
      </DndContext>

      <section className="mx-auto max-w-7xl mt-10">
        <h2 className="text-xl font-bold mb-1" data-tip="תכנון יחידה, תרגיל חוזר, בוחן קבוע: דברים שלא שייכים לשיעור אחד">
          פריטים רוחביים
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.crossItems.map((c) => (
            <div key={c.id} className="bg-white border border-line rounded-2xl p-3 flex gap-3 items-center">
              <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0">
                <Thumb item={c.item} />
              </div>
              <a href={c.item.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 font-medium line-clamp-2 hover:text-blue-dark">
                {c.item.title}
              </a>
              <button className="btn-icon" data-tip="הסרה" aria-label="הסרה" onClick={() => removeCross(c.id)}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          ))}
          <PasteZone onUrls={addCross} busy={busy} compact />
        </div>
      </section>
    </div>
  );
}
