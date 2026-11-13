import { z } from "zod";
import { getHtmlActivity, MAX_HTML_CHARS, updateHtmlActivity } from "@/lib/activity";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({ html: z.string().min(20).max(MAX_HTML_CHARS + 100).optional(), title: z.string().max(200).optional() });

// הקוד של פעילות HTML, לעריכה על ידי המורה שיצרה אותה.
export async function GET(_req: Request, ctx: RouteContext<"/api/items/[id]/html">) {
  const { id } = await ctx.params;
  return withTeacher((teacher) => getHtmlActivity(numId(id), teacher.id));
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/items/[id]/html">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const patch = await readJson(req, schema);
    return updateHtmlActivity(numId(id), teacher.id, patch);
  });
}
