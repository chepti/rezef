"use client";

import { useEffect, useState } from "react";
import { Check, Clock, ExternalLink, Eye, Heart, MessageCircle, Star, Users, X } from "lucide-react";

type Preview = {
  id: number;
  title: string;
  url: string;
  image: string | null;
  intro: string;
  author: string;
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

function Stat({ icon: Icon, value, tip }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; value: string | number; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-page px-3 py-1.5 text-sm tabular-nums" data-tip={tip}>
      <Icon size={15} strokeWidth={2} />
      {value}
    </span>
  );
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

  const meta = data ? [...data.classes.map((c) => `כיתה ${c}`), ...data.subjects].join(" · ") : "";
  const sequences = data?.rezefUsage?.sequences ?? null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-label="תצוגה מקדימה">
        {data?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.image} alt="" className="aspect-[1024/538] w-full object-cover bg-page" draggable={false} />
        )}
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <h2 className="text-xl font-extrabold leading-snug">{data?.title ?? fallbackTitle}</h2>
            <button type="button" className="btn-icon ms-auto shrink-0" aria-label="סגירה" data-tip="סגירה" onClick={onClose}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {!data && !error && <p className="text-muted text-sm">טוענים…</p>}
          {error && <p className="text-coral text-sm">{error}</p>}

          {data && (
            <>
              <p className="text-xs text-muted">
                {[data.category, meta, data.author && `מאת ${data.author}`].filter(Boolean).join(" · ")}
              </p>
              {data.intro && <p className="text-[0.95rem] leading-relaxed">{data.intro}</p>}

              <div className="flex flex-wrap gap-1.5">
                {data.usedCount > 0 && <Stat icon={Check} value={data.usedCount} tip="מורים שסימנו שהשתמשו בזה בכיתה" />}
                {sequences !== null && <Stat icon={Users} value={sequences} tip="רצפי לימוד שכוללים את הפריט" />}
                {data.rating !== null && <Stat icon={Star} value={`${data.rating} (${data.ratingCount})`} tip="דירוג ממוצע ומספר המדרגים" />}
                {data.comments > 0 && <Stat icon={MessageCircle} value={data.comments} tip="תגובות" />}
                {data.likes > 0 && <Stat icon={Heart} value={data.likes} tip="לבבות" />}
                {data.views > 0 && <Stat icon={Eye} value={data.views} tip="צפיות" />}
                {data.duration && <Stat icon={Clock} value={data.duration} tip="משך משוער לפי המחבר" />}
              </div>
              {data.usedCount === 0 && sequences === null && data.rating === null && data.comments === 0 && data.likes === 0 && (
                <p className="text-xs text-muted">עדיין אין נתוני שימוש לפריט הזה.</p>
              )}

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
                {(data.platform || data.host) && (
                  <span className="text-xs text-muted truncate" data-tip="הפריט עצמו מתארח בפלטפורמה חיצונית">
                    פלטפורמה: {data.platform || data.host}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
