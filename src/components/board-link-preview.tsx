"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

// תצוגה מקדימה של קישור חיצוני (פריט שאין לו פוסט בחומר פתוח): מוצג בתוך החלון כשהאתר מרשה, ואחרת כתמונה.
export default function LinkPreviewDialog({
  title,
  url,
  imageUrl,
  siteName,
  isImage,
  onClose,
}: {
  title: string;
  url: string;
  imageUrl: string | null;
  siteName: string | null;
  isImage: boolean;
  onClose: () => void;
}) {
  // undefined = בודקים אם אפשר להציג בתוך החלון, null = האתר לא מרשה.
  const [embedUrl, setEmbedUrl] = useState<string | null | undefined>(isImage ? null : undefined);

  useEffect(() => {
    if (isImage) return;
    let stale = false;
    fetch(`/api/embed?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { embedUrl?: string | null } | null) => !stale && setEmbedUrl(d?.embedUrl ?? null))
      .catch(() => !stale && setEmbedUrl(null));
    return () => {
      stale = true;
    };
  }, [url, isImage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = isImage ? url : imageUrl;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // כתובת לא תקינה פשוט לא מציגה שם אתר.
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-label="תצוגה מקדימה">
        {embedUrl ? (
          <div className="aspect-video w-full bg-page">
            <iframe
              className="h-full w-full"
              src={embedUrl}
              title={title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              // התוכן המוטמע לא רשאי להחליף את הדף.
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          shown && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="max-h-[60vh] w-full bg-page object-contain" draggable={false} />
          )
        )}
        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex items-start gap-2">
            <h2 className="text-2xl font-extrabold leading-snug">{title}</h2>
            <button type="button" className="btn-icon ms-auto shrink-0" aria-label="סגירה" data-tip="סגירה" onClick={onClose}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <p className="text-sm text-muted">{[siteName, host].filter(Boolean).join(" · ")}</p>
          {embedUrl === undefined && <p className="text-sm text-muted">בודקים אם אפשר להציג כאן…</p>}
          {embedUrl === null && !isImage && <p className="text-sm text-muted">האתר הזה לא מאפשר הצגה בתוך הדף.</p>}
          <div>
            <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} strokeWidth={2} />
              פתיחה בחלון חדש
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
