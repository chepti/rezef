import { safeFetch } from "./safe-fetch";

// כתובת להצגה בתוך מסגרת במצב שיעור. null = האתר לא מרשה (או שלא הצלחנו לברר), ואז נשאר רק "פתיחה".
export type EmbedResult = { embedUrl: string | null; provider: string | null };

function known(u: URL): EmbedResult | null {
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const path = u.pathname;

  if (host === "youtu.be") {
    const id = path.slice(1).split("/")[0];
    return id ? { embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`, provider: "YouTube" } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = path === "/watch" ? u.searchParams.get("v") : path.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1];
    if (id) return { embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`, provider: "YouTube" };
    const list = u.searchParams.get("list");
    return list ? { embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}`, provider: "YouTube" } : null;
  }
  if (host === "vimeo.com") {
    const id = path.match(/^\/(\d+)/)?.[1];
    return id ? { embedUrl: `https://player.vimeo.com/video/${id}`, provider: "Vimeo" } : null;
  }
  if (host === "docs.google.com") {
    // מצגות, מסמכים, גיליונות וטפסים: /d/<מזהה>/… הופך לתצוגת הטמעה.
    const m = path.match(/^\/(presentation|document|spreadsheets|forms)\/d\/((?:e\/)?[\w-]+)/);
    if (m) {
      const base = `https://docs.google.com/${m[1]}/d/${m[2]}`;
      if (m[1] === "presentation") return { embedUrl: `${base}/embed?start=false&loop=false`, provider: "Google Slides" };
      if (m[1] === "forms") return { embedUrl: `${base}/viewform?embedded=true`, provider: "Google Forms" };
      return { embedUrl: `${base}/preview`, provider: "Google Docs" };
    }
  }
  if (host === "drive.google.com") {
    const id = path.match(/^\/file\/d\/([\w-]+)/)?.[1] ?? (path === "/open" ? u.searchParams.get("id") : null);
    return id ? { embedUrl: `https://drive.google.com/file/d/${id}/preview`, provider: "Google Drive" } : null;
  }
  if (host === "canva.com") {
    const m = path.match(/^\/design\/([\w-]+)\/([\w-]+)\/(?:view|watch)/);
    return m ? { embedUrl: `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed`, provider: "Canva" } : null;
  }
  if (host === "view.genially.com" || host === "view.genial.ly") {
    const id = path.split("/")[1];
    return id ? { embedUrl: `https://view.genially.com/${id}`, provider: "Genially" } : null;
  }
  if (host === "scratch.mit.edu") {
    const id = path.match(/^\/projects\/(\d+)/)?.[1];
    return id ? { embedUrl: `https://scratch.mit.edu/projects/${id}/embed`, provider: "Scratch" } : null;
  }
  if (host === "geogebra.org") {
    const id = path.match(/^\/(?:m|classic|graphing|geometry)\/([\w-]+)/)?.[1];
    return id ? { embedUrl: `https://www.geogebra.org/material/iframe/id/${id}`, provider: "GeoGebra" } : null;
  }
  if (host === "learningapps.org") {
    const id = path.match(/^\/(?:watch\?v=|display\?v=)?(\w+)$/)?.[1] ?? u.searchParams.get("v");
    return id ? { embedUrl: `https://learningapps.org/watch?v=${id}`, provider: "LearningApps" } : null;
  }
  return null;
}

// ספקים שנותנים קוד הטמעה דרך oEmbed: שולפים ממנו את כתובת המסגרת.
const OEMBED: Array<{ match: RegExp; endpoint: string; provider: string }> = [
  { match: /^https?:\/\/(www\.)?wordwall\.net\//i, endpoint: "https://wordwall.net/api/oembed?format=json&url=", provider: "Wordwall" },
  { match: /^https?:\/\/(www\.)?padlet\.com\//i, endpoint: "https://padlet.com/oembed/?format=json&url=", provider: "Padlet" },
  { match: /^https?:\/\/(www\.)?quizizz\.com\//i, endpoint: "https://quizizz.com/api/oembed?format=json&url=", provider: "Quizizz" },
];

async function viaOembed(url: string): Promise<EmbedResult | null> {
  const entry = OEMBED.find((o) => o.match.test(url));
  if (!entry) return null;
  try {
    const res = await safeFetch(entry.endpoint + encodeURIComponent(url), "application/json");
    if (res.status !== 200) return null;
    const html = String((JSON.parse(res.body) as { html?: string }).html ?? "");
    const src = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, "&");
    if (!src) return null;
    const abs = src.startsWith("//") ? `https:${src}` : src;
    return abs.startsWith("https://") ? { embedUrl: abs, provider: entry.provider } : null;
  } catch {
    return null;
  }
}

export async function resolveEmbed(rawUrl: string): Promise<EmbedResult> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { embedUrl: null, provider: null };
  }
  const direct = known(u);
  if (direct) return direct;
  const oembed = await viaOembed(u.toString());
  if (oembed) return oembed;

  // אתר לא מוכר: מותר להטמיע רק אם הוא לא אוסר זאת בכותרות, ורק ב-https (אחרת הדפדפן חוסם תוכן מעורב).
  try {
    const res = await safeFetch(u.toString());
    if (res.status >= 400) return { embedUrl: null, provider: null };
    const final = new URL(res.finalUrl);
    if (final.protocol !== "https:") return { embedUrl: null, provider: null };
    if (res.frameOptions.trim()) return { embedUrl: null, provider: null };
    const ancestors = res.csp.match(/frame-ancestors([^;]*)/i)?.[1]?.trim();
    if (ancestors !== undefined && !/(^|\s)(\*|https:)(\s|$)/.test(ancestors)) return { embedUrl: null, provider: null };
    // הפניה לספק מוכר (קישור מקוצר) מקבלת את כתובת ההטמעה שלו.
    return known(final) ?? { embedUrl: final.toString(), provider: final.hostname.replace(/^www\./, "") };
  } catch {
    return { embedUrl: null, provider: null };
  }
}
