"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GraduationCap, LayoutGrid, LogIn, LogOut, Settings } from "lucide-react";

type Who =
  | { kind: "loading" }
  | { kind: "teacher"; name: string; isAdmin: boolean }
  | { kind: "student"; groups: number }
  | { kind: "guest" };

// כפתור כניסה או פרופיל בראש כל דף: מורה (עם קישור לניהול אם היא מנהלת), תלמיד, או אורח.
export default function HeaderAuth() {
  const [who, setWho] = useState<Who>({ kind: "loading" });
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const t = await fetch("/api/auth/me");
        if (t.ok) {
          const d = (await t.json()) as { teacher: { displayName: string; isAdmin?: boolean } };
          if (!stale) setWho({ kind: "teacher", name: d.teacher.displayName, isAdmin: Boolean(d.teacher.isAdmin) });
          return;
        }
        const s = await fetch("/api/student/me");
        if (s.ok) {
          const d = (await s.json()) as { signedIn: boolean; groups: unknown[] };
          if (!stale) setWho(d.signedIn ? { kind: "student", groups: d.groups.length } : { kind: "guest" });
          return;
        }
      } catch {
        // בלי רשת הכפתורים של אורח עדיין מובילים לכניסה.
      }
      if (!stale) setWho({ kind: "guest" });
    })();
    return () => {
      stale = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await fetch(who.kind === "student" ? "/api/student/auth/logout" : "/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  }

  if (who.kind === "loading") return <span className="h-9 w-24" aria-hidden />;

  if (who.kind === "guest")
    return (
      <div className="flex items-center gap-2">
        <Link href="/s" className="btn btn-ghost !py-1.5" data-tip="תלמידים נכנסים עם חשבון Google של בית הספר">
          <GraduationCap size={16} strokeWidth={2} /> כניסת תלמידים
        </Link>
        <a href="/api/auth/start" className="btn btn-primary !py-1.5" data-tip="מורים נכנסים עם החשבון שלהם בחומר פתוח">
          <LogIn size={16} strokeWidth={2} /> כניסת מורים
        </a>
      </div>
    );

  const label = who.kind === "teacher" ? who.name : "תלמיד/ה";
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pe-3 ps-1 transition hover:border-blue"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue text-sm font-bold text-white" aria-hidden>
          {label.trim().charAt(0) || "?"}
        </span>
        <span className="max-w-32 truncate text-sm font-medium">{label}</span>
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white py-1 shadow-xl">
          <p className="px-4 py-2 text-xs text-muted">{who.kind === "teacher" ? (who.isAdmin ? "מורה ומנהלת" : "מורה") : "תלמיד/ה"}</p>
          {who.kind === "teacher" ? (
            <Link role="menuitem" href="/" className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-blue-soft" onClick={() => setOpen(false)}>
              <LayoutGrid size={16} strokeWidth={2} /> הקבוצות שלי
            </Link>
          ) : (
            <Link role="menuitem" href="/s" className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-blue-soft" onClick={() => setOpen(false)}>
              <LayoutGrid size={16} strokeWidth={2} /> הקבוצות שלי
            </Link>
          )}
          {who.kind === "teacher" && who.isAdmin && (
            <Link role="menuitem" href="/admin" className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-blue-soft" onClick={() => setOpen(false)}>
              <Settings size={16} strokeWidth={2} /> ניהול
            </Link>
          )}
          <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 px-4 py-2 text-start text-sm hover:bg-blue-soft" onClick={logout}>
            <LogOut size={16} strokeWidth={2} /> יציאה
          </button>
        </div>
      )}
    </div>
  );
}
