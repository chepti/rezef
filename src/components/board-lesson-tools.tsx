"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dices,
  Eraser,
  GraduationCap,
  ImageDown,
  Moon,
  Pause,
  Pencil,
  Pin,
  PinOff,
  Play,
  RotateCcw,
  Shuffle,
  Timer,
  Trash2,
  Undo2,
  UserRound,
  Users,
  UsersRound,
  Volume1,
  VolumeX,
  X,
} from "lucide-react";

/* ---------- צליל עדין ---------- */

let audio: AudioContext | null = null;
// שני צלילים רכים עולים. נכשל בשקט אם הדפדפן חוסם שמע.
export function chime() {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    if (ctx.state === "suspended") void ctx.resume();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.22;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.75);
    });
  } catch {
    // בלי שמע: הקו והצבע עדיין מסמנים שהזמן נגמר.
  }
}

export function clock(totalSeconds: number): string {
  const s = Math.abs(Math.round(totalSeconds));
  return `${totalSeconds < 0 ? "-" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ---------- רשימת שמות (נשמרת בדפדפן הזה בלבד) ---------- */

function useNames(groupId: number) {
  const key = `rezef-names-${groupId}`;
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  });
  const save = useCallback(
    (value: string) => {
      setText(value);
      try {
        localStorage.setItem(key, value);
      } catch {
        // בלי אחסון מקומי הרשימה תישאר רק עד סגירת הדף.
      }
    },
    [key],
  );
  const names = text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { text, names, save };
}

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function NamesEditor({ text, onSave }: { text: string; onSave: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        className="block h-36 w-full resize-none rounded-xl border border-line bg-page/60 px-3 py-2 text-sm outline-none focus:border-blue"
        placeholder="שם בכל שורה"
        defaultValue={text}
        onBlur={(e) => onSave(e.target.value)}
        aria-label="רשימת שמות"
      />
      <p className="text-[0.7rem] text-muted">הרשימה נשמרת רק בדפדפן הזה, ולא נשלחת לשרת.</p>
    </div>
  );
}

/* ---------- חלונית צפה ונגררת ---------- */

function Floating({
  title,
  start,
  onClose,
  pinned,
  onTogglePin,
  onMoved,
  children,
  wide,
}: {
  title: string;
  start: { x: number; y: number };
  onClose: () => void;
  pinned: boolean;
  onTogglePin: (pos: { x: number; y: number }) => void;
  onMoved: (pos: { x: number; y: number }) => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [pos, setPos] = useState(start);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  return (
    <div
      className={`absolute z-40 rounded-3xl border border-line bg-white shadow-2xl ${wide ? "w-[26rem]" : "w-72"} max-w-[calc(100%-1rem)]`}
      style={{ left: pos.x, top: pos.y }}
      dir="rtl"
    >
      <div
        className="flex cursor-grab touch-none items-center gap-2 rounded-t-3xl px-4 py-2.5 active:cursor-grabbing"
        onPointerDown={(e) => {
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current) setPos({ x: Math.max(0, e.clientX - drag.current.dx), y: Math.max(0, e.clientY - drag.current.dy) });
        }}
        onPointerUp={() => {
          // נעוץ: המיקום החדש נשמר רק בסוף הגרירה.
          if (drag.current) {
            drag.current = null;
            if (pinned) onMoved(pos);
          }
        }}
      >
        <h3 className="text-sm font-bold">{title}</h3>
        <button
          type="button"
          className={`btn-icon !p-1 ms-auto ${pinned ? "!bg-blue-soft !text-blue-dark" : ""}`}
          data-tip={pinned ? "נעוץ. לחצו לביטול" : "נעיצה: ייפתח בכל שיעור"}
          data-tip-pos="below"
          aria-label={pinned ? `ביטול נעיצת ${title}` : `נעיצת ${title}`}
          aria-pressed={pinned}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onTogglePin(pos)}
        >
          {pinned ? <PinOff size={16} strokeWidth={2} /> : <Pin size={16} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className="btn-icon !p-1"
          aria-label={`סגירת ${title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}

/* ---------- טיימר חופשי ---------- */

function CountdownTool() {
  const [total, setTotal] = useState(300);
  const [left, setLeft] = useState(300);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const remaining = Math.max(0, (endAt.current - Date.now()) / 1000);
      setLeft(remaining);
      if (remaining <= 0) {
        setRunning(false);
        chime();
      }
    }, 250);
    return () => clearInterval(t);
  }, [running]);

  function preset(minutes: number) {
    setRunning(false);
    setTotal(minutes * 60);
    setLeft(minutes * 60);
  }
  function toggle() {
    if (running) setRunning(false);
    else {
      const from = left <= 0 ? total : left;
      setLeft(from);
      endAt.current = Date.now() + from * 1000;
      setRunning(true);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`text-6xl font-extrabold tabular-nums ${left <= 0 ? "text-coral" : ""}`} role="timer">
        {clock(Math.ceil(left))}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-page">
        <div className="h-full rounded-full bg-blue transition-[width] duration-300" style={{ width: `${total ? (left / total) * 100 : 0}%` }} />
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {[1, 2, 3, 5, 10, 15].map((m) => (
          <button
            key={m}
            className={`rounded-full border px-2.5 py-1 text-xs tabular-nums transition ${total === m * 60 ? "border-blue bg-blue-soft text-blue-dark" : "border-line text-muted"}`}
            onClick={() => preset(m)}
          >
            {m} דק׳
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={toggle}>
          {running ? <Pause size={16} strokeWidth={2} /> : <Play size={16} strokeWidth={2} />}
          {running ? "השהיה" : "התחלה"}
        </button>
        <button className="btn btn-ghost" onClick={() => preset(total / 60)}>
          <RotateCcw size={16} strokeWidth={2} /> איפוס
        </button>
      </div>
    </div>
  );
}

/* ---------- קוביות ---------- */

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`h-20 w-20 ${rolling ? "animate-spin" : ""}`} role="img" aria-label={`קובייה: ${value}`}>
      <rect x="6" y="6" width="88" height="88" rx="20" fill="#fff" stroke="var(--ink)" strokeWidth="4" />
      {PIPS[value].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8.5" fill="var(--ink)" />
      ))}
    </svg>
  );
}

function DiceTool() {
  const [count, setCount] = useState(1);
  const [values, setValues] = useState<number[]>([1]);
  const [rolling, setRolling] = useState(false);

  function roll(n = count) {
    setRolling(true);
    setTimeout(() => {
      setValues(Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)));
      setRolling(false);
    }, 450);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex min-h-20 items-center justify-center gap-3">
        {values.map((v, i) => (
          <Die key={i} value={v} rolling={rolling} />
        ))}
      </div>
      {values.length > 1 && !rolling && <p className="text-sm text-muted tabular-nums">סך הכול: {values.reduce((a, b) => a + b, 0)}</p>}
      <div className="flex items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="מספר הקוביות">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className={`h-8 w-8 rounded-full border text-sm tabular-nums transition ${count === n ? "border-blue bg-blue-soft text-blue-dark" : "border-line text-muted"}`}
              aria-pressed={count === n}
              onClick={() => {
                setCount(n);
                roll(n);
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => roll()} disabled={rolling}>
          <Dices size={16} strokeWidth={2} /> הטלה
        </button>
      </div>
    </div>
  );
}

/* ---------- בוחר שם אקראי ---------- */

function PickerTool({ groupId }: { groupId: number }) {
  const { text, names, save } = useNames(groupId);
  const [editing, setEditing] = useState(names.length === 0);
  const [picked, setPicked] = useState<string[]>([]);
  const [current, setCurrent] = useState("");

  // בלי חזרות: כל אחד נבחר פעם אחת, ורק כשכולם נבחרו מתחילים מחדש.
  function pick() {
    const pool = names.filter((n) => !picked.includes(n));
    const from = pool.length ? pool : names;
    const name = from[Math.floor(Math.random() * from.length)];
    setCurrent(name);
    setPicked(pool.length ? [...picked, name] : [name]);
  }

  if (editing)
    return (
      <div className="flex flex-col gap-2">
        <NamesEditor text={text} onSave={save} />
        <button className="btn btn-primary justify-center" onClick={() => setEditing(false)} disabled={names.length === 0}>
          סיום
        </button>
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex min-h-16 items-center text-center text-4xl font-extrabold">{current || "?"}</div>
      <p className="text-xs text-muted tabular-nums">
        נבחרו {Math.min(picked.length, names.length)} מתוך {names.length}
      </p>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={pick}>
          <Shuffle size={16} strokeWidth={2} /> בחירה
        </button>
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>
          עריכת השמות
        </button>
      </div>
    </div>
  );
}

/* ---------- מחלק קבוצות ---------- */

function GroupsTool({ groupId }: { groupId: number }) {
  const { text, names, save } = useNames(groupId);
  const [editing, setEditing] = useState(names.length === 0);
  const [count, setCount] = useState(4);
  const [groups, setGroups] = useState<string[][]>([]);

  function split(n = count) {
    const order = shuffled(names);
    const out: string[][] = Array.from({ length: Math.min(n, Math.max(1, order.length)) }, () => []);
    order.forEach((name, i) => out[i % out.length].push(name));
    setGroups(out);
  }

  if (editing)
    return (
      <div className="flex flex-col gap-2">
        <NamesEditor text={text} onSave={save} />
        <button className="btn btn-primary justify-center" onClick={() => setEditing(false)} disabled={names.length === 0}>
          סיום
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">קבוצות:</span>
        <div className="flex gap-1" role="group" aria-label="מספר הקבוצות">
          {[2, 3, 4, 5, 6, 8].map((n) => (
            <button
              key={n}
              className={`h-8 w-8 rounded-full border text-sm tabular-nums transition ${count === n ? "border-blue bg-blue-soft text-blue-dark" : "border-line text-muted"}`}
              aria-pressed={count === n}
              onClick={() => {
                setCount(n);
                split(n);
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <button className="btn btn-primary ms-auto" onClick={() => split()}>
          <Shuffle size={16} strokeWidth={2} /> חלוקה
        </button>
      </div>
      {groups.length > 0 && (
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
          {groups.map((g, i) => (
            <div key={i} className="rounded-2xl bg-page p-2.5">
              <p className="mb-1 text-xs font-bold text-blue-dark">קבוצה {i + 1}</p>
              <p className="text-sm leading-relaxed">{g.join(", ")}</p>
            </div>
          ))}
        </div>
      )}
      <button className="self-start text-xs text-muted underline" onClick={() => setEditing(true)}>
        עריכת השמות ({names.length})
      </button>
    </div>
  );
}

/* ---------- מצב עבודה ---------- */

const MODES = [
  { name: "שקט", icon: VolumeX, color: "#e5484d" },
  { name: "לחישה", icon: Volume1, color: "#f2702f" },
  { name: "בזוגות", icon: Users, color: "#0e9f8a" },
  { name: "בקבוצות", icon: UsersRound, color: "#4f6cd6" },
] as const;

function ModeTool() {
  const [mode, setMode] = useState<number | null>(null);
  const active = mode != null ? MODES[mode] : null;
  return (
    <div className="flex flex-col items-center gap-3">
      {active && (
        <div className="flex flex-col items-center gap-1" style={{ color: active.color }}>
          <active.icon size={84} strokeWidth={2} />
          <p className="text-2xl font-extrabold">{active.name}</p>
        </div>
      )}
      <div className="flex gap-1.5">
        {MODES.map((m, i) => (
          <button
            key={m.name}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${mode === i ? "border-transparent text-white" : "border-line text-muted hover:border-blue"}`}
            style={mode === i ? { background: m.color } : undefined}
            data-tip={m.name}
            aria-label={m.name}
            aria-pressed={mode === i}
            onClick={() => setMode(mode === i ? null : i)}
          >
            <m.icon size={20} strokeWidth={2} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- סרגל הכלים והחלוניות ---------- */

const TOOLS = [
  { key: "timer", label: "טיימר", icon: Timer, wide: false },
  { key: "dice", label: "קוביות", icon: Dices, wide: false },
  { key: "picker", label: "בחירת תלמיד אקראי", icon: UserRound, wide: false },
  { key: "groups", label: "חלוקה לקבוצות", icon: UsersRound, wide: true },
  { key: "mode", label: "מצב עבודה", icon: VolumeX, wide: false },
] as const;
type ToolKey = (typeof TOOLS)[number]["key"];

type Pos = { x: number; y: number };

function readPins(groupId: number): Record<string, Pos> {
  try {
    const raw = JSON.parse(localStorage.getItem(`rezef-pins-${groupId}`) ?? "[]");
    const out: Record<string, Pos> = {};
    if (Array.isArray(raw))
      for (const p of raw) {
        if (p && TOOLS.some((t) => t.key === p.key) && Number.isFinite(p.x) && Number.isFinite(p.y)) out[p.key] = { x: Math.max(0, p.x), y: Math.max(0, p.y) };
      }
    return out;
  } catch {
    return {};
  }
}

function writePins(groupId: number, pins: Record<string, Pos>) {
  try {
    localStorage.setItem(`rezef-pins-${groupId}`, JSON.stringify(Object.entries(pins).map(([key, p]) => ({ key, x: p.x, y: p.y }))));
  } catch {
    // בלי אחסון מקומי הנעיצה תחזיק רק עד סגירת מצב השיעור.
  }
}

// מצב החלוניות: אילו פתוחות ואילו נעוצות (נעוצות נפתחות מעצמן, במקום ששמרנו, בכל שיעור בקבוצה).
export function useToolWindows(groupId: number) {
  const [pins, setPins] = useState<Record<string, Pos>>(() => readPins(groupId));
  const [open, setOpen] = useState<Set<string>>(() => new Set(Object.keys(readPins(groupId))));

  const toggle = useCallback((key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // סגירה בלבד: הנעיצה נשארת והחלונית תחזור בפעם הבאה.
  const close = useCallback((key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const setPin = useCallback(
    (key: string, pos: Pos | null) => {
      const next = { ...pins };
      if (pos) next[key] = pos;
      else delete next[key];
      setPins(next);
      writePins(groupId, next);
    },
    [pins, groupId],
  );

  return { open, pins, toggle, close, setPin };
}
export type ToolWindowsState = ReturnType<typeof useToolWindows>;

export function ToolButtons({
  open,
  onToggle,
  drawing,
  onDraw,
  onBlackout,
}: {
  open: Set<string>;
  onToggle: (key: string) => void;
  drawing: boolean;
  onDraw: () => void;
  onBlackout: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-white/85 px-1 py-1 shadow-md backdrop-blur" role="toolbar" aria-label="כלי כיתה">
      {TOOLS.map((t) => (
        <button
          key={t.key}
          className={`btn-icon !p-2 ${open.has(t.key) ? "!bg-blue-soft !text-blue-dark" : ""}`}
          data-tip={t.label}
          data-tip-pos="below"
          aria-label={t.label}
          aria-pressed={open.has(t.key)}
          onClick={() => onToggle(t.key)}
        >
          <t.icon size={18} strokeWidth={2} />
        </button>
      ))}
      <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />
      <button
        className={`btn-icon !p-2 ${drawing ? "!bg-orange/15 !text-orange" : ""}`}
        data-tip="ציור על המסך"
        data-tip-pos="below"
        aria-label="ציור על המסך"
        aria-pressed={drawing}
        onClick={onDraw}
      >
        <Pencil size={18} strokeWidth={2} />
      </button>
      <button className="btn-icon !p-2" data-tip="חושך: כיבוי זמני של המסך" data-tip-pos="below" aria-label="חושך" onClick={onBlackout}>
        <Moon size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

export function ToolWindows({ state, groupId }: { state: ToolWindowsState; groupId: number }) {
  const { open, pins, close, setPin } = state;
  const body: Record<ToolKey, React.ReactNode> = {
    timer: <CountdownTool />,
    dice: <DiceTool />,
    picker: <PickerTool groupId={groupId} />,
    groups: <GroupsTool groupId={groupId} />,
    mode: <ModeTool />,
  };
  return (
    <>
      {TOOLS.filter((t) => open.has(t.key)).map((t, i) => (
        <Floating
          key={t.key}
          title={t.label}
          wide={t.wide}
          start={pins[t.key] ?? { x: 24 + i * 36, y: 72 + i * 28 }}
          onClose={() => close(t.key)}
          pinned={t.key in pins}
          onTogglePin={(pos) => setPin(t.key, t.key in pins ? null : pos)}
          onMoved={(pos) => setPin(t.key, pos)}
        >
          {body[t.key]}
        </Floating>
      ))}
    </>
  );
}

/* ---------- שכבת ציור ---------- */

const PEN_COLORS = ["#1b1d22", "#e5484d", "#4f6cd6", "#0e9f8a", "#f2a413"];

// הציור נשמר לכל שלב בשיעור בנפרד (לפי pageKey), כל עוד מצב השיעור פתוח.
export function DrawLayer({ active, pageKey, fileName, lessonId }: { active: boolean; pageKey: string; fileName: string; lessonId: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pages = useRef(new Map<string, string>());
  const undo = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(PEN_COLORS[1]);
  const [erase, setErase] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [shared, setShared] = useState<"idle" | "busy" | "done" | "error">("idle");

  // התאמת גודל הקנבס לבמה, בלי לאבד את מה שצויר.
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const fit = () => {
      const keep = canvas.width && canvas.height ? canvas.toDataURL() : null;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(parent.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(parent.clientHeight * ratio));
      if (keep) {
        const img = new Image();
        img.onload = () => canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = keep;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // מעבר בין שלבי השיעור: שומרים את הציור של השלב שעוזבים, וטוענים את של השלב החדש.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undo.current = [];
    const saved = pages.current.get(pageKey);
    setHasInk(Boolean(saved));
    if (saved) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = saved;
    }
    const store = pages.current;
    return () => {
      if (canvas.width) store.set(pageKey, canvas.toDataURL());
    };
  }, [pageKey]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width, y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.setPointerCapture(e.pointerId);
    undo.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undo.current.length > 15) undo.current.shift();
    last.current = point(e);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    const ratio = window.devicePixelRatio || 1;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = (erase ? 28 : 4) * ratio;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  }
  function up() {
    last.current = null;
  }
  function undoLast() {
    const canvas = canvasRef.current;
    const prev = undo.current.pop();
    if (canvas && prev) canvas.getContext("2d")?.putImageData(prev, 0, 0);
  }
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    undo.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }
  // שמירת הלוח כתמונה (על רקע לבן), להעלאה או לשליחה לתלמידים.
  // הלוח על רקע לבן, מוקטן לרוחב נתון (הקנבס עצמו שקוף ובצפיפות המסך).
  function flatten(maxWidth: number): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const scale = Math.min(1, maxWidth / canvas.width);
    const out = document.createElement("canvas");
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out;
  }
  function download() {
    const out = flatten(4000);
    if (!out) return;
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `${fileName}.png`;
    a.click();
  }
  // "תצוגת לוח": התמונה נשמרת בשיעור, והתלמידים רואים אותה בדף הקבוצה (כשהשיעור פתוח להם).
  async function share() {
    const out = flatten(1400);
    if (!out) return;
    setShared("busy");
    try {
      const res = await fetch(`/api/lessons/${lessonId}/boards`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: out.toDataURL("image/webp", 0.8) }),
      });
      if (!res.ok) throw new Error();
      setShared("done");
    } catch {
      setShared("error");
    }
    setTimeout(() => setShared("idle"), 2500);
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-20 h-full w-full touch-none ${active ? "cursor-crosshair" : "pointer-events-none"}`}
        onPointerDown={active ? down : undefined}
        onPointerMove={active ? move : undefined}
        onPointerUp={up}
        onPointerCancel={up}
        aria-hidden={!active}
      />
      {active && (
        <div
          // מעל צ'יפ הטיימר של הפריט (שיושב ב-bottom-3), כדי שלא יתנגשו.
          className="absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/90 px-2 py-1.5 shadow-xl backdrop-blur"
          role="toolbar"
          aria-label="כלי ציור"
        >
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              className={`h-7 w-7 rounded-full border-2 transition ${!erase && color === c ? "border-ink scale-110" : "border-white"}`}
              style={{ background: c }}
              aria-label={`צבע ${c}`}
              aria-pressed={!erase && color === c}
              onClick={() => {
                setColor(c);
                setErase(false);
              }}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <button className={`btn-icon !p-1.5 ${erase ? "!bg-blue-soft !text-blue-dark" : ""}`} data-tip="מחק" aria-label="מחק" aria-pressed={erase} onClick={() => setErase((v) => !v)}>
            <Eraser size={18} strokeWidth={2} />
          </button>
          <button className="btn-icon !p-1.5" data-tip="ביטול הפעולה האחרונה" aria-label="ביטול" onClick={undoLast}>
            <Undo2 size={18} strokeWidth={2} />
          </button>
          <button className="btn-icon !p-1.5" data-tip="ניקוי הלוח" aria-label="ניקוי הלוח" onClick={clear}>
            <Trash2 size={18} strokeWidth={2} />
          </button>
          <button className="btn-icon !p-1.5" data-tip="הורדת הלוח כתמונה" aria-label="הורדת הלוח כתמונה" onClick={download} disabled={!hasInk}>
            <ImageDown size={18} strokeWidth={2} />
          </button>
          <button
            className={`btn-icon !p-1.5 ${shared === "done" ? "!text-green-600" : shared === "error" ? "!text-coral" : ""}`}
            data-tip={shared === "done" ? "הלוח נשמר לתלמידים" : shared === "error" ? "השמירה נכשלה" : "שמירת הלוח לתלמידים"}
            aria-label="שמירת הלוח לתלמידים"
            onClick={share}
            disabled={!hasInk || shared === "busy"}
          >
            <GraduationCap size={18} strokeWidth={2} />
          </button>
        </div>
      )}
    </>
  );
}
