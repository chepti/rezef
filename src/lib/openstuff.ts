const WP = (process.env.WP_URL ?? "https://openstuff.co.il").replace(/\/$/, "");
const TERMS_TTL_MS = 6 * 60 * 60 * 1000;

type TermList = Array<{ id: number; name: string }>;
type TermTax = "classes" | "subjects" | "categories";
const termCache: Partial<Record<TermTax, { at: number; terms: TermList }>> = {};

async function wp<T>(path: string): Promise<{ data: T; total: number }> {
  const res = await fetch(`${WP}/wp-json/wp/v2/${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`wp ${res.status}`);
  return { data: (await res.json()) as T, total: Number(res.headers.get("x-wp-total") ?? 0) };
}

export async function getTerms(tax: TermTax): Promise<TermList> {
  const hit = termCache[tax];
  if (hit && Date.now() - hit.at < TERMS_TTL_MS) return hit.terms;
  const all: TermList = [];
  for (let page = 1; page <= 5; page++) {
    const { data } = await wp<TermList>(`${tax}?per_page=100&page=${page}&hide_empty=false&_fields=id,name`);
    all.push(...data);
    if (data.length < 100) break;
  }
  termCache[tax] = { at: Date.now(), terms: all };
  return all;
}

export type WarehouseCard = {
  id: number;
  url: string;
  title: string;
  imageUrl: string | null;
  classes: string[];
  subjects: string[];
  category: string | null;
  views: number;
  likes: number;
  used: number;
};

const KNOWN_TYPES = ["סרטון", "מצגת", "להדפסה", "מערך שיעור", "פעילות", "כלי דיגיטלי", "תבנית"];

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export async function searchOpenstuff(opts: {
  q?: string;
  className?: string | null;
  subjectName?: string | null;
  page?: number;
  exclude?: number[];
  related?: boolean;
  topic?: string;
}): Promise<{ cards: WarehouseCard[]; total: number }> {
  // נקודת החיפוש של תוסף הגשר: ממיינת מהפופולרי ומטה, ומדלגת על מה שכבר ברצף.
  const params = new URLSearchParams({ per_page: "24", page: String(opts.page ?? 1) });
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  if (opts.related) {
    params.set("related", "1");
    if (opts.topic?.trim()) params.set("topic", opts.topic.trim());
  }
  if (opts.className) params.set("class", opts.className);
  if (opts.subjectName) params.set("subject", opts.subjectName);
  if (opts.exclude?.length) params.set("exclude", opts.exclude.slice(0, 500).join(","));

  const res = await fetch(`${WP}/wp-json/rezef/v1/search?${params}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`wp ${res.status}`);
  const data = (await res.json()) as {
    total: number;
    cards: Array<Omit<WarehouseCard, "category"> & { category: string | null; categories?: string[] }>;
  };
  return {
    total: data.total,
    cards: data.cards.map(({ categories, ...c }) => ({
      ...c,
      title: decode(c.title),
      // לפוסט יכולות להיות כמה קטגוריות; מעדיפים את זו שהיא סוג תוכן מוכר.
      category: categories?.find((n) => KNOWN_TYPES.includes(n)) ?? c.category,
    })),
  };
}
