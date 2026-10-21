"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  Dumbbell,
  FileText,
  Gamepad2,
  Lightbulb,
  Library,
  Link2,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Play,
  Plus,
  Presentation,
  Sparkles,
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
  minutes: number | null;
  item: Item;
};
type Lesson = { id: number; title: string; items: LessonItem[] };
type CrossItem = { id: number; note: string; item: Item };
type BoardData = {
  group: { id: number; name: string; className: string | null; subjectName: string | null; joinCode: string };
  lessons: Lesson[];
  crossItems: CrossItem[];
};
type ItemPatch = Partial<Pick<LessonItem, "phase" | "note" | "isAssignment" | "minutes">>;

// מה שנגרר מהמחסן: קישור מחומר פתוח (ייווצר פריט) או פריט קיים של המורה.
type WhCard =
  | { kind: "os"; key: string; url: string; title: string; imageUrl: string | null; tags: string[] }
  | { kind: "item"; key: string; itemId: number; url: string; title: string; imageUrl: string | null; tags: string[]; placed: number };

const PHASES = [
  { name: "הקניה", icon: Lightbulb },
  { name: "תרגול", icon: Dumbbell },
  { name: "הערכה", icon: ClipboardCheck },
  { name: "רקע", icon: Library },
  { name: "העשרה", icon: Sparkles },
] as const;
const MINUTE_CHOICES = [5, 10, 15, 20, 30, 45];

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

function itemTags(item: Item): string[] {
  return [...(item.meta.classes ?? []).slice(0, 3).map((c) => `כיתה ${c}`), ...(item.meta.subjects ?? []).slice(0, 2)];
}

function Thumb({ item, size }: { item: Pick<Item, "imageUrl" | "kind">; size: number }) {
  const Icon = KIND_ICON[item.kind] ?? Link2;
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
}: {
  li: LessonItem;
  expanded: boolean;
  onChange: (patch: ItemPatch) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `li-${li.id}` });
  const [note, setNote] = useState(li.note);
  const KindIcon = KIND_ICON[li.item.kind] ?? Link2;
  const phase = PHASES.find((p) => p.name === li.phase);
  const PhaseIcon = phase?.icon;
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
          {li.minutes != null && (
            <span className="text-xs font-medium tabular-nums" data-tip="משך מתוכנן">
              {li.minutes}׳
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
          <span data-tip={KIND_LABEL[li.item.kind] ?? "קישור"}>
            <KindIcon size={15} strokeWidth={2} />
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-2" onPointerDown={stop}>
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
            <button className="btn-icon !p-1.5 ms-auto" data-tip="הסרה מהשיעור" aria-label="הסרה" onClick={onDelete}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="text-muted" data-tip="משך מתוכנן בדקות">
              <Clock size={14} strokeWidth={2} />
            </span>
            {MINUTE_CHOICES.map((m) => (
              <button
                key={m}
                onClick={() => onChange({ minutes: li.minutes === m ? null : m })}
                className={`rounded-full px-2 py-0.5 text-xs border transition ${
                  li.minutes === m ? "bg-blue text-white border-blue" : "border-line text-muted hover:border-blue"
                }`}
              >
                {m}
              </button>
            ))}
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
        placeholder={busy ? "מוסיפים…" : "הדביקו קישור"}
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
  active,
  dropTarget,
  dragging,
  busy,
  onEnter,
  onLeave,
  onAddUrls,
  onRename,
  onItemChange,
  onItemDelete,
}: {
  lesson: Lesson;
  index: number;
  active: boolean;
  dropTarget: boolean;
  dragging: boolean;
  busy: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onAddUrls: (urls: string[]) => void;
  onRename: (title: string) => void;
  onItemChange: (id: number, patch: ItemPatch) => void;
  onItemDelete: (id: number) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `lesson-${lesson.id}` });
  const [title, setTitle] = useState(lesson.title);
  const total = lesson.items.reduce((sum, li) => sum + (li.minutes ?? 0), 0);

  return (
    <section
      ref={setNodeRef}
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
        <span className="h-7 w-7 shrink-0 rounded-full bg-blue text-white text-sm font-bold flex items-center justify-center">{index + 1}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== lesson.title && onRename(title)}
          className="min-w-0 flex-1 bg-transparent font-bold text-lg outline-none"
          aria-label="שם השיעור"
        />
        {total > 0 && (
          <span className="shrink-0 rounded-full bg-blue-soft text-blue-dark text-xs font-medium px-2.5 py-1 tabular-nums" data-tip="סך הזמן המתוכנן">
            {total} דק׳
          </span>
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
      <Thumb item={{ imageUrl: card.imageUrl, kind: card.kind === "os" ? "openstuff" : "link" }} size={44} />
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
  onClose,
  onItemsChanged,
}: {
  groupId: number;
  usedUrls: Set<string>;
  refreshKey: number;
  onClose: () => void;
  onItemsChanged: () => void;
}) {
  const [tab, setTab] = useState<"os" | "mine">("os");
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const [osCards, setOsCards] = useState<WhCard[]>([]);
  const [osTotal, setOsTotal] = useState(0);
  const [osLoading, setOsLoading] = useState(false);
  const [osError, setOsError] = useState("");
  const [mine, setMine] = useState<WhCard[]>([]);
  const [pasteBusy, setPasteBusy] = useState(false);

  useEffect(() => {
    if (tab !== "os") return;
    const handle = setTimeout(async () => {
      setOsLoading(true);
      setOsError("");
      try {
        const params = new URLSearchParams({ group: String(groupId), q, page: String(page) });
        if (all) params.set("all", "1");
        const data = (await api(`/api/warehouse/openstuff?${params}`, "GET")) as {
          total: number;
          cards: Array<{ id: number; url: string; title: string; imageUrl: string | null; classes: string[]; subjects: string[] }>;
        };
        const cards: WhCard[] = data.cards.map((c) => ({
          kind: "os",
          key: `wh-os-${c.id}`,
          url: c.url,
          title: c.title,
          imageUrl: c.imageUrl,
          tags: [...c.classes.slice(0, 3).map((x) => `כיתה ${x}`), ...c.subjects.slice(0, 1)],
        }));
        setOsCards((prev) => (page === 1 ? cards : [...prev, ...cards.filter((c) => !prev.some((p) => p.key === c.key))]));
        setOsTotal(data.total);
      } catch (e) {
        setOsError(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setOsLoading(false);
      }
    }, q ? 350 : 0);
    return () => clearTimeout(handle);
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
      await api("/api/items", "POST", { urls });
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
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <div className="flex gap-1 text-xs">
            {(
              [
                [false, "לפי הכיתה והתחום"],
                [true, "כל המאגר"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={label}
                onClick={() => {
                  setAll(val);
                  setPage(1);
                }}
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
            {osCards.map((c) => (
              <WhDraggable key={c.key} card={c} used={usedUrls.has(c.url)} />
            ))}
            {osError && <p className="text-coral text-sm">{osError}</p>}
            {osLoading && <p className="text-muted text-sm text-center py-2">טוענים…</p>}
            {!osLoading && !osError && osCards.length === 0 && <p className="text-muted text-sm text-center py-6">לא נמצאו פריטים</p>}
            {!osLoading && osCards.length < osTotal && (
              <button className="btn btn-ghost justify-center" onClick={() => setPage((p) => p + 1)}>
                עוד
              </button>
            )}
          </>
        ) : (
          <>
            {mine.map((c) => (
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

export default function Board({ groupId }: { groupId: number }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeLesson, setActiveLesson] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(true);
  const [warehouseKey, setWarehouseKey] = useState(0);
  const [dragCard, setDragCard] = useState<{ title: string; imageUrl: string | null; kind: string } | null>(null);
  const [overLesson, setOverLesson] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => {
    try {
      const board = (await api(`/api/groups/${groupId}/board`, "GET")) as BoardData;
      setData(board);
      setActiveLesson((cur) => cur ?? board.lessons[0]?.id ?? null);
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

  const bumpWarehouse = () => setWarehouseKey((k) => k + 1);

  const addUrls = useCallback(
    async (lessonId: number, urls: string[], index?: number) => {
      setBusy(true);
      setError("");
      try {
        await api(`/api/lessons/${lessonId}/links`, "POST", { urls, index });
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
      setDragCard({ title: card.title, imageUrl: card.imageUrl, kind: card.kind === "os" ? "openstuff" : "link" });
    } else if (id.startsWith("li-") && data) {
      const li = data.lessons.flatMap((l) => l.items).find((x) => x.id === Number(id.slice(3)));
      if (li) setDragCard({ title: li.item.title, imageUrl: li.item.imageUrl, kind: li.item.kind });
    }
  }

  function onDragOver(e: DragOverEvent) {
    setOverLesson(e.over ? (locate(String(e.over.id))?.lessonId ?? null) : null);
  }

  async function onDragEnd(e: DragEndEvent) {
    setDragCard(null);
    setOverLesson(null);
    if (!data || !e.over) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    if (activeId === overId) return;
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

  async function itemDelete(id: number) {
    try {
      await api(`/api/lesson-items/${id}`, "DELETE");
    } finally {
      await load();
      bumpWarehouse();
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

  function hoverLesson(id: number) {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    // השהיה קצרה: מעבר עכבר חולף בין שיעורים לא יגרום לקפיצות פריסה.
    enterTimer.current = setTimeout(() => setActiveLesson(id), 140);
  }

  if (!data) return <div className="p-10 text-muted">{error || "טוענים…"}</div>;

  const { group } = data;
  const usedUrls = new Set([...data.lessons.flatMap((l) => l.items.map((x) => x.item.url)), ...data.crossItems.map((c) => c.item.url)]);

  return (
    <div className="px-5 py-8">
      <div className="mx-auto max-w-[110rem] mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{group.name}</h1>
        {group.className && <span className="rounded-full bg-blue-soft text-blue-dark px-3 py-1 text-sm">כיתה {group.className}</span>}
        {group.subjectName && <span className="rounded-full bg-blue-soft text-blue-dark px-3 py-1 text-sm">{group.subjectName}</span>}
        <div className="ms-auto flex gap-2">
          {!warehouseOpen && (
            <button className="btn btn-primary" onClick={() => setWarehouseOpen(true)}>
              <PanelLeftOpen size={16} strokeWidth={2} /> המחסן
            </button>
          )}
          <button
            className="btn btn-ghost"
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
      </div>

      {error && <p className="mx-auto max-w-[110rem] text-coral mb-3">{error}</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragCard(null);
          setOverLesson(null);
        }}
      >
        <div className="mx-auto max-w-[110rem] flex gap-5 items-start">
          <div className="min-w-0 flex-1">
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 items-start w-max min-w-full pt-5 relative">
                <div className="absolute top-2 inset-x-0 border-t-2 border-dashed border-blue/40" aria-hidden />
                {data.lessons.map((l, i) => (
                  <LessonColumn
                    key={l.id}
                    lesson={l}
                    index={i}
                    active={activeLesson === l.id}
                    dropTarget={overLesson === l.id && dragCard !== null}
                    dragging={dragCard !== null}
                    busy={busy}
                    onEnter={() => hoverLesson(l.id)}
                    onLeave={() => enterTimer.current && clearTimeout(enterTimer.current)}
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

            <section className="mt-8">
              <h2 className="text-xl font-bold mb-1" data-tip="תכנון יחידה, תרגיל חוזר, בוחן קבוע: דברים שלא שייכים לשיעור אחד">
                פריטים רוחביים
              </h2>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {data.crossItems.map((c) => (
                  <div key={c.id} className="bg-white border border-line rounded-xl p-2 flex gap-2.5 items-center">
                    <Thumb item={c.item} size={40} />
                    <a href={c.item.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 text-sm font-medium line-clamp-2 hover:text-blue-dark">
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

          {warehouseOpen && (
            <Warehouse
              groupId={groupId}
              usedUrls={usedUrls}
              refreshKey={warehouseKey}
              onClose={() => setWarehouseOpen(false)}
              onItemsChanged={bumpWarehouse}
            />
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragCard && (
            <div className="flex items-center gap-2.5 bg-white border-2 border-blue rounded-xl p-2 shadow-2xl w-72 cursor-grabbing">
              <Thumb item={dragCard} size={40} />
              <p className="text-sm font-medium line-clamp-2">{dragCard.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
