"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";

type Group = {
  id: number;
  name: string;
  className: string | null;
  subjectName: string | null;
  schoolYear: string;
  joinCode: string;
};

export default function Dashboard() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [error, setError] = useState("");
  const [loggedOut, setLoggedOut] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  async function load() {
    const res = await fetch("/api/groups");
    if (res.status === 401) {
      setLoggedOut(true);
      setGroups([]);
      return;
    }
    if (!res.ok) {
      setError("לא הצלחנו לטעון את הקבוצות");
      setGroups([]);
      return;
    }
    setGroups((await res.json()).groups);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, className, subjectName }),
    });
    if (!res.ok) {
      setError("לא הצלחנו ליצור את הקבוצה");
      return;
    }
    setName("");
    setClassName("");
    setSubjectName("");
    setCreating(false);
    await load();
  }

  if (loggedOut) {
    const failed = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("login_error");
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-3xl font-extrabold mb-3">הרצף של חומר פתוח</h1>
        <p className="text-muted mb-8">נכנסים עם החשבון שלכם בחומר פתוח.</p>
        <a href="/api/auth/start" className="btn btn-primary">
          כניסה עם חומר פתוח
        </a>
        {failed && <p className="text-coral mt-6">הכניסה לא הושלמה. אפשר לנסות שוב.</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold">הקבוצות שלי</h1>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
            <Plus size={18} strokeWidth={2} /> קבוצה חדשה
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            יציאה
          </button>
        </div>
      </div>

      {creating && (
        <form onSubmit={create} className="bg-white border border-line rounded-3xl p-5 mb-8 grid gap-3 md:grid-cols-4">
          <input className="field md:col-span-2" placeholder="שם הקבוצה" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <input className="field" placeholder="כיתה" value={className} onChange={(e) => setClassName(e.target.value)} />
          <input className="field" placeholder="תחום דעת" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
          <div className="md:col-span-4 flex gap-2">
            <button className="btn btn-primary" type="submit">
              יצירה
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setCreating(false)}>
              ביטול
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-coral mb-4">{error}</p>}

      {groups === null ? (
        <p className="text-muted">טוענים…</p>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-dashed border-line rounded-3xl p-12 text-center">
          <p className="text-xl font-medium mb-2">עוד אין קבוצות</p>
          <p className="text-muted">פותחים קבוצה אחת ומתחילים לתלות עליה שיעורים.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/g/${g.id}`}
              className="group bg-white border border-line rounded-3xl p-6 hover:border-blue hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-bold">{g.name}</h2>
                <ArrowLeft className="text-muted group-hover:text-blue transition" size={20} strokeWidth={2} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {g.className && <span className="rounded-full bg-blue-soft text-blue-dark px-3 py-1">כיתה {g.className}</span>}
                {g.subjectName && <span className="rounded-full bg-blue-soft text-blue-dark px-3 py-1">{g.subjectName}</span>}
                <span className="rounded-full bg-page text-muted px-3 py-1">{g.schoolYear}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
