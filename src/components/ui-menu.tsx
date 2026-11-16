"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Close = () => void;

// תפריט נפתח: כפתור אחד שמחליף שורה של אייקונים. החלונית מוצגת מעל הכול (portal + fixed),
// כדי שלא תיחתך בתוך אזורי גלילה, ונסגרת בלחיצה בחוץ, ב-Esc או בגלילה.
export function Menu({
  button,
  buttonClass,
  ariaLabel,
  tip,
  width = 224,
  children,
}: {
  button: React.ReactNode;
  buttonClass?: string;
  ariaLabel: string;
  tip?: string;
  width?: number;
  children: (close: Close) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  // מיקום: מתחת לכפתור ומיושר לקצה שלו; אם אין מקום למטה, מעליו. תמיד בתוך המסך.
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const r = trigger.current.getBoundingClientRect();
    const h = panel.current?.offsetHeight ?? 0;
    const below = r.bottom + 6;
    const top = below + h > window.innerHeight - 8 && r.top - 6 - h > 8 ? r.top - 6 - h : below;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos({ top, left });
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onScroll = (e: Event) => !panel.current?.contains(e.target as Node) && close();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={buttonClass ?? "btn-icon !p-1.5"}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tip={open ? undefined : tip}
        // הכפתור יושב לפעמים בתוך אלמנט נגרר: לחיצה עליו לא מתחילה גרירה.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((v) => !v)}
      >
        {button}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            dir="rtl"
            className="fixed z-[200] overflow-hidden rounded-2xl border border-line bg-white py-1 shadow-xl"
            style={{ width, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({
  icon,
  label,
  hint,
  danger,
  checked,
  disabled,
  onSelect,
  href,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  // קישור שנפתח בלשונית חדשה (במקום פעולה).
  href?: string;
}) {
  const cls = `flex w-full items-center gap-2.5 px-3.5 py-2 text-start text-sm transition ${
    disabled ? "opacity-50" : danger ? "text-coral hover:bg-coral/10" : "hover:bg-blue-soft"
  }`;
  const body = (
    <>
      {icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      {checked && <Check size={16} strokeWidth={2} className="shrink-0 text-blue-dark" />}
    </>
  );
  if (href)
    return (
      <a role="menuitem" className={cls} href={href} target="_blank" rel="noopener noreferrer" onClick={onSelect}>
        {body}
      </a>
    );
  return (
    <button type="button" role="menuitem" className={cls} disabled={disabled} onClick={onSelect}>
      {body}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-line" role="separator" />;
}

// בורר ערך אחד מתוך כמה (סוג, שלב, זמן): גלולה עם שם השדה או הערך שנבחר, שנפתחת לרשימה עם שמות מלאים.
export function PickPill<K extends string>({
  label,
  value,
  options,
  onPick,
  clearLabel,
  tone = "blue",
}: {
  label: string;
  value: K | null;
  options: ReadonlyArray<{ key: K; label: string; icon?: React.ReactNode }>;
  onPick: (key: K | null) => void;
  // כשמוגדר: אפשרות ראשונה שמנקה את הבחירה.
  clearLabel?: string;
  tone?: "blue" | "orange" | "ink";
}) {
  const current = options.find((o) => o.key === value);
  const on = tone === "orange" ? "border-orange/50 bg-orange/10 text-orange" : tone === "ink" ? "border-line bg-page text-ink" : "border-blue/40 bg-blue-soft text-blue-dark";
  return (
    <Menu
      ariaLabel={current ? `${label}: ${current.label}` : label}
      width={200}
      buttonClass={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        current ? on : "border-line bg-white text-muted hover:border-blue"
      }`}
      button={
        <>
          {current?.icon}
          {current ? current.label : label}
          <ChevronDown size={12} strokeWidth={2} className="opacity-60" />
        </>
      }
    >
      {(close) => (
        <>
          <p className="px-3.5 pb-1 pt-1.5 text-xs text-muted">{label}</p>
          {clearLabel && value !== null && (
            <MenuItem
              label={clearLabel}
              onSelect={() => {
                onPick(null);
                close();
              }}
            />
          )}
          {options.map((o) => (
            <MenuItem
              key={o.key}
              icon={o.icon}
              label={o.label}
              checked={o.key === value}
              onSelect={() => {
                onPick(o.key);
                close();
              }}
            />
          ))}
        </>
      )}
    </Menu>
  );
}
