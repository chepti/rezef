import { readFile } from "@/lib/uploads";

// הגשת קובץ שהועלה. ציבורי למי שיש לו את הכתובת (תלמידים רואים את התמונות), והכתובת אקראית.
export async function GET(_req: Request, ctx: RouteContext<"/f/[token]">) {
  const { token } = await ctx.params;
  if (!/^[\w-]{16,40}$/.test(token)) return new Response(null, { status: 404 });
  const file = await readFile(token);
  if (!file) return new Response(null, { status: 404 });
  return new Response(Buffer.from(file.data, "base64"), {
    headers: {
      "content-type": file.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      // הקובץ הוא תמונה בלבד; גם אם ייפתח ישירות, שום סקריפט לא ירוץ ממנו.
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
