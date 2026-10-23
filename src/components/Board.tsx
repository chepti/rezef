"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  closestCorners,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TopicBar, { type Topic } from "./board-topics";
import Rope from "./board-rope";
import PublishDialog, { type Terms } from "./board-publish";
import PublishLessonDialog from "./board-publish-lesson";
import GroupSettings from "./board-settings";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Copy,
  GripVertical,
  Layers,
  Dumbbell,
  File as FileGeneric,
  FileText,
  Gamepad2,
  LayoutTemplate,
  Lightbulb,
  Library,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Presentation,
  Printer,
  Send,
  Settings2,
  Share2,
  Smartphone,
  Sparkles,
  StickyNote,
  Video,
  X,
} from "lucide-react";

type Item = {
  id: number;
  url: string;
  title: string;
  imageUrl: string | null;
  siteName: string | null;
  kind: string;
  contentType: string | null;
  publishedPostId: number | null;
  meta: { classes?: string[]; subjects?: string[]; author?: string };
};
type LessonItem = {
  id: number;
  lessonId: number;
  itemId: number;
  phase: string | null;
  note: string;
  isAssignment: boolean;
  duration: string | null;
  shareNote: boolean;
  item: Item;
};
type Lesson = { id: number; title: string; topicId: number | null; publishedCollectionUrl: string | null; items: LessonItem[] };
type CrossItem = { id: number; note: string; topicId: number | null; duration: string | null; item: Item };
type BoardData = {
  group: { id: number; name: string; className: string | null; subjectName: string | null; tags: string[]; joinCode: string };
  sequence: { id: number; currentTopicId: number | null };
  topics: Topic[];
  lessons: Lesson[];
  crossItems: CrossItem[];
};
type ItemPatch = Partial<Pick<LessonItem, "phase" | "note" | "isAssignment" | "duration" | "shareNote">>;

// מה שנגרר מהמחסן: קישור מחומר פתוח (ייווצר פריט) או פריט קיים של המורה.
type WhCard =
  | { kind: "os"; key: string; url: string; title: string; imageUrl: string | null; contentType: string | null; tags: string[] }
  | { kind: "item"; key: string; itemId: number; url: string; title: string; imageUrl: string | null; contentType: string | null; tags: string[]; placed: number };

const PHASES = [
  { name: "הקניה", icon: Lightbulb },
  { name: "תרגול", icon: Dumbbell },
  { name: "הערכה", icon: ClipboardCheck },
  { name: "רקע", icon: Library },
  { name: "העשרה", icon: Sparkles },
] as const;
// אותה סקאלה ואותם אייקונים כמו "כמה זמן" בטופס ההעלאה של חומר פתוח.
const DURATIONS = [
  { key: "five", label: "חמש דקות", minutes: 5 },
  { key: "quarter", label: "רבע שעה", minutes: 15 },
  { key: "half", label: "חצי שעה", minutes: 30 },
  { key: "lesson", label: "שיעור", minutes: 45 },
  { key: "double", label: "שני שיעורים", minutes: 90 },
  { key: "unit", label: "יחידה ארוכה", minutes: 0 },
] as const;
// "יחידה ארוכה" נפרשת על כמה מפגשים, ולכן מתאימה רק לקישורים הכלליים ולא לפריט בתוך שיעור.
const LESSON_DURATIONS = DURATIONS.filter((d) => d.key !== "unit");

const WEDGES: Record<string, string> = {
  five: "M12 12 L12 5.8 A6.2 6.2 0 0 1 15.1 6.63 Z",
  quarter: "M12 12 L12 5.8 A6.2 6.2 0 0 1 18.2 12 Z",
  half: "M12 12 L12 5.8 A6.2 6.2 0 0 1 12 18.2 Z",
  lesson: "M12 12 L12 5.8 A6.2 6.2 0 1 1 5.8 12 Z",
};

function DurationIcon({ kind, size = 16 }: { kind: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (WEDGES[kind]) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path fill="currentColor" stroke="none" d={WEDGES[kind]} />
      </svg>
    );
  }
  if (kind === "double") {
    return (
      <svg {...common}>
        <path d="M5 22h14" />
        <path d="M5 2h14" />
        <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
        <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
    </svg>
  );
}

// הסימן של חומר פתוח (הסלסול והנקודה מהלוגו), ולא ספר פתוח שנקרא בהמון דרכים אחרות.
function OpenstuffMark({ size = 16 }: { size?: number; strokeWidth?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/openstuff-mark.png" alt="" width={size + 4} height={size + 4} draggable={false} className="shrink-0" />
  );
}

// סוג התוכן הוא הקטגוריות של חומר פתוח, עם אותם אייקונים שהאתר משתמש בהם בכרטיסים.
const CONTENT_TYPES = [
  { name: "סרטון", icon: Video },
  { name: "מצגת", icon: Presentation },
  { name: "להדפסה", icon: Printer },
  { name: "מערך שיעור", icon: FileText },
  { name: "פעילות", icon: Gamepad2 },
  { name: "כלי דיגיטלי", icon: Smartphone },
  { name: "תבנית", icon: LayoutTemplate },
  { name: "אחר", icon: FileGeneric },
] as const;
const TYPE_ICON: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = Object.fromEntries(
  CONTENT_TYPES.map((t) => [t.name, t.icon]),
);
// ניחוש כשעוד אין סוג שמור (קישור חיצוני חדש, או פריט לפני המילוי הראשוני).
const KIND_TO_TYPE: Record<string, string> = {
  youtube: "סרטון",
  video: "סרטון",
  slides: "מצגת",
  doc: "מערך שיעור",
  file: "להדפסה",
  game: "פעילות",
};
function typeOf(item: { kind: string; contentType?: string | null }): string {
  return item.contentType ?? KIND_TO_TYPE[item.kind] ?? "אחר";
}

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
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    // תשובה בלי JSON (למשל 502 בזמן שהשרת מתעדכן) מקבלת הסבר, ולא "שגיאה" סתמית.
    throw new Error(data?.error ?? (res.status >= 500 ? "השרת לא ענה כרגע. נסו שוב בעוד רגע" : "שגיאה"));
  }
  return res.json();
}

// הדבקה של הרבה קישורים נשלחת בקבוצות, כדי שלא תיפול על מגבלת הבקשה ולא תיתקע על קישור איטי.
const URL_CHUNK = 20;
function chunk<T>(arr: T[], size = URL_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function itemTags(item: Item): string[] {
  return [...(item.meta.classes ?? []).slice(0, 3).map((c) => `כיתה ${c}`), ...(item.meta.subjects ?? []).slice(0, 2)];
}

function Thumb({ item, size }: { item: { imageUrl: string | null; kind: string; contentType?: string | null }; size: number }) {
  const Icon = TYPE_ICON[typeOf(item)] ?? FileGeneric;
  return (
    <div className="shrink-0 rounded-lg overflow-hidden bg-blue-soft" style={{ width: size, height: size }}>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" draggable={false} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-blue">
          <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
        </div>
      )}
    </div>
  );
}

/* ---------- רצועת פריט בשיעור ---------- */

function ItemRow({
  li,
  expanded,
  onChange,
  onDelete,
  onPublish,
  onType,
}: {
  li: LessonItem;
  expanded: boolean;
  onChange: (patch: ItemPatch) => void;
  onDelete: () => void;
  onPublish: () => void;
  onType: (type: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `li-${li.id}` });
  const [note, setNote] = useState(li.note);
  const itemType = typeOf(li.item);
  const TypeIcon = TYPE_ICON[itemType] ?? FileGeneric;
  const phase = PHASES.find((p) => p.name === li.phase);
  const PhaseIcon = phase?.icon;
  const duration = DURATIONS.find((d) => d.key === li.duration);
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className={`bg-white border rounded-xl ${expanded ? "border-line shadow-sm" : "border-line/70"}`}
    >
      <div className="flex items-center gap-2.5 p-1.5 cursor-grab touch-none" {...attributes} {...listeners}>
        <Thumb item={li.item} size={expanded ? 44 : 34} />
        <a
          href={li.item.url}
          target="_blank"
          rel="noreferrer"
          draggable={false}
          className={`min-w-0 flex-1 font-medium leading-snug hover:text-blue-dark ${expanded ? "line-clamp-2 text-[0.95rem]" : "truncate text-sm"}`}
        >
          {li.item.title}
        </a>
        <div className="flex items-center gap-1.5 text-muted shrink-0 pe-1">
          {duration && (
            <span className="text-orange" data-tip={duration.label}>
              <DurationIcon kind={duration.key} size={15} />
            </span>
          )}
          {li.isAssignment && (
            <span className="text-orange" data-tip="מטלת הגשה">
              <Pin size={14} strokeWidth={2} />
            </span>
          )}
          {li.note && !expanded && (
            <span data-tip="יש הערה">
              <StickyNote size={14} strokeWidth={2} />
            </span>
          )}
          {PhaseIcon && (
            <span className="text-blue-dark" data-tip={li.phase ?? ""}>
              <PhaseIcon size={15} strokeWidth={2} />
            </span>
          )}
          <span className="text-ink" data-tip={itemType}>
            <TypeIcon size={15} strokeWidth={2} />
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-2" onPointerDown={stop}>
          <div className="flex flex-wrap items-center gap-1">
            {CONTENT_TYPES.filter((t) => t.name !== "תבנית").map((t) => (
              <button
                key={t.name}
                className={`btn-icon !p-1.5 ${itemType === t.name ? "!bg-ink !text-white" : ""}`}
                data-tip={t.name}
                aria-label={`סוג: ${t.name}`}
                aria-pressed={itemType === t.name}
                onClick={() => onType(t.name)}
              >
                <t.icon size={16} strokeWidth={2} />
              </button>
            ))}
            <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-page px-2.5 py-0.5 text-[0.7rem] text-muted" data-tip="מאיפה הפריט">
              {li.item.kind === "openstuff" ? <OpenstuffMark size={12} /> : <Link2 size={12} strokeWidth={2} />}
              {li.item.kind === "openstuff" ? "חומר פתוח" : (li.item.siteName ?? "קישור חיצוני")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {PHASES.map((p) => (
              <button
                key={p.name}
                className={`btn-icon !p-1.5 ${li.phase === p.name ? "!bg-blue-soft !text-blue-dark" : ""}`}
                data-tip={p.name}
                aria-label={p.name}
                onClick={() => onChange({ phase: li.phase === p.name ? null : p.name })}
              >
                <p.icon size={16} strokeWidth={2} />
              </button>
            ))}
            <span className="w-px h-5 bg-line mx-1" aria-hidden />
            <button
              className={`btn-icon !p-1.5 ${li.isAssignment ? "!bg-orange/10 !text-orange" : ""}`}
              data-tip={li.isAssignment ? "מטלת הגשה" : "סימון כמטלת הגשה"}
              aria-label="מטלת הגשה"
              onClick={() => onChange({ isAssignment: !li.isAssignment })}
            >
              <Pin size={16} strokeWidth={2} />
            </button>
            {li.item.kind !== "openstuff" &&
              (li.item.publishedPostId ? (
                <span className="btn-icon !p-1.5 !text-green-600" data-tip="נשלח לחומר פתוח וממתין לאישור">
                  <Check size={16} strokeWidth={2} />
                </span>
              ) : (
                <button className="btn-icon !p-1.5" data-tip="פרסום בחומר פתוח" aria-label="פרסום בחומר פתוח" onClick={onPublish}>
                  <Send size={16} strokeWidth={2} />
                </button>
              ))}
            <button className="btn-icon !p-1.5 ms-auto" data-tip="הסרה מהשיעור" aria-label="הסרה" onClick={onDelete}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="text-muted me-1" data-tip="כמה זמן">
              <Clock size={14} strokeWidth={2} />
            </span>
            {LESSON_DURATIONS.map((d) => (
              <button
                key={d.key}
                className={`btn-icon !p-1.5 ${li.duration === d.key ? "!bg-orange/10 !text-orange" : ""}`}
                data-tip={d.label}
                aria-label={d.label}
                onClick={() => onChange({ duration: li.duration === d.key ? null : d.key })}
              >
                <DurationIcon kind={d.key} size={16} />
              </button>
            ))}
            {li.item.kind === "openstuff" && (
              <button
                className={`btn-icon !p-1.5 ms-auto ${li.shareNote ? "!bg-blue-soft !text-blue-dark" : ""}`}
                data-tip={
                  li.shareNote
                    ? "ההערה תוצג בעמוד הפריט בחומר פתוח, עם שמך. לחצו לביטול"
                    : "ההערה פרטית. לחצו כדי להציג אותה בעמוד הפריט בחומר פתוח"
                }
                aria-label="שיתוף ההערה"
                aria-pressed={li.shareNote}
                onClick={() => onChange({ shareNote: !li.shareNote })}
              >
                <Share2 size={16} strokeWidth={2} />
              </button>
            )}
          </div>

          {itemTags(li.item).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {itemTags(li.item).map((t) => (
                <span key={t} className="rounded-full bg-blue-soft text-blue-dark text-[0.7rem] px-2 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          )}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== li.note && onChange({ note })}
            placeholder="איך אשתמש בזה בשיעור?"
            rows={2}
            className="block w-full rounded-xl border border-line bg-page/60 px-3 py-2 text-sm outline-none resize-none focus:border-blue"
          />
        </div>
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
    <div className={`rounded-xl border border-dashed border-blue/40 bg-blue-soft/40 ${compact ? "px-2 py-1.5" : "p-2.5"}`}>
      <input
        className="w-full bg-transparent outline-none text-sm placeholder:text-blue-dark/60 text-center"
        placeholder={busy ? "מוסיפים…" : "הדביקו קישור/ים"}
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

/* ---------- עמודת שיעור ---------- */

function LessonColumn({
  lesson,
  index,
  color,
  active,
  dropTarget,
  dragging,
  busy,
  onEnter,
  onLeave,
  onAddUrls,
  onRename,
  onTitleDraft,
  onItemChange,
  onItemDelete,
  onPublish,
  onItemType,
  onPublishLesson,
}: {
  lesson: Lesson;
  index: number;
  color: string;
  active: boolean;
  dropTarget: boolean;
  dragging: boolean;
  busy: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onAddUrls: (urls: string[]) => void;
  onRename: (title: string) => void;
  onTitleDraft: (title: string) => void;
  onItemChange: (id: number, patch: ItemPatch) => void;
  onItemDelete: (id: number) => void;
  onPublish: (li: LessonItem) => void;
  onItemType: (itemId: number, type: string) => void;
  onPublishLesson: () => void;
}) {
  // אותו אלמנט הוא גם יעד לשחרור פריטים (lesson-) וגם שיעור שאפשר לסדר בגרירה (ls-).
  const { setNodeRef: setDropRef } = useDroppable({ id: `lesson-${lesson.id}` });
  const { attributes, listeners, setNodeRef: setSortRef, transform, transition, isDragging } = useSortable({ id: `ls-${lesson.id}` });
  const [title, setTitle] = useState(lesson.title);
  // הערכה גסה לפי הסקאלה; "יחידה ארוכה" לא נספרת כי היא לא שייכת לשיעור אחד.
  const total = lesson.items.reduce((sum, li) => sum + (DURATIONS.find((d) => d.key === li.duration)?.minutes ?? 0), 0);

  return (
    <section
      ref={(node) => {
        setSortRef(node);
        setDropRef(node);
      }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const text = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
        const urls = extractUrls(text);
        if (urls.length) {
          e.preventDefault();
          onAddUrls(urls);
        }
      }}
      className={`w-[20rem] shrink-0 rounded-3xl border p-3.5 flex flex-col gap-2.5 transition-all ${
        dropTarget
          ? "border-blue bg-blue-soft shadow-lg ring-4 ring-blue/20"
          : active
            ? "border-blue bg-white shadow-md"
            : "border-line bg-white/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          className="btn-icon cursor-grab touch-none !p-1 -ms-1"
          data-tip="גרירה לשינוי סדר השיעורים"
          aria-label="גרירת שיעור"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} strokeWidth={2} />
        </button>
        <span
          className="h-7 w-7 shrink-0 rounded-full text-white text-sm font-bold flex items-center justify-center"
          style={{ background: color }}
        >
          {index + 1}
        </span>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            onTitleDraft(e.target.value);
          }}
          onBlur={() => title.trim() && title !== lesson.title && onRename(title)}
          className="min-w-0 flex-1 bg-transparent font-bold text-lg outline-none"
          aria-label="שם השיעור"
        />
        {total > 0 && (
          <span className="shrink-0 rounded-full bg-blue-soft text-blue-dark text-xs font-medium px-2.5 py-1 tabular-nums" data-tip="הערכה לפי משך הפריטים">
            כ־{total} דק׳
          </span>
        )}
        {lesson.items.length > 0 && (
          <button
            type="button"
            className={`btn-icon shrink-0 !p-1.5 ${lesson.publishedCollectionUrl ? "!text-green-600" : ""}`}
            data-tip={lesson.publishedCollectionUrl ? "פורסם כאוסף. לחצו לעדכון" : "פרסום השיעור כאוסף בחומר פתוח"}
            aria-label="פרסום השיעור כאוסף"
            onClick={onPublishLesson}
          >
            <Send size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      <SortableContext items={lesson.items.map((li) => `li-${li.id}`)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5 min-h-6">
          {lesson.items.map((li) => (
            <ItemRow
              key={li.id}
              li={li}
              expanded={active}
              onChange={(p) => onItemChange(li.id, p)}
              onDelete={() => onItemDelete(li.id)}
              onPublish={() => onPublish(li)}
              onType={(type) => onItemType(li.itemId, type)}
            />
          ))}
        </div>
      </SortableContext>

      {dragging ? (
        <div className={`rounded-xl border-2 border-dashed py-3 text-center text-sm ${dropTarget ? "border-blue text-blue-dark" : "border-line text-muted"}`}>
          שחררו כאן
        </div>
      ) : (
        <PasteZone onUrls={onAddUrls} busy={busy} compact />
      )}
    </section>
  );
}

/* ---------- מחסן ---------- */

function WhDraggable({ card, used }: { card: WhCard; used: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.key, data: { card } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2.5 bg-white border border-line rounded-xl p-2 cursor-grab touch-none hover:border-blue transition ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <Thumb item={{ imageUrl: card.imageUrl, kind: card.kind === "os" ? "openstuff" : "link", contentType: card.contentType }} size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug line-clamp-2">{card.title}</p>
        {card.tags.length > 0 && <p className="text-[0.7rem] text-muted mt-0.5 truncate">{card.tags.join(" · ")}</p>}
      </div>
      {used && (
        <span className="text-green-600 shrink-0" data-tip="כבר ברצף">
          <Check size={16} strokeWidth={2} />
        </span>
      )}
    </div>
  );
}

function Warehouse({
  groupId,
  usedUrls,
  refreshKey,
  autoQuery,
  autoKey,
  onClose,
  onItemsChanged,
}: {
  groupId: number;
  usedUrls: Set<string>;
  refreshKey: number;
  autoQuery: string;
  autoKey: number | null;
  onClose: () => void;
  onItemsChanged: () => void;
}) {
  const [tab, setTab] = useState<"os" | "mine">("os");
  const [manualQ, setManualQ] = useState("");
  // שם השיעור הפעיל משמש כחיפוש, עד שהמורה מקלידה בעצמה או מסירה אותו. מתאפס במעבר לשיעור אחר.
  const [autoOff, setAutoOff] = useState<number | null>(null);
  const autoActive = autoQuery !== "" && autoOff !== autoKey && manualQ.trim() === "";
  const q = manualQ.trim() || (autoActive ? autoQuery : "");
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const [osCards, setOsCards] = useState<WhCard[]>([]);
  const [osTotal, setOsTotal] = useState(0);
  const [osLoading, setOsLoading] = useState(false);
  const [osError, setOsError] = useState("");
  const [mine, setMine] = useState<WhCard[]>([]);
  const [pasteBusy, setPasteBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [q, all]);

  useEffect(() => {
    if (tab !== "os") return;
    // תשובה של חיפוש ישן לא רשאית לדרוס חיפוש חדש (זה מה שהחליף את התוצאות אחרי כמה שניות).
    let stale = false;
    const handle = setTimeout(async () => {
      setOsLoading(true);
      setOsError("");
      try {
        const params = new URLSearchParams({ group: String(groupId), q, page: String(page) });
        if (all) params.set("all", "1");
        const data = (await api(`/api/warehouse/openstuff?${params}`, "GET")) as {
          total: number;
          cards: Array<{ id: number; url: string; title: string; imageUrl: string | null; classes: string[]; subjects: string[]; category: string | null }>;
        };
        if (stale) return;
        const cards: WhCard[] = data.cards.map((c) => ({
          kind: "os",
          key: `wh-os-${c.id}`,
          url: c.url,
          title: c.title,
          imageUrl: c.imageUrl,
          contentType: c.category,
          tags: [...c.classes.slice(0, 3).map((x) => `כיתה ${x}`), ...c.subjects.slice(0, 1)],
        }));
        setOsCards((prev) => (page === 1 ? cards : [...prev, ...cards.filter((c) => !prev.some((p) => p.key === c.key))]));
        setOsTotal(data.total);
      } catch (e) {
        if (!stale) setOsError(e instanceof Error ? e.message : "שגיאה");
      } finally {
        if (!stale) setOsLoading(false);
      }
    }, q ? 350 : 0);
    return () => {
      stale = true;
      clearTimeout(handle);
    };
  }, [tab, q, all, page, groupId]);

  useEffect(() => {
    if (tab !== "mine") return;
    api("/api/items", "GET")
      .then((data: { items: Array<Item & { placed: number }> }) =>
        setMine(
          data.items.map((i) => ({
            kind: "item" as const,
            key: `wh-it-${i.id}`,
            itemId: i.id,
            url: i.url,
            title: i.title,
            imageUrl: i.imageUrl,
            contentType: i.contentType,
            tags: itemTags(i),
            placed: i.placed,
          })),
        ),
      )
      .catch(() => setMine([]));
  }, [tab, refreshKey]);

  async function pasteToWarehouse(urls: string[]) {
    setPasteBusy(true);
    try {
      for (const part of chunk(urls)) {
        await api("/api/items", "POST", { urls: part });
      }
      onItemsChanged();
    } finally {
      setPasteBusy(false);
    }
  }

  return (
    <aside className="w-[22rem] shrink-0 sticky top-4 self-start rounded-3xl bg-white border border-line shadow-sm flex flex-col max-h-[calc(100vh-2rem)]">
      <div className="flex items-center gap-2 p-3.5 pb-2">
        <h2 className="text-lg font-extrabold">המחסן</h2>
        <button className="btn-icon ms-auto" data-tip="סגירת המחסן" aria-label="סגירת המחסן" onClick={onClose}>
          <PanelLeftClose size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="mx-3.5 mb-2 flex gap-1 rounded-full bg-page p-1">
        {(
          [
            ["os", "מחומר פתוח"],
            ["mine", "שלי"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-full py-1.5 text-sm font-medium transition ${tab === key ? "bg-white text-blue-dark shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "os" && (
        <div className="px-3.5 pb-2 flex flex-col gap-2">
          <input
            className="field !py-1.5 text-sm"
            placeholder="חיפוש בחומר פתוח"
            value={manualQ}
            onChange={(e) => setManualQ(e.target.value)}
          />
          {autoActive && (
            <div className="flex items-center gap-1.5 rounded-full bg-blue-soft text-blue-dark text-xs ps-3 pe-1 py-1">
              <span className="truncate">לפי שם השיעור: {autoQuery}</span>
              <button
                className="btn-icon !p-1 ms-auto shrink-0"
                data-tip="חיפוש רחב יותר"
                aria-label="הסרת הסינון לפי שם השיעור"
                onClick={() => setAutoOff(autoKey)}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          )}
          <div className="flex gap-1 text-xs">
            {(
              [
                [false, "לפי הכיתה והתחום"],
                [true, "כל המאגר"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={label}
                onClick={() => setAll(val)}
                className={`rounded-full border px-3 py-1 transition ${all === val ? "bg-blue-soft border-blue text-blue-dark" : "border-line text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "mine" && (
        <div className="px-3.5 pb-2">
          <PasteZone onUrls={pasteToWarehouse} busy={pasteBusy} compact />
        </div>
      )}

      <div className="overflow-y-auto px-3.5 pb-3.5 flex flex-col gap-1.5">
        {tab === "os" ? (
          <>
            {[...osCards.filter((c) => !usedUrls.has(c.url)), ...osCards.filter((c) => usedUrls.has(c.url))].map((c) => (
              <WhDraggable key={c.key} card={c} used={usedUrls.has(c.url)} />
            ))}
            {osError && <p className="text-coral text-sm">{osError}</p>}
            {osLoading && <p className="text-muted text-sm text-center py-2">טוענים…</p>}
            {!osLoading && !osError && osCards.length === 0 && (
              <div className="text-center py-6 flex flex-col items-center gap-2">
                <p className="text-muted text-sm">לא נמצאו פריטים</p>
                {!all ? (
                  <button className="btn btn-ghost !py-1 text-xs" onClick={() => setAll(true)}>
                    חיפוש בכל המאגר
                  </button>
                ) : (
                  autoActive && (
                    <button className="btn btn-ghost !py-1 text-xs" onClick={() => setAutoOff(autoKey)}>
                      הסרת הסינון לפי שם השיעור
                    </button>
                  )
                )}
              </div>
            )}
            {!osLoading && osCards.length < osTotal && (
              <button className="btn btn-ghost justify-center" onClick={() => setPage((p) => p + 1)}>
                עוד
              </button>
            )}
          </>
        ) : (
          <>
            {[...mine.filter((c) => !(c.kind === "item" && c.placed > 0)), ...mine.filter((c) => c.kind === "item" && c.placed > 0)].map((c) => (
              <WhDraggable key={c.key} card={c} used={c.kind === "item" && c.placed > 0} />
            ))}
            {mine.length === 0 && <p className="text-muted text-sm text-center py-6">הדביקו קישורים כדי לצבור כאן פריטים</p>}
          </>
        )}
      </div>
    </aside>
  );
}

/* ---------- הלוח ---------- */

/* ---------- קישורים כלליים ---------- */

// קישור כללי הוא גם פריט שאפשר לגרור אל שיעור מסוים.
function CrossCard({
  c,
  topicColor,
  currentTopicId,
  onRemove,
  onToggleScope,
  onToggleUnit,
}: {
  c: CrossItem;
  topicColor: string;
  currentTopicId: number | null;
  onRemove: (id: number) => void;
  onToggleScope: (c: CrossItem) => void;
  onToggleUnit: (c: CrossItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `cr-${c.id}` });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`bg-white border border-line rounded-xl p-2 flex gap-2.5 items-center cursor-grab touch-none hover:border-blue transition ${isDragging ? "opacity-40" : ""}`}
    >
      <Thumb item={c.item} size={40} />
      <a href={c.item.url} target="_blank" rel="noreferrer" draggable={false} className="flex-1 min-w-0 text-sm font-medium line-clamp-2 hover:text-blue-dark">
        {c.item.title}
      </a>
      <button
        className={`btn-icon ${c.duration === "unit" ? "!bg-orange/10 !text-orange" : ""}`}
        data-tip={c.duration === "unit" ? "יחידה ארוכה, נפרשת על כמה מפגשים. לחצו לביטול" : "סימון כיחידה ארוכה (נפרשת על כמה מפגשים)"}
        aria-label="יחידה ארוכה"
        aria-pressed={c.duration === "unit"}
        onClick={() => onToggleUnit(c)}
      >
        <DurationIcon kind="unit" size={16} />
      </button>
      <button
        className="btn-icon"
        data-tip={c.topicId === null ? "חל על כל הנושאים. לחצו לשיוך לנושא הנוכחי" : "משויך לנושא. לחצו להחלה על כל הנושאים"}
        aria-label="שיוך לנושא"
        onClick={() => onToggleScope(c)}
        disabled={currentTopicId === null}
      >
        {c.topicId === null ? <Layers size={16} strokeWidth={2} /> : <span className="block h-3.5 w-3.5 rounded-full" style={{ background: topicColor }} />}
      </button>
      <button className="btn-icon" data-tip="הסרה" aria-label="הסרה" onClick={() => onRemove(c.id)}>
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

function CrossSection({
  open,
  onToggle,
  items,
  topicColor,
  dragging,
  isOver,
  busy,
  currentTopicId,
  onAddUrls,
  onRemove,
  onToggleScope,
  onToggleUnit,
}: {
  open: boolean;
  onToggle: () => void;
  items: CrossItem[];
  topicColor: string;
  dragging: boolean;
  isOver: boolean;
  busy: boolean;
  currentTopicId: number | null;
  onAddUrls: (urls: string[]) => void;
  onRemove: (id: number) => void;
  onToggleScope: (c: CrossItem) => void;
  onToggleUnit: (c: CrossItem) => void;
}) {
  const { setNodeRef } = useDroppable({ id: "cross-zone" });
  return (
    <section
      ref={setNodeRef}
      className={`mt-6 rounded-3xl border p-3.5 transition-all ${
        isOver ? "border-blue bg-blue-soft ring-4 ring-blue/20" : dragging ? "border-blue/50 border-dashed bg-white/70" : "border-line bg-white/60"
      }`}
    >
      <button className="flex w-full items-center gap-2 text-start" onClick={onToggle} aria-expanded={open}>
        <h2 className="text-lg font-bold" data-tip="קישורים שעדיין לא שייכים לשיעור: מדביקים כאן הרבה בבת אחת וגוררים לשיעורים. אפשר גם לשמור כאן דברים כלליים כמו תכנון יחידה או בוחן קבוע">
          קישורים כלליים
        </h2>
        <span className="rounded-full bg-blue-soft text-blue-dark text-xs font-medium px-2.5 py-0.5 tabular-nums">{items.length}</span>
        {dragging && <span className="text-sm text-blue-dark">שחררו כאן כדי להפוך לקישור כללי</span>}
        <span className="ms-auto text-muted">{open ? <ChevronUp size={18} strokeWidth={2} /> : <ChevronDown size={18} strokeWidth={2} />}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <CrossCard
              key={c.id}
              c={c}
              topicColor={topicColor}
              currentTopicId={currentTopicId}
              onRemove={onRemove}
              onToggleScope={onToggleScope}
              onToggleUnit={onToggleUnit}
            />
          ))}
          <PasteZone onUrls={onAddUrls} busy={busy} compact />
        </div>
      )}
    </section>
  );
}

/* ---------- הלוח ---------- */

type DragKind = "item" | "lesson" | null;

export default function Board({ groupId }: { groupId: number }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeLesson, setActiveLesson] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(true);
  const [crossOpen, setCrossOpen] = useState(true);
  const [warehouseKey, setWarehouseKey] = useState(0);
  const [dragCard, setDragCard] = useState<{ title: string; imageUrl: string | null; kind: string } | null>(null);
  const [dragKind, setDragKind] = useState<DragKind>(null);
  const [dragFromCross, setDragFromCross] = useState(false);
  const [overLesson, setOverLesson] = useState<number | null>(null);
  const [overCross, setOverCross] = useState(false);
  const [titleDrafts, setTitleDrafts] = useState<Record<number, string>>({});
  const [publishFor, setPublishFor] = useState<LessonItem | null>(null);
  const [publishLessonFor, setPublishLessonFor] = useState<Lesson | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [terms, setTerms] = useState<Terms>({ classes: [], subjects: [], categories: [] });
  const [notice, setNotice] = useState("");
  const activeRef = useRef<number | null>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // גרירת שיעור רואה רק שיעורים ונושאים; גרירת פריט רואה רק שיעורים (כיעד), פריטים ואזור הרוחביים.
  // אזורים גדולים (הרוחביים, פסי הנושאים) נקבעים לפי מיקום העכבר ולא לפי קרבת פינות, אחרת הם אף פעם לא "מנצחים".
  const collision: CollisionDetection = useCallback((args) => {
    const activeId = String(args.active.id);
    const isLesson = activeId.startsWith("ls-");
    const eligible = args.droppableContainers.filter((c) => {
      const id = String(c.id);
      return isLesson ? id.startsWith("ls-") || id.startsWith("topic-") : !id.startsWith("ls-") && !id.startsWith("topic-");
    });
    const isZone = (id: string) => id === "cross-zone" || id.startsWith("topic-");
    const zone = pointerWithin({ ...args, droppableContainers: eligible }).find((c) => isZone(String(c.id)));
    if (zone) return [zone];
    return closestCorners({ ...args, droppableContainers: eligible.filter((c) => !isZone(String(c.id))) });
  }, []);

  const firstLessonOf = (board: BoardData, topicId: number | null) =>
    board.lessons.find((l) => l.topicId === topicId)?.id ?? null;

  const load = useCallback(async () => {
    try {
      const board = (await api(`/api/groups/${groupId}/board`, "GET")) as BoardData;
      setData(board);
      const topicId = board.sequence.currentTopicId;
      setActiveLesson((cur) =>
        cur != null && board.lessons.some((l) => l.id === cur && l.topicId === topicId) ? cur : firstLessonOf(board, topicId),
      );
    } catch (e) {
      if (e instanceof Error && e.message === "נדרשת התחברות") {
        window.location.href = "/";
        return;
      }
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

  useEffect(() => {
    // הרשימות של חומר פתוח (כיתות, תחומים, קטגוריות) לחלון הפרסום ולהגדרות הקבוצה.
    api("/api/taxonomies", "GET")
      .then((t: Terms) => setTerms(t))
      .catch(() => {});
  }, []);

  const bumpWarehouse = () => setWarehouseKey((k) => k + 1);

  const addUrls = useCallback(
    async (lessonId: number, urls: string[], index?: number) => {
      setBusy(true);
      setError("");
      try {
        const parts = chunk(urls);
        for (let i = 0; i < parts.length; i++) {
          await api(`/api/lessons/${lessonId}/links`, "POST", { urls: parts[i], index: index === undefined ? undefined : index + i * URL_CHUNK });
        }
        await load();
        setWarehouseKey((k) => k + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

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

  const currentTopicId = data?.sequence.currentTopicId ?? null;
  const visibleLessons = data ? data.lessons.filter((l) => l.topicId === currentTopicId) : [];

  function locate(overId: string): { lessonId: number; index: number } | null {
    if (!data) return null;
    if (overId.startsWith("lesson-")) {
      const lessonId = Number(overId.slice(7));
      return { lessonId, index: data.lessons.find((l) => l.id === lessonId)?.items.length ?? 0 };
    }
    if (overId.startsWith("li-")) {
      const overLi = Number(overId.slice(3));
      const lesson = data.lessons.find((l) => l.items.some((x) => x.id === overLi));
      if (!lesson) return null;
      return { lessonId: lesson.id, index: lesson.items.findIndex((x) => x.id === overLi) };
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id.startsWith("wh-")) {
      const card = (e.active.data.current as { card: WhCard }).card;
      setDragKind("item");
      setDragCard({ title: card.title, imageUrl: card.imageUrl, kind: card.kind === "os" ? "openstuff" : "link" });
    } else if (id.startsWith("li-") && data) {
      const li = data.lessons.flatMap((l) => l.items).find((x) => x.id === Number(id.slice(3)));
      setDragKind("item");
      if (li) setDragCard({ title: li.item.title, imageUrl: li.item.imageUrl, kind: li.item.kind });
    } else if (id.startsWith("ls-") && data) {
      const lesson = data.lessons.find((l) => l.id === Number(id.slice(3)));
      setDragKind("lesson");
      if (lesson) setDragCard({ title: lesson.title, imageUrl: null, kind: "lesson" });
    } else if (id.startsWith("cr-") && data) {
      const cross = data.crossItems.find((c) => c.id === Number(id.slice(3)));
      setDragKind("item");
      setDragFromCross(true);
      if (cross) setDragCard({ title: cross.item.title, imageUrl: cross.item.imageUrl, kind: cross.item.kind });
    }
  }

  function onDragOver(e: DragOverEvent) {
    const id = e.over ? String(e.over.id) : "";
    setOverCross(id === "cross-zone");
    setOverLesson(id ? (locate(id)?.lessonId ?? null) : null);
  }

  function resetDrag() {
    setDragCard(null);
    setDragKind(null);
    setDragFromCross(false);
    setOverLesson(null);
    setOverCross(false);
  }

  async function onDragEnd(e: DragEndEvent) {
    resetDrag();
    if (!data || !e.over) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    if (activeId === overId) return;

    // סדר שיעורים, או העברת שיעור לנושא אחר.
    if (activeId.startsWith("ls-")) {
      const lessonId = Number(activeId.slice(3));
      try {
        if (overId.startsWith("topic-")) {
          await api(`/api/lessons/${lessonId}`, "PATCH", { topicId: Number(overId.slice(6)) });
        } else if (overId.startsWith("ls-")) {
          const index = visibleLessons.findIndex((l) => l.id === Number(overId.slice(3)));
          if (index >= 0) await api(`/api/lessons/${lessonId}`, "PATCH", { index });
        }
      } catch {
        setError("הזזת השיעור נכשלה");
      }
      await load();
      return;
    }

    // קישור כללי שנגרר אל שיעור: עובר לשיעור, במקום שבו שוחרר.
    if (activeId.startsWith("cr-")) {
      const dest = locate(overId);
      if (!dest) return;
      setActiveLesson(dest.lessonId);
      try {
        await api(`/api/cross/${Number(activeId.slice(3))}/to-lesson`, "POST", { lessonId: dest.lessonId, index: dest.index });
      } catch (err) {
        setError(err instanceof Error ? err.message : "ההעברה נכשלה");
      }
      await load();
      return;
    }

    // שחרור על הקישורים הכלליים: הופך את הפריט לקישור כללי (פריט משיעור עובר, מהמחסן מתווסף).
    if (overId === "cross-zone") {
      setBusy(true);
      try {
        if (activeId.startsWith("li-")) {
          await api(`/api/lesson-items/${Number(activeId.slice(3))}/to-cross`, "POST", { topicId: currentTopicId });
        } else if (activeId.startsWith("wh-")) {
          const card = (e.active.data.current as { card: WhCard }).card;
          await api(
            `/api/groups/${groupId}/cross`,
            "POST",
            card.kind === "os" ? { urls: [card.url], topicId: currentTopicId } : { itemId: card.itemId, topicId: currentTopicId },
          );
        }
        setCrossOpen(true);
        await load();
        bumpWarehouse();
      } catch (err) {
        setError(err instanceof Error ? err.message : "ההעברה נכשלה");
      } finally {
        setBusy(false);
      }
      return;
    }

    const dest = locate(overId);
    if (!dest) return;

    if (activeId.startsWith("wh-")) {
      const card = (e.active.data.current as { card: WhCard }).card;
      setActiveLesson(dest.lessonId);
      setBusy(true);
      try {
        if (card.kind === "os") {
          await api(`/api/lessons/${dest.lessonId}/links`, "POST", { urls: [card.url], index: dest.index });
        } else {
          await api(`/api/lessons/${dest.lessonId}/items`, "POST", { itemId: card.itemId, index: dest.index });
        }
        await load();
        bumpWarehouse();
      } catch (err) {
        setError(err instanceof Error ? err.message : "ההוספה נכשלה");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!activeId.startsWith("li-")) return;
    const itemId = Number(activeId.slice(3));
    setData((prev) => {
      if (!prev) return prev;
      const moving = prev.lessons.flatMap((l) => l.items).find((x) => x.id === itemId);
      if (!moving) return prev;
      const lessons = prev.lessons.map((l) => ({ ...l, items: l.items.filter((x) => x.id !== itemId) }));
      const target = lessons.find((l) => l.id === dest.lessonId);
      if (target) target.items.splice(Math.min(dest.index, target.items.length), 0, { ...moving, lessonId: dest.lessonId });
      return { ...prev, lessons };
    });
    try {
      await api(`/api/lesson-items/${itemId}`, "PATCH", { move: { lessonId: dest.lessonId, index: dest.index } });
    } catch {
      setError("ההעברה נכשלה");
    }
    await load();
  }

  async function itemChange(id: number, patch: ItemPatch) {
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

  // סוג התוכן שייך לפריט עצמו, ולכן מתעדכן בכל מקום שבו הוא מופיע (שיעורים וקישורים כלליים).
  async function itemType(itemId: number, type: string) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            lessons: prev.lessons.map((l) => ({
              ...l,
              items: l.items.map((x) => (x.item.id === itemId ? { ...x, item: { ...x.item, contentType: type } } : x)),
            })),
            crossItems: prev.crossItems.map((c) => (c.item.id === itemId ? { ...c, item: { ...c.item, contentType: type } } : c)),
          }
        : prev,
    );
    try {
      await api(`/api/items/${itemId}`, "PATCH", { contentType: type });
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
      bumpWarehouse();
    }
  }

  function scrollToEnd() {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ left: -(el.scrollWidth - el.clientWidth), behavior: "smooth" });
    });
  }

  async function addLesson() {
    await api(`/api/groups/${groupId}/lessons`, "POST", { topicId: currentTopicId ?? undefined });
    await load();
    scrollToEnd();
  }

  // החלפת נושא: זוכרים אותו בשרת, כדי שבפעם הבאה הלוח ייפתח בו.
  function selectTopic(id: number) {
    if (!data || id === currentTopicId) return;
    setData({ ...data, sequence: { ...data.sequence, currentTopicId: id } });
    setActiveLesson(firstLessonOf(data, id));
    scrollRef.current?.scrollTo({ left: 0 });
    api(`/api/groups/${groupId}/current-topic`, "POST", { topicId: id }).catch(() => setError("שמירת הנושא נכשלה"));
  }

  async function addTopic() {
    try {
      await api(`/api/groups/${groupId}/topics`, "POST", {});
      setActiveLesson(null);
      await load();
      scrollRef.current?.scrollTo({ left: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    }
  }

  async function renameTopic(id: number, name: string) {
    await api(`/api/topics/${id}`, "PATCH", { name }).catch(() => setError("שינוי השם נכשל"));
    await load();
  }

  async function addCross(urls: string[]) {
    setBusy(true);
    try {
      for (const part of chunk(urls)) {
        await api(`/api/groups/${groupId}/cross`, "POST", { urls: part, topicId: currentTopicId });
      }
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

  async function toggleCrossScope(c: CrossItem) {
    await api(`/api/cross/${c.id}`, "PATCH", { topicId: c.topicId === null ? currentTopicId : null }).catch(() => setError("השמירה נכשלה"));
    await load();
  }

  async function toggleCrossUnit(c: CrossItem) {
    await api(`/api/cross/${c.id}`, "PATCH", { duration: c.duration === "unit" ? null : "unit" }).catch(() => setError("השמירה נכשלה"));
    await load();
  }

  function hoverLesson(id: number) {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    // השהיה קצרה: מעבר עכבר חולף בין שיעורים לא יגרום לקפיצות פריסה.
    enterTimer.current = setTimeout(() => setActiveLesson(id), 140);
  }

  if (!data) return <div className="p-10 text-muted">{error || "טוענים…"}</div>;

  const { group } = data;
  const topicColor = data.topics.find((t) => t.id === currentTopicId)?.color ?? "var(--blue)";
  const lessonCounts: Record<number, number> = {};
  for (const l of data.lessons) if (l.topicId != null) lessonCounts[l.topicId] = (lessonCounts[l.topicId] ?? 0) + 1;
  const visibleCross = data.crossItems.filter((c) => c.topicId === null || c.topicId === currentTopicId);

  const activeTitle = (
    activeLesson != null && titleDrafts[activeLesson] !== undefined
      ? titleDrafts[activeLesson]
      : (data.lessons.find((l) => l.id === activeLesson)?.title ?? "")
  ).trim();
  // שם ברירת מחדל ("שיעור 3") לא מחפש כלום; שם אמיתי הופך לחיפוש במחסן.
  const autoQuery = /^שיעור\s*\d*$/.test(activeTitle) ? "" : activeTitle;
  const usedUrls = new Set([...data.lessons.flatMap((l) => l.items.map((x) => x.item.url)), ...data.crossItems.map((c) => c.item.url)]);

  return (
    <div className="px-5 py-8">
      <div className="mx-auto max-w-[110rem] mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{group.name}</h1>
        {group.className && <span className="rounded-full bg-blue-soft text-blue-dark px-3 py-1 text-sm">כיתה {group.className}</span>}
        {group.subjectName && <span className="rounded-full bg-blue-soft text-blue-dark px-3 py-1 text-sm">{group.subjectName}</span>}
        {group.tags.map((t) => (
          <span key={t} className="rounded-full border border-line text-muted px-3 py-1 text-sm">
            {t}
          </span>
        ))}
        <button
          className={`btn-icon bg-white border border-line !p-2 ${settingsOpen ? "!bg-blue-soft !text-blue-dark" : ""}`}
          data-tip="הגדרות הקבוצה: כיתה, תחום ותגיות"
          aria-label="הגדרות הקבוצה"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
        >
          <Settings2 size={16} strokeWidth={2} />
        </button>
        <div className="ms-auto flex gap-2">
          {!warehouseOpen && (
            <button className="btn btn-primary" onClick={() => setWarehouseOpen(true)}>
              <PanelLeftOpen size={16} strokeWidth={2} /> המחסן
            </button>
          )}
          <button
            className="btn btn-ghost"
            data-tip="הקוד שהתלמידים יזינו כדי להצטרף"
            data-tip-edge="left"
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
      </div>

      {error && <p className="mx-auto max-w-[110rem] text-coral mb-3">{error}</p>}
      {notice && (
        <p className="mx-auto max-w-[110rem] mb-3 rounded-full bg-blue-soft px-4 py-2 text-sm text-blue-dark" role="status">
          {notice}
        </p>
      )}

      {settingsOpen && (
        <GroupSettings
          key={`${group.id}-${group.name}-${group.className}-${group.subjectName}-${group.tags.join("|")}`}
          group={group}
          terms={terms}
          topics={data.topics}
          lessonCounts={lessonCounts}
          onTopicsChanged={load}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            load();
            bumpWarehouse();
          }}
        />
      )}

      {publishFor && (
        <PublishDialog
          item={publishFor.item}
          note={publishFor.note}
          context={{ className: group.className, subjectName: group.subjectName, tags: group.tags }}
          terms={terms}
          onClose={() => setPublishFor(null)}
          onDone={() => {
            setPublishFor(null);
            setNotice("הפריט נשלח לבדיקה, ויופיע בחומר פתוח אחרי אישור.");
            setTimeout(() => setNotice(""), 6000);
            load();
          }}
        />
      )}

      {publishLessonFor && (
        <PublishLessonDialog
          lesson={publishLessonFor}
          context={{ className: group.className, subjectName: group.subjectName, tags: group.tags }}
          terms={terms}
          onClose={() => {
            setPublishLessonFor(null);
            load();
          }}
          onDone={() => {
            setPublishLessonFor(null);
            load();
          }}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={resetDrag}
      >
        <div className="mx-auto max-w-[110rem] flex gap-5 items-start">
          <div className="min-w-0 flex-1">
            <TopicBar
              topics={data.topics}
              lessonCounts={lessonCounts}
              currentId={currentTopicId}
              onSelect={selectTopic}
              onRename={renameTopic}
              onAdd={addTopic}
            />

            <Rope scrollRef={scrollRef} watchKey={`${currentTopicId}-${visibleLessons.length}`} />

            <div ref={scrollRef} className="overflow-x-auto no-scrollbar pb-3">
              <SortableContext items={visibleLessons.map((l) => `ls-${l.id}`)} strategy={horizontalListSortingStrategy}>
                <div className="flex gap-4 items-start w-max min-w-full pt-2">
                  {visibleLessons.map((l, i) => (
                    <LessonColumn
                      key={l.id}
                      lesson={l}
                      index={i}
                      color={topicColor}
                      active={activeLesson === l.id}
                      dropTarget={overLesson === l.id && dragKind === "item"}
                      dragging={dragKind === "item"}
                      busy={busy}
                      onEnter={() => hoverLesson(l.id)}
                      onLeave={() => enterTimer.current && clearTimeout(enterTimer.current)}
                      onAddUrls={(urls) => addUrls(l.id, urls)}
                      onRename={(title) => api(`/api/lessons/${l.id}`, "PATCH", { title }).then(load)}
                      onTitleDraft={(t) => setTitleDrafts((p) => ({ ...p, [l.id]: t }))}
                      onItemChange={itemChange}
                      onItemDelete={itemDelete}
                      onPublish={setPublishFor}
                      onItemType={itemType}
                      onPublishLesson={() => setPublishLessonFor(l)}
                    />
                  ))}
                  <button className="btn btn-ghost shrink-0 self-start mt-1" onClick={addLesson}>
                    <Plus size={18} strokeWidth={2} /> שיעור
                  </button>
                </div>
              </SortableContext>
            </div>

            <CrossSection
              open={crossOpen}
              onToggle={() => setCrossOpen((v) => !v)}
              items={visibleCross}
              topicColor={topicColor}
              dragging={dragKind === "item" && !dragFromCross}
              isOver={overCross && !dragFromCross}
              busy={busy}
              currentTopicId={currentTopicId}
              onAddUrls={addCross}
              onRemove={removeCross}
              onToggleScope={toggleCrossScope}
              onToggleUnit={toggleCrossUnit}
            />
          </div>

          {warehouseOpen && (
            <Warehouse
              groupId={groupId}
              usedUrls={usedUrls}
              refreshKey={warehouseKey}
              autoQuery={autoQuery}
              autoKey={activeLesson}
              onClose={() => setWarehouseOpen(false)}
              onItemsChanged={bumpWarehouse}
            />
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragCard && (
            <div className="flex items-center gap-2.5 bg-white border-2 border-blue rounded-xl p-2 shadow-2xl w-72 cursor-grabbing">
              {dragCard.kind !== "lesson" && <Thumb item={dragCard} size={40} />}
              <p className="text-sm font-medium line-clamp-2">{dragCard.kind === "lesson" ? `שיעור: ${dragCard.title}` : dragCard.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
