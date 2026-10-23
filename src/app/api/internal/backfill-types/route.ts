import { timingSafeEqual } from "node:crypto";
import { type NextRequest } from "next/server";
import { backfillContentTypes } from "@/lib/backfill";

function keyMatches(given: string | null): boolean {
  const expected = process.env.INTERNAL_KEY;
  if (!expected || expected.length < 32 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!keyMatches(req.headers.get("x-internal-key"))) {
    return Response.json({ error: "אין הרשאה" }, { status: 401 });
  }
  try {
    return Response.json(await backfillContentTypes());
  } catch (e) {
    console.error(e);
    return Response.json({ error: "המילוי נכשל" }, { status: 500 });
  }
}
