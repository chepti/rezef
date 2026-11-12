"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Eye, Heart, Layers, MessageCircle, Star, X } from "lucide-react";

type Preview = {
  id: number;
  title: string;
  url: string;
  image: string | null;
  intro: string;
  author: string;
  // היוצר המקורי של החומר; עלול להיעדר בתשובות ישנות שבמטמון.
  credit?: string;
  tags?: string[];
  date?: string;
  platform: string;
  host: string;
  category: string | null;
  classes: string[];
  subjects: string[];
  likes: number;
  views: number;
  comments: number;
  rating: number | null;
  ratingCount: number;
  usedCount: number;
  duration: string | null;
  rezefUsage: { sequences: number | null; notes: Array<{ text: string; author: string }> } | null;
};

// אפס מוצג עמום, כדי שיהיה ברור שהנתון קיים ופשוט עדיין ריק.
function Stat({
  icon: Icon,
  value,
  tip,
  dim,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  value: string | number;
  tip: string;
  dim?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-page px-3 py-1.5 text-sm tabular-nums ${dim ? "text-muted opacity-60" : ""}`}
      data-tip={tip}
    >
      <Icon size={15} strokeWidth={2} />
      {value}
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs">{children}</span>;
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

export default function PreviewDialog({
  postId,
  fallbackTitle,
  onClose,
}: {
  postId: number;
  fallbackTitle: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stale = false;
    fetch(`/api/warehouse/preview/${postId}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? "לא הצלחנו לטעון את התצוגה המקדימה");
        return body as Preview;
      })
      .then((d) => !stale && setData(d))
      .catch((e) => !stale && setError(e instanceof Error ? e.message : "שגיאה"));
    return () => {
      stale = true;
    };
  }, [postId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sequences = data?.rezefUsage?.sequences ?? null;
  const tags = data?.tags ?? [];
  const date = formatDate(data?.date);
  const where = data ? data.platform || data.host : "";
  // שורת פרטים: קטגוריה, משך, תאריך פרסום ופלטפורמה, רק מה שקיים.
  const facts = data ? [data.category, data.duration, date, where && `פלטפורמה: ${where}`].filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-label="תצוגה מקדימה">
        {data?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.image} alt="" className="aspect-[1024/538] w-full object-cover bg-page" draggable={false} />
        )}
        <div className="p-5 sm:p-6 flex flex-col gap-3.5">
          <div className="flex items-start gap-2">
            <h2 className="text-2xl font-extrabold leading-snug">{data?.title ?? fallbackTitle}</h2>
            <button type="button" className="btn-icon ms-auto shrink-0" aria-label="סגירה" data-tip="סגירה" onClick={onClose}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {!data && !error && <p className="text-muted text-sm">טוענים…</p>}
          {error && <p className="text-coral text-sm">{error}</p>}

          {data && (
            <>
              {(data.credit || data.author) && (
                <div className="flex flex-col gap-0.5">
                  {data.credit ? (
                    <>
                      <p className="text-sm font-medium">יוצר/ת: {data.credit}</p>
                      {data.author && <p className="text-xs text-muted">הועלה על ידי {data.author}</p>}
                    </>
                  ) : (
                    <p className="text-sm text-muted">מאת {data.author}</p>
                  )}
                </div>
              )}

              {data.intro && <p className="text-base leading-relaxed whitespace-pre-line">{data.intro}</p>}

              {facts.length > 0 && <p className="text-xs text-muted">{facts.join(" · ")}</p>}

              {(data.classes.length > 0 || data.subjects.length > 0 || tags.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {data.classes.map((c) => (
                    <Pill key={`c-${c}`}>כיתה {c}</Pill>
                  ))}
                  {data.subjects.map((s) => (
                    <Pill key={`s-${s}`}>{s}</Pill>
                  ))}
                  {tags.map((t) => (
                    <span key={`t-${t}`} className="rounded-full bg-blue-soft px-2.5 py-0.5 text-xs text-blue-dark">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Stat icon={Check} value={data.usedCount} dim={data.usedCount === 0} tip="השתמשו בזה: מורים שסימנו שהשתמשו בפריט בכיתה" />
                {sequences !== null && <Stat icon={Layers} value={sequences} dim={sequences === 0} tip="רצפי לימוד שכוללים את הפריט" />}
                {data.rating !== null ? (
                  <Stat icon={Star} value={`${data.rating} (${data.ratingCount})`} tip="דירוג ממוצע ומספר המדרגים" />
                ) : (
                  <Stat icon={Star} value="אין דירוג" dim tip="עדיין לא דירגו את הפריט" />
                )}
                <Stat icon={MessageCircle} value={data.comments} dim={data.comments === 0} tip="תגובות" />
                <Stat icon={Heart} value={data.likes} dim={data.likes === 0} tip="לבבות" />
                <Stat icon={Eye} value={data.views} dim={data.views === 0} tip="צפיות" />
              </div>

              {data.rezefUsage && data.rezefUsage.notes.length > 0 && (
                <div className="rounded-2xl bg-blue-soft/60 p-3 flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-blue-dark">איך מורים משתמשים בזה</p>
                  {data.rezefUsage.notes.map((n, i) => (
                    <p key={i} className="text-sm">
                      {n.text}
                      {n.author && <span className="text-muted text-xs"> — {n.author}</span>}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <a className="btn btn-primary" href={data.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} strokeWidth={2} />
                  פתיחה באתר
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
