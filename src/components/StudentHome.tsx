"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LogIn, LogOut, Users } from "lucide-react";

type Me = {
  signedIn: boolean;
  googleReady: boolean;
  devLogin: boolean;
  groups: Array<{ id: number; name: string; subjectName: string | null; nickname: string; teacher: string }>;
};

const ERRORS: Record<string, string> = {
  domain: "אפשר להיכנס רק עם חשבון Google של בית הספר. חשבון פרטי לא מתאים.",
  "not-ready": "הכניסה לתלמידים עדיין לא הופעלה. נסו שוב בקרוב.",
  login: "הכניסה לא הושלמה. נסו שוב.",
};

export default function StudentHome({ error }: { error: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState("");

  const load = useCallback(() => {
    fetch("/api/student/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Me) => setMe(d))
      .catch(() => setLoadError("לא הצלחנו לטעון. נסו לרענן את הדף."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setJoinError("");
    try {
      const res = await fetch("/api/student/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, nickname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "ההצטרפות נכשלה");
      window.location.href = `/s/g/${data.groupId}`;
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "ההצטרפות נכשלה");
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/student/auth/logout", { method: "POST" }).catch(() => {});
    load();
  }

  if (loadError) return <p className="p-10 text-coral">{loadError}</p>;
  if (!me) return <p className="p-10 text-muted">טוענים…</p>;

  if (!me.signedIn)
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-5 py-14 text-center">
        <h1 className="text-3xl font-extrabold">כניסת תלמידים</h1>
        <p className="text-muted">נכנסים עם חשבון Google של בית הספר, ומצטרפים לקבוצה עם הקוד שקיבלתם מהמורה.</p>
        {error && ERRORS[error] && (
          <p className="rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">
            {ERRORS[error]}
          </p>
        )}
        <a className="btn btn-primary justify-center !py-3 text-lg" href="/api/student/auth/start">
          <LogIn size={20} strokeWidth={2} /> כניסה עם Google של בית הספר
        </a>
        {!me.googleReady && <p className="text-xs text-muted">הכניסה לתלמידים עדיין לא הופעלה במערכת.</p>}
        {me.devLogin && (
          <a className="btn btn-ghost justify-center" href="/api/student/auth/dev">
            כניסת תלמיד לדוגמה (פיתוח מקומי)
          </a>
        )}
        <p className="text-xs text-muted">אנחנו לא שומרים את השם או את כתובת המייל שלכם. בקבוצה תופיעו בכינוי שתבחרו.</p>
      </main>
    );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-10">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-extrabold">הקבוצות שלי</h1>
        <button className="btn btn-ghost ms-auto" onClick={logout}>
          <LogOut size={16} strokeWidth={2} /> יציאה
        </button>
      </div>

      {me.groups.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {me.groups.map((g) => (
            <li key={g.id}>
              <a
                href={`/s/g/${g.id}`}
                className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4 transition hover:border-blue hover:shadow-sm"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue-dark">
                  <Users size={20} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold">{g.name}</span>
                  <span className="block truncate text-sm text-muted">
                    {[g.subjectName, g.teacher, `הכינוי שלי: ${g.nickname}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <ArrowLeft size={18} strokeWidth={2} className="shrink-0 text-muted" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-3xl border border-dashed border-line bg-white/60 p-6 text-center text-muted">
          עדיין לא הצטרפתם לקבוצה. הזינו את הקוד שקיבלתם מהמורה.
        </p>
      )}

      <form onSubmit={join} className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-5">
        <h2 className="text-lg font-bold">הצטרפות לקבוצה</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted">קוד הקבוצה</span>
            <input
              className="field font-mono tracking-widest uppercase"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={12}
              required
              autoComplete="off"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted" data-tip="כינוי, ולא השם המלא. המורה רואה אותו ויכולה לשנות אותו">
              כינוי
            </span>
            <input className="field" value={nickname} onChange={(e) => setNickname(e.target.value)} minLength={2} maxLength={24} required autoComplete="off" />
          </label>
        </div>
        {joinError && (
          <p className="text-sm text-coral" role="alert">
            {joinError}
          </p>
        )}
        <button className="btn btn-primary self-start" disabled={busy}>
          {busy ? "מצטרפים…" : "הצטרפות"}
        </button>
      </form>
    </main>
  );
}
