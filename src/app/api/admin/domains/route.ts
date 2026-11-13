import { z } from "zod";
import { addDomains, listDomains } from "@/lib/admin";
import { readJson, withAdmin } from "@/lib/http";

export async function GET() {
  return withAdmin(() => listDomains());
}

const schema = z.object({ text: z.string().min(3).max(5000), region: z.string().max(60).optional(), note: z.string().max(120).optional() });

// הוספה של דומיין אחד או רשימה שלמה (הדבקה).
export async function POST(req: Request) {
  return withAdmin(async () => {
    const { text, region, note } = await readJson(req, schema);
    return addDomains(text, region, note);
  });
}
