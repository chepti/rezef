import * as cheerio from "cheerio";
import { safeFetch } from "./safe-fetch";

export type ItemKind = "openstuff" | "youtube" | "video" | "slides" | "doc" | "file" | "game" | "link";

export type Unfurled = {
  url: string;
  title: string;
  imageUrl: string | null;
  siteName: string | null;
  kind: ItemKind;
  contentType: string;
  openstuffPostId: number | null;
  meta: { classes?: string[]; subjects?: string[]; author?: string };
};

// הקטגוריות של חומר פתוח. סוג תוכן הוא תמיד אחת מהן.
export const CONTENT_TYPES = ["סרטון", "מצגת", "להדפסה", "מערך שיעור", "פעילות", "כלי דיגיטלי", "תבנית", "אחר"] as const;

// ניחוש לקישור חיצוני לפי סוג הקישור; המורה יכולה לתקן.
const KIND_TO_TYPE: Record<ItemKind, string> = {
  openstuff: "אחר",
  youtube: "סרטון",
  video: "סרטון",
  slides: "מצגת",
  doc: "מערך שיעור",
  file: "להדפסה",
  game: "פעילות",
  link: "אחר",
};

export function guessContentType(kind: ItemKind): string {
  return KIND_TO_TYPE[kind] ?? "אחר";
}

const OPENSTUFF_HOSTS = new Set(["openstuff.co.il", "www.openstuff.co.il"]);

const FILE_EXT = /\.(pdf|docx?|pptx?|xlsx?|zip|png|jpe?g|gif|mp3|mp4)$/i;

function kindFromUrl(u: URL): ItemKind {
  const host = u.hostname.replace(/^www\./, "");
  if (OPENSTUFF_HOSTS.has(u.hostname)) return "openstuff";
  if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") return "youtube";
  if (host === "vimeo.com") return "video";
  if (host === "docs.google.com" && u.pathname.startsWith("/presentation")) return "slides";
  if (host === "docs.google.com" || host === "drive.google.com") return "doc";
  if (host === "canva.com" || host.endsWith(".canva.com")) return "slides";
  if (host === "wordwall.net" || host === "learningapps.org" || host === "kahoot.it" || host === "quizizz.com") return "game";
  if (FILE_EXT.test(u.pathname)) return "file";
  return "link";
}

export function normalizeUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

function decodeHtml(s: string): string {
  return cheerio.load(`<p>${s}</p>`)("p").text().trim();
}

function pick($: cheerio.CheerioAPI, ...selectors: string[]): string | null {
  for (const sel of selectors) {
    const v = $(sel).attr("content") ?? $(sel).attr("href") ?? $(sel).text();
    if (v && v.trim()) return v.trim();
  }
  return null;
}

function absolute(base: string, maybe: string | null): string | null {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

async function unfurlOpenstuff(u: URL): Promise<Partial<Unfurled> | null> {
  const m = u.pathname.match(/^\/(\d+)\/?/);
  if (!m) return null;
  const id = Number(m[1]);
  const res = await safeFetch(
    `https://openstuff.co.il/wp-json/wp/v2/posts/${id}?_embed=1`,
    "application/json",
  );
  if (res.status !== 200) return null;
  const post = JSON.parse(res.body) as {
    title?: { rendered?: string };
    _embedded?: {
      author?: Array<{ name?: string }>;
      "wp:featuredmedia"?: Array<{ source_url?: string }>;
      "wp:term"?: Array<Array<{ taxonomy: string; name: string }>>;
    };
  };
  const terms = (post._embedded?.["wp:term"] ?? []).flat();
  // סוג התוכן הוא הקטגוריה של הפוסט עצמו (הראשונה שמוכרת לנו).
  const category = terms.find((t) => t.taxonomy === "category" && (CONTENT_TYPES as readonly string[]).includes(t.name))?.name;
  return {
    title: decodeHtml(post.title?.rendered ?? ""),
    imageUrl: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
    siteName: "חומר פתוח",
    contentType: category ?? "אחר",
    openstuffPostId: id,
    meta: {
      classes: terms.filter((t) => t.taxonomy === "class").map((t) => t.name),
      subjects: terms.filter((t) => t.taxonomy === "subject").map((t) => t.name),
      author: post._embedded?.author?.[0]?.name,
    },
  };
}

async function unfurlOembed(endpoint: string): Promise<Partial<Unfurled> | null> {
  const res = await safeFetch(endpoint, "application/json");
  if (res.status !== 200) return null;
  const data = JSON.parse(res.body) as { title?: string; thumbnail_url?: string; provider_name?: string };
  return { title: data.title, imageUrl: data.thumbnail_url ?? null, siteName: data.provider_name ?? null };
}

async function unfurlGeneric(u: URL): Promise<Partial<Unfurled>> {
  const res = await safeFetch(u.toString());
  if (res.status >= 400 || !/html/i.test(res.contentType)) {
    return {};
  }
  const $ = cheerio.load(res.body);
  const title = pick($, 'meta[property="og:title"]', 'meta[name="twitter:title"]', "title");
  const image = pick($, 'meta[property="og:image"]', 'meta[name="twitter:image"]', 'link[rel="image_src"]');
  const site = pick($, 'meta[property="og:site_name"]');
  return {
    title: title ? decodeHtml(title) : undefined,
    imageUrl: absolute(res.finalUrl, image),
    siteName: site,
  };
}

export async function unfurl(rawUrl: string): Promise<Unfurled | null> {
  const u = normalizeUrl(rawUrl);
  if (!u) return null;

  const kind = kindFromUrl(u);
  const base: Unfurled = {
    url: u.toString(),
    title: u.hostname.replace(/^www\./, ""),
    imageUrl: null,
    siteName: null,
    kind,
    contentType: guessContentType(kind),
    openstuffPostId: null,
    meta: {},
  };

  let extra: Partial<Unfurled> | null = null;
  try {
    if (kind === "openstuff") {
      extra = (await unfurlOpenstuff(u)) ?? (await unfurlGeneric(u));
    } else if (kind === "youtube") {
      extra = await unfurlOembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.toString())}`);
    } else if (kind === "video") {
      extra = await unfurlOembed(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u.toString())}`);
    } else if (kind !== "file") {
      extra = await unfurlGeneric(u);
    }
  } catch {
    // כשל בשליפה לא חוסם את ההדבקה: הפריט נוצר עם כותרת בסיסית והמורה יכולה לתקן.
    extra = null;
  }

  if (kind === "file") {
    const name = decodeURIComponent(u.pathname.split("/").pop() ?? "");
    if (name) base.title = name;
  }

  return {
    ...base,
    ...Object.fromEntries(Object.entries(extra ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "")),
    meta: { ...base.meta, ...(extra?.meta ?? {}) },
  } as Unfurled;
}
