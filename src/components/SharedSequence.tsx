"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ExternalLink, Eye } from "lucide-react";
import { TYPE_META, typeOf } from "./content-types";

type SharedItem = {
  id: number;
  title: string;
  url: string;
  imageUrl: string | null;
  kind: string;
  contentType: string | null;
  phase: string | null;
  duration: string | null;
  note: string;
};
type Shared = {
  group: { id: number; name: string; className: string | null; subjectName: string | null };
  teacher: { id: number; displayName: string };
  topics: Array<{ id: number; name: string; color: string }>;
  lessons: Array<{ id: number; title: string; topicId: number | null; goals: string; items: SharedItem[] }>;
};

const DURATION: Record<string, string> = { five: "5 דק׳", quarter: "רבע שעה", half: "חצי שעה", lesson: "שיעור", double: "שני שיעורים" };

// רצף משותף של מורה אחרת, לקריאה בלבד: נושאים, שיעורים ופריטים.
export default function SharedSequence({ groupId }: { groupId: number }) {
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState("");
  const [topicId, setTopicId] = useState<number | null>(null);

  useEffect(() => {
    let stale = false;
    fetch(`/api/shared/groups/${groupId}`)
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/";
          return null;
        }
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? "לא הצלחנו לטעון את הרצף");
        return body as Shared;
      })
      .then((d) => !stale && d && setData(d))
      .catch((e) => !stale && setError(e instanceof Error ? e.message : "שגיאה"));
    return () => {
      stale = true;
    };
  }, [groupId]);

  if (error) return <p className="p-10 text-coral">{error}</p>;
  if (!data) return <p className="p-10 text-muted">טוענים…</p>;

  const current = topicId ?? data.topics.find((t) => data.lessons.some((l) => l.topicId === t.id))?.id ?? null;
  const color = data.topics.find((t) => t.id === current)?.color ?? "var(--blue)";
  const lessons = data.lessons.filter((l) => (data.topics.length ? l.topicId === current : true));

  return (
    <div className="px-5 py-8">
      <div className="mx-auto mb-4 flex max-w-[110rem] flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{data.group.name}</h1>
        {data.group.className && <span className="rounded-full bg-blue-soft px-3 py-1 text-sm text-blue-dark">כיתה {data.group.className}</span>}
        {data.group.subjectName && <span className="rounded-full bg-blue-soft px-3 py-1 text-sm text-blue-dark">{data.group.subjectName}</span>}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm text-muted">
          <Eye size={14} strokeWidth={2} /> הרצף של {data.teacher.displayName}, לצפייה בלבד
        </span>
        <Link href="/teachers" className="btn btn-ghost ms-auto">
          <ArrowRight size={16} strokeWidth={2} /> מורים
        </Link>
      </div>

      {data.topics.length > 0 && (
        <div className="mx-auto mb-5 flex max-w-[110rem] flex-wrap gap-2">
          {data.topics.map((t) => {
            const n = data.lessons.filter((l) => l.topicId === t.id).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopicId(t.id)}
                aria-current={t.id === current}
                className={`rounded-2xl px-4 py-2 text-start font-bold transition ${t.id === current ? "text-white shadow" : "bg-white text-ink hover:shadow-sm"}`}
                style={t.id === current ? { background: t.color } : { borderInlineStart: `6px solid ${t.color}` }}
              >
                {t.name}
                <span className={`ms-2 text-xs font-normal tabular-nums ${t.id === current ? "opacity-90" : "text-muted"}`}>{n} שיעורים</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mx-auto max-w-[110rem] overflow-x-auto pb-3">
        <div className="flex w-max min-w-full items-start gap-4">
          {lessons.map((l, i) => (
            <section key={l.id} className="flex w-[20rem] shrink-0 flex-col gap-2.5 rounded-3xl border border-line bg-white/70 p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white tabular-nums" style={{ background: color }}>
                  {i + 1}
                </span>
                <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{l.title}</h2>
              </div>
              {l.goals.trim() && <p className="whitespace-pre-wrap rounded-xl bg-blue-soft/60 px-3 py-2 text-sm">{l.goals}</p>}
              {l.items.map((item) => {
                const type = typeOf(item);
                const { icon: Icon, color: typeColor } = TYPE_META[type];
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-2 transition hover:border-blue"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-blue-soft">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center" style={{ color: typeColor }}>
                            <Icon size={20} strokeWidth={2} />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-[0.7rem] text-muted">{[type, item.phase, item.duration ? DURATION[item.duration] : null].filter(Boolean).join(" · ")}</span>
                      </span>
                      <ExternalLink size={14} strokeWidth={2} className="shrink-0 text-muted" />
                    </span>
                    {item.note && <span className="rounded-lg bg-page px-2.5 py-1.5 text-xs">{item.note}</span>}
                  </a>
                );
              })}
              {l.items.length === 0 && <p className="text-sm text-muted">אין פריטים בשיעור הזה.</p>}
            </section>
          ))}
          {lessons.length === 0 && <p className="text-muted">אין שיעורים בנושא הזה.</p>}
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-[110rem] text-sm text-muted">
        כדי להשתמש בפריט ברצף שלך: עקבי אחרי {data.teacher.displayName}, והפריטים שלה יופיעו ראשונים במאגר כשאת בונה שיעור.
      </p>
    </div>
  );
}
