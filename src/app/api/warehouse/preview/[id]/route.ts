import { HttpError } from "@/lib/session";
import { numId, withTeacher } from "@/lib/http";

const WP = (process.env.WP_URL ?? "https://openstuff.co.il").replace(/\/$/, "");

// נתוני התצוגה המקדימה של פוסט מחומר פתוח (ציבוריים). עוברים דרך השרת כדי לא לחשוף את הכתובת ללקוח ולא לתלות ב-CORS.
export async function GET(_req: Request, ctx: RouteContext<"/api/warehouse/preview/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async () => {
    const postId = numId(id);
    let res: Response;
    try {
      res = await fetch(`${WP}/wp-json/rezef/v1/preview/${postId}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new HttpError(502, "חומר פתוח לא ענה כרגע");
    }
    if (res.status === 404) throw new HttpError(404, "הפריט לא נמצא או שעדיין לא פורסם");
    if (!res.ok) throw new HttpError(502, "חומר פתוח לא ענה כרגע");
    return await res.json();
  });
}
