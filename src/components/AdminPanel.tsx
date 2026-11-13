"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Archive, ArchiveRestore, BarChart3, Building2, Check, GraduationCap, Plus, Settings, ShieldOff, ShieldCheck, Trash2, Users, UsersRound } from "lucide-react";

type Section = "overview" | "domains" | "teachers" | "groups" | "settings";

const MENU: Array<{ key: Section; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { key: "overview", label: "סקירה", icon: BarChart3 },
  { key: "domains", label: "דומיינים לתלמידים", icon: Building2 },
  { key: "teachers", label: "מורים", icon: Users },
  { key: "groups", label: "קבוצות", icon: UsersRound },
  { key: "settings", label: "הגדרות", icon: Settings },
];

async function call<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? (res.status >= 500 ? "השרת לא ענה כרגע" : "הפעולה נכשלה"));
  return data as T;
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" }) : "אף פעם");

function Card({ title, children, tip }: { title?: string; children: React.ReactNode; tip?: string }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5">
      {title && (
        <h2 className="mb-3 text-lg font-extrabold" data-tip={tip}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-page px-4 py-3">
      <p className="text-3xl font-extrabold tabular-nums">{typeof value === "number" ? value.toLocaleString("he-IL") : value}</p>
      <p className="text-sm text-muted">{label}</p>
      {sub && <p className="text-xs text-blue-dark">{sub}</p>}
    </div>
  );
}

/* ---------- סקירה ---------- */

type Overview = {
  totals: Record<string, number>;
  recent: Record<string, number>;
  series: Array<{ day: string; items: number; submissions: number }>;
  subjects: Array<{ name: string | null; n: number }>;
  types: Array<{ name: string; n: number }>;
  sites: Array<{ name: string; n: number }>;
  storage: { files: number; bytes: number };
};

function Bars({ rows }: { rows: Array<{ name: string; n: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="text-sm text-muted">עדיין אין נתונים.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.name} className="flex items-center gap-2 text-sm">
          <span className="w-32 shrink-0 truncate">{r.name}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-page">
            <span className="block h-full rounded-full bg-blue" style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="w-8 text-end tabular-nums text-muted">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}

function OverviewSection() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    call<Overview>("/api/admin/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="text-coral">{error}</p>;
  if (!data) return <p className="text-muted">טוענים…</p>;
  const { totals: t, recent: r } = data;
  const max = Math.max(1, ...data.series.map((s) => Math.max(s.items, s.submissions)));
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="מורים" value={t.teachers} sub={`${r.teachersActive7} פעילות ב-7 ימים, ${r.teachersNew7} חדשות`} />
        <Stat label="קבוצות פעילות" value={t.activeGroups} sub={`${r.groupsNew30} חדשות ב-30 יום`} />
        <Stat label="שיעורים" value={t.lessons} sub={`${t.openLessons} פתוחים לתלמידים`} />
        <Stat label="פריטים ברצפים" value={t.lessonItems} sub={`${r.itemsNew7} נוספו בשבוע האחרון`} />
        <Stat label="תלמידים" value={t.students} sub={`${r.studentsNew7} חדשים בשבוע`} />
        <Stat label="הצטרפויות לקבוצות" value={t.memberships} />
        <Stat label="הגשות" value={t.submissions} sub={`${r.submissions7} בשבוע, ${t.helpRequests} בקשות עזרה`} />
        <Stat label="לוחות שנשמרו לתלמידים" value={t.boards} />
      </div>

      <Card title="פעילות ב-30 הימים האחרונים" tip="פריטים שנוספו (כחול) והגשות של תלמידים (כתום), לפי יום">
        <div className="flex h-32 items-end gap-1" role="img" aria-label="גרף פעילות יומי">
          {data.series.map((s) => (
            <div key={s.day} className="flex h-full flex-1 flex-col justify-end gap-0.5" data-tip={`${s.day}: ${s.items} פריטים, ${s.submissions} הגשות`}>
              <span className="w-full rounded-t bg-orange/80" style={{ height: `${(s.submissions / max) * 50}%` }} />
              <span className="w-full rounded-t bg-blue" style={{ height: `${(s.items / max) * 50}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{data.series[0]?.day.slice(5)}</span>
          <span>{data.series[data.series.length - 1]?.day.slice(5)}</span>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card title="תחומי דעת">
          <Bars rows={data.subjects.map((s) => ({ name: s.name ?? "ללא", n: s.n }))} />
        </Card>
        <Card title="סוגי תוכן">
          <Bars rows={data.types} />
        </Card>
        <Card title="אתרים שמורים מדביקים" tip="קישורים חיצוניים (בלי חומר פתוח)">
          <Bars rows={data.sites} />
        </Card>
      </div>

      <Card title="קשר לחומר פתוח ואחסון">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="פריטים מחומר פתוח" value={t.openstuffItems} />
          <Stat label="פריטים שפורסמו מהרצף" value={t.publishedItems} />
          <Stat label="שיעורים שפורסמו כאוסף" value={t.publishedLessons} />
          <Stat label="תמונות שהועלו" value={data.storage.files} sub={`${(data.storage.bytes / 1024 / 1024).toFixed(1)} MB`} />
          <Stat label="פריטי תמונה" value={t.imageItems} />
        </div>
      </Card>
    </div>
  );
}

/* ---------- דומיינים ---------- */

type DomainRow = { domain: string; region: string | null; note: string | null; students: number };
type Domains = { domains: DomainRow[]; orphaned: Array<{ domain: string; students: number }> };

function DomainsSection() {
  const [data, setData] = useState<Domains | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(() => {
    call<Domains>("/api/admin/domains")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult("");
    try {
      const r = await call<{ added: string[]; rejected: string[]; existing: number }>("/api/admin/domains", "POST", { text, note: note || undefined });
      setResult(
        [r.added.length ? `נוספו ${r.added.length}` : null, r.existing ? `${r.existing} כבר היו ברשימה` : null, r.rejected.length ? `לא תקינים: ${r.rejected.join(", ")}` : null]
          .filter(Boolean)
          .join(". ") || "לא נוסף דבר",
      );
      if (r.added.length || r.existing) setText("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההוספה נכשלה");
    }
  }

  async function remove(d: DomainRow) {
    const warn = d.students > 0 ? ` ${d.students} תלמידים כבר נכנסו מהדומיין הזה. הם יישארו בקבוצות, אבל לא יוכלו להיכנס שוב.` : "";
    if (!window.confirm(`להסיר את ${d.domain} מהרשימה?${warn}`)) return;
    try {
      await call(`/api/admin/domains/${encodeURIComponent(d.domain)}`, "DELETE");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ההסרה נכשלה");
    }
  }

  async function saveNote(d: DomainRow, value: string) {
    if ((d.note ?? "") === value) return;
    try {
      await call(`/api/admin/domains/${encodeURIComponent(d.domain)}`, "PATCH", { note: value || null });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "השמירה נכשלה");
    }
  }

  const rows = data?.domains.filter((d) => d.domain.includes(filter.trim().toLowerCase()) || (d.note ?? "").includes(filter.trim())) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Card title="הוספת דומיינים" tip="תלמיד יכול להיכנס רק עם חשבון Google של דומיין מהרשימה הזו">
        <form onSubmit={add} className="flex flex-col gap-2">
          <textarea
            className="block min-h-24 w-full resize-y rounded-2xl border border-line bg-page/60 px-3 py-2 font-mono text-sm outline-none focus:border-blue"
            dir="ltr"
            placeholder={"school.org.il\nanother-domain.co.il"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="דומיינים להוספה"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input className="field !w-64" placeholder="הערה (למשל: מחוז צפון)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
            <button className="btn btn-primary" type="submit" disabled={text.trim().length < 3}>
              <Plus size={16} strokeWidth={2} /> הוספה
            </button>
            <span className="text-xs text-muted">אפשר להדביק כמה בבת אחת. גם כתובת מייל או קישור מתקבלים, ונשמר רק הדומיין.</span>
          </div>
          {result && (
            <p className="text-sm text-green-700" role="status">
              {result}
            </p>
          )}
          {error && <p className="text-sm text-coral">{error}</p>}
        </form>
      </Card>

      <Card title={`דומיינים מותרים${data ? ` (${data.domains.length})` : ""}`}>
        <input className="field mb-3 !w-64" placeholder="סינון" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="סינון דומיינים" />
        {!data && <p className="text-muted">טוענים…</p>}
        <ul className="divide-y divide-line">
          {rows.map((d) => (
            <li key={d.domain} className="flex flex-wrap items-center gap-3 py-2">
              <span className="w-64 shrink-0 truncate font-mono text-sm" dir="ltr">
                {d.domain}
              </span>
              <input
                className="field !w-64 !py-1 text-sm"
                defaultValue={d.note ?? ""}
                placeholder="הערה"
                maxLength={120}
                onBlur={(e) => saveNote(d, e.target.value.trim())}
                aria-label={`הערה ל-${d.domain}`}
              />
              <span className="inline-flex items-center gap-1 text-sm text-muted tabular-nums" data-tip="תלמידים שנכנסו מהדומיין">
                <GraduationCap size={15} strokeWidth={2} /> {d.students}
              </span>
              <button className="btn-icon ms-auto" aria-label={`הסרת ${d.domain}`} data-tip="הסרה" onClick={() => remove(d)}>
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
        {data && rows.length === 0 && <p className="text-sm text-muted">לא נמצאו דומיינים.</p>}
      </Card>

      {data && data.orphaned.length > 0 && (
        <Card title="תלמידים מדומיינים שהוסרו">
          <p className="mb-2 text-sm text-muted">התלמידים האלה כבר בקבוצות, אבל הדומיין שלהם לא ברשימה, ולכן לא יוכלו להיכנס שוב. אפשר להחזיר את הדומיין.</p>
          <ul className="flex flex-wrap gap-2">
            {data.orphaned.map((o) => (
              <li key={o.domain} className="rounded-full bg-page px-3 py-1 font-mono text-sm" dir="ltr">
                {o.domain} · {o.students}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ---------- מורים ---------- */

type TeacherRow = {
  id: number;
  displayName: string;
  wpUserId: number | null;
  isAdmin: boolean;
  blocked: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  groups: number;
  lessons: number;
  items: number;
  lastItemAt: string | null;
};

function TeachersSection() {
  const [rows, setRows] = useState<TeacherRow[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const load = useCallback(() => {
    call<{ teachers: TeacherRow[] }>("/api/admin/teachers")
      .then((d) => setRows(d.teachers))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(t: TeacherRow) {
    if (!t.blocked && !window.confirm(`להשעות את ${t.displayName}? היא לא תוכל להיכנס, והנתונים שלה יישמרו.`)) return;
    try {
      await call(`/api/admin/teachers/${t.id}`, "PATCH", { blocked: !t.blocked });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "הפעולה נכשלה");
    }
  }

  const shown = rows?.filter((t) => t.displayName.includes(filter.trim())) ?? [];
  return (
    <Card title={`מורים${rows ? ` (${rows.length})` : ""}`}>
      <input className="field mb-3 !w-64" placeholder="חיפוש לפי שם" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="חיפוש מורה" />
      {error && <p className="mb-2 text-sm text-coral">{error}</p>}
      {!rows && <p className="text-muted">טוענים…</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-start text-muted">
            <tr>
              {["שם", "הצטרפה", "כניסה אחרונה", "קבוצות", "שיעורים", "פריטים", ""].map((h) => (
                <th key={h} className="px-2 py-2 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((t) => (
              <tr key={t.id} className={t.blocked ? "opacity-60" : ""}>
                <td className="px-2 py-2 font-medium">
                  {t.displayName}
                  {t.isAdmin && <span className="ms-2 rounded-full bg-blue-soft px-2 py-0.5 text-xs text-blue-dark">מנהלת</span>}
                  {t.blocked && <span className="ms-2 rounded-full bg-coral/10 px-2 py-0.5 text-xs text-coral">מושעית</span>}
                </td>
                <td className="px-2 py-2 tabular-nums">{fmtDate(t.createdAt)}</td>
                <td className="px-2 py-2 tabular-nums">{fmtDate(t.lastLoginAt)}</td>
                <td className="px-2 py-2 tabular-nums">{t.groups}</td>
                <td className="px-2 py-2 tabular-nums">{t.lessons}</td>
                <td className="px-2 py-2 tabular-nums">{t.items}</td>
                <td className="px-2 py-2 text-end">
                  {!t.isAdmin && (
                    <button className="btn-icon" aria-label={t.blocked ? "ביטול השעיה" : "השעיה"} data-tip={t.blocked ? "ביטול השעיה" : "השעיה"} onClick={() => toggle(t)}>
                      {t.blocked ? <ShieldCheck size={16} strokeWidth={2} /> : <ShieldOff size={16} strokeWidth={2} />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- קבוצות ---------- */

type GroupRow = {
  id: number;
  name: string;
  teacher: string;
  className: string | null;
  subjectName: string | null;
  schoolYear: string;
  joinCode: string;
  archivedAt: string | null;
  students: number;
  lessons: number;
  openLessons: number;
};

function GroupsSection() {
  const [rows, setRows] = useState<GroupRow[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const load = useCallback(() => {
    call<{ groups: GroupRow[] }>("/api/admin/groups")
      .then((d) => setRows(d.groups))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function archive(g: GroupRow) {
    try {
      await call(`/api/admin/groups/${g.id}`, "PATCH", { archived: !g.archivedAt });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "הפעולה נכשלה");
    }
  }

  const shown = rows?.filter((g) => `${g.name} ${g.teacher} ${g.subjectName ?? ""}`.includes(filter.trim())) ?? [];
  return (
    <Card title={`קבוצות${rows ? ` (${rows.length})` : ""}`}>
      <input className="field mb-3 !w-64" placeholder="חיפוש לפי שם, מורה או תחום" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="חיפוש קבוצה" />
      {error && <p className="mb-2 text-sm text-coral">{error}</p>}
      {!rows && <p className="text-muted">טוענים…</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="text-muted">
            <tr>
              {["קבוצה", "מורה", "כיתה ותחום", "שנה", "תלמידים", "שיעורים", "קוד", ""].map((h) => (
                <th key={h} className="px-2 py-2 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((g) => (
              <tr key={g.id} className={g.archivedAt ? "opacity-60" : ""}>
                <td className="px-2 py-2 font-medium">{g.name}</td>
                <td className="px-2 py-2">{g.teacher}</td>
                <td className="px-2 py-2">{[g.className && `כיתה ${g.className}`, g.subjectName].filter(Boolean).join(" · ")}</td>
                <td className="px-2 py-2 tabular-nums">{g.schoolYear}</td>
                <td className="px-2 py-2 tabular-nums">{g.students}</td>
                <td className="px-2 py-2 tabular-nums">
                  {g.lessons}
                  {g.openLessons > 0 && <span className="text-muted"> ({g.openLessons} פתוחים)</span>}
                </td>
                <td className="px-2 py-2 font-mono tabular-nums" dir="ltr">
                  {g.joinCode}
                </td>
                <td className="px-2 py-2 text-end">
                  <button
                    className="btn-icon"
                    aria-label={g.archivedAt ? "שחזור מהארכיון" : "העברה לארכיון"}
                    data-tip={g.archivedAt ? "שחזור מהארכיון" : "ארכיון: תלמידים כבר לא יצטרפו עם הקוד"}
                    onClick={() => archive(g)}
                  >
                    {g.archivedAt ? <ArchiveRestore size={16} strokeWidth={2} /> : <Archive size={16} strokeWidth={2} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- הגדרות ---------- */

type Settings = { students_enabled: string; teachers_open: string; student_notice: string; teacher_notice: string };

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-blue" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "start-[1.4rem]" : "start-0.5"}`} />
      </button>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
    </div>
  );
}

function SettingsSection() {
  const [s, setS] = useState<Settings | null>(null);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    call<Settings>("/api/admin/settings")
      .then(setS)
      .catch((e) => setMessage(e.message));
  }, []);

  async function save(patch: Partial<Settings>) {
    setState("idle");
    try {
      setS(await call<Settings>("/api/admin/settings", "PATCH", patch));
      setState("saved");
      setTimeout(() => setState("idle"), 1500);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "השמירה נכשלה");
      setState("error");
    }
  }

  if (!s) return <p className="text-muted">{message || "טוענים…"}</p>;
  return (
    <div className="flex flex-col gap-5">
      <Card title="כניסה והרשמה">
        <Toggle
          on={s.students_enabled === "1"}
          onChange={(v) => save({ students_enabled: v ? "1" : "0" })}
          label="כניסת תלמידים והצטרפות לקבוצות"
          hint="כשהיא כבויה, תלמידים לא יכולים להיכנס או להצטרף. תלמידים שכבר מחוברים ממשיכים לראות את הקבוצות שלהם."
        />
        <Toggle
          on={s.teachers_open === "1"}
          onChange={(v) => save({ teachers_open: v ? "1" : "0" })}
          label="מורים חדשים יכולים להיכנס"
          hint="כשהיא כבויה, רק מורות שכבר נכנסו בעבר (ואת) ממשיכות להיכנס. מורה חדשה מחומר פתוח תקבל הודעה שההרשמה סגורה."
        />
      </Card>

      <Card title="הודעות">
        <div className="flex flex-col gap-4">
          {(
            [
              ["student_notice", "הודעה לתלמידים", "מופיעה בדף הכניסה ובדף הקבוצות של התלמיד. למשל: המערכת בתחזוקה עד 16:00."],
              ["teacher_notice", "הודעה למורים", "מופיעה בראש \"הקבוצות שלי\"."],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="font-medium">{label}</span>
              <input
                className="field"
                defaultValue={s[key]}
                maxLength={300}
                placeholder="ריק = בלי הודעה"
                onBlur={(e) => e.target.value.trim() !== s[key] && save({ [key]: e.target.value.trim() })}
              />
              <span className="text-sm text-muted">{hint}</span>
            </label>
          ))}
        </div>
      </Card>

      <p className="h-5 text-sm" role="status">
        {state === "saved" && (
          <span className="inline-flex items-center gap-1 text-green-700">
            <Check size={14} strokeWidth={2} /> נשמר
          </span>
        )}
        {state === "error" && <span className="text-coral">{message}</span>}
      </p>
    </div>
  );
}

/* ---------- הדף ---------- */

export default function AdminPanel() {
  const [section, setSection] = useState<Section>("overview");
  const [denied, setDenied] = useState("");

  useEffect(() => {
    // בדיקה מוקדמת: מי שאינה מנהלת מקבלת הסבר ולא מסך ריק.
    fetch("/api/admin/settings").then((r) => {
      if (r.status === 401) window.location.href = "/";
      else if (r.status === 403) setDenied("אזור הניהול פתוח רק למנהלת המערכת.");
      // הסעיף האחרון שנפתח נשמר בכתובת (#domains), כדי שרענון יחזור אליו.
      const hash = window.location.hash.replace("#", "") as Section;
      if (MENU.some((m) => m.key === hash)) setSection(hash);
    });
  }, []);

  if (denied)
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="mb-4 text-lg">{denied}</p>
        <Link href="/" className="btn btn-ghost">
          חזרה לקבוצות
        </Link>
      </div>
    );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 md:flex-row">
      {/* תפריט צד, כמו בלוח הבקרה של וורדפרס */}
      <nav aria-label="ניהול" className="shrink-0 md:w-56">
        <h1 className="mb-3 text-2xl font-extrabold">ניהול</h1>
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {MENU.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                aria-current={section === m.key}
                onClick={() => {
                  setSection(m.key);
                  window.history.replaceState(null, "", `#${m.key}`);
                }}
                className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-start text-sm font-medium transition ${
                  section === m.key ? "bg-blue text-white" : "text-ink hover:bg-blue-soft"
                }`}
              >
                <m.icon size={18} strokeWidth={2} />
                {m.label}
              </button>
            </li>
          ))}
        </ul>
        <Link href="/" className="mt-4 hidden text-sm text-muted underline md:block">
          חזרה לקבוצות
        </Link>
      </nav>

      <div className="min-w-0 flex-1">
        {section === "overview" && <OverviewSection />}
        {section === "domains" && <DomainsSection />}
        {section === "teachers" && <TeachersSection />}
        {section === "groups" && <GroupsSection />}
        {section === "settings" && <SettingsSection />}
      </div>
    </div>
  );
}
