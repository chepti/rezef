import { z } from "zod";
import { createHtmlActivity, MAX_HTML_CHARS } from "@/lib/activity";
import { appUrl } from "@/lib/auth";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({ html: z.string().min(20).max(MAX_HTML_CHARS + 100), title: z.string().max(200).optional(), index: z.number().int().min(0).optional() });

// הדבקת קוד HTML (משחק, לומדה, סימולציה) כפריט חי בשיעור.
export async function POST(req: Request, ctx: RouteContext<"/api/lessons/[id]/html">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const body = await readJson(req, schema);
    return createHtmlActivity(numId(id), teacher.id, appUrl(req), body);
  });
}
