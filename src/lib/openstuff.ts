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
};

type WpPost = {
  id: number;
  link: string;
  title: { rendered: string };
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
    "wp:term"?: Array<Array<{ taxonomy: string; name: string }>>;
  };
};

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
}): Promise<{ cards: WarehouseCard[]; total: number }> {
  const params = new URLSearchParams({
    per_page: "20",
    page: String(opts.page ?? 1),
    _embed: "1",
  });
  if (opts.q?.trim()) params.set("search", opts.q.trim());

  // שם שלא נמצא ברשימת המונחים פשוט לא מסנן: עדיף יותר תוצאות מאשר מסך ריק.
  if (opts.className) {
    const id = (await getTerms("classes")).find((t) => t.name === opts.className)?.id;
    if (id) params.set("classes", String(id));
  }
  if (opts.subjectName) {
    const id = (await getTerms("subjects")).find((t) => t.name === opts.subjectName)?.id;
    if (id) params.set("subjects", String(id));
  }

  const { data, total } = await wp<WpPost[]>(`posts?${params}`);
  return {
    total,
    cards: data.map((p) => {
      const terms = (p._embedded?.["wp:term"] ?? []).flat();
      return {
        id: p.id,
        url: p.link,
        title: decode(p.title.rendered),
        imageUrl: p._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
        classes: terms.filter((t) => t.taxonomy === "class").map((t) => t.name),
        subjects: terms.filter((t) => t.taxonomy === "subject").map((t) => t.name),
      };
    }),
  };
}
