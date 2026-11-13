import { readActivityPage } from "@/lib/activity";

// פעילות HTML שמורה הדביקה. הקוד לא נבדק, ולכן הוא תמיד רץ בארגז חול: מקור אטום, בלי גישה לעוגיות,
// לאחסון ולממשקי האתר, ובלי יכולת להחליף את הדף העוטף. זה נכון גם כשפותחים את הכתובת ישירות בלשונית.
export async function GET(_req: Request, ctx: RouteContext<"/h/[token]">) {
  const { token } = await ctx.params;
  if (!/^[\w-]{16,40}$/.test(token)) return new Response(null, { status: 404 });
  const html = await readActivityPage(token);
  if (html === null) return new Response(null, { status: 404 });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "sandbox allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
      // המורה יכולה לעדכן את הקוד, ולכן בלי מטמון ארוך.
      "cache-control": "private, no-cache",
    },
  });
}
