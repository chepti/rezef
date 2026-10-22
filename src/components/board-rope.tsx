"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ציר הניווט: חיצים בקצוות, והקו עצמו נגרר ימינה ושמאלה כמו חבל שמזיז את השיעורים.
// כל הכיוונים בהנחת RTL, שבו scrollLeft הוא 0 בהתחלה (ימין) ושלילי ככל שמתקדמים שמאלה.
export default function Rope({ scrollRef, watchKey }: { scrollRef: RefObject<HTMLDivElement | null>; watchKey: unknown }) {
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const drag = useRef<{ x: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pos = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(pos > 1);
    setCanNext(pos < max - 1);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [scrollRef, update, watchKey]);

  function page(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    // direction 1 = קדימה (שמאלה, scrollLeft יורד)
    el.scrollBy({ left: -direction * Math.max(320, el.clientWidth * 0.8), behavior: "smooth" });
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = scrollRef.current;
    if (!drag.current || !el) return;
    const dx = e.clientX - drag.current.x;
    drag.current.x = e.clientX;
    // גוררים את החבל ימינה: התוכן זז ימינה, כלומר החלון נע שמאלה (scrollLeft יורד).
    el.scrollLeft -= dx;
  }
  function onPointerUp() {
    drag.current = null;
    setDragging(false);
  }

  const arrow = (enabled: boolean) =>
    `btn-icon !p-2 bg-white border border-line shadow-sm ${enabled ? "!text-blue-dark" : "opacity-35 pointer-events-none"}`;

  return (
    <div className="flex items-center gap-2 py-1">
      <button className={arrow(canPrev)} data-tip="חזרה" aria-label="שיעורים קודמים" onClick={() => page(-1)}>
        <ChevronRight size={18} strokeWidth={2} />
      </button>
      <div
        className={`group flex-1 h-7 flex items-center touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-tip="גררו את החבל כדי להזיז"
        role="presentation"
      >
        <div className={`w-full border-t-2 border-dashed transition-all ${dragging ? "border-blue" : "border-blue/45 group-hover:border-blue"}`} />
      </div>
      <button className={arrow(canNext)} data-tip="הבא" aria-label="שיעורים הבאים" onClick={() => page(1)}>
        <ChevronLeft size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
