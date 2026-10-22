import { z } from "zod";
import { addCrossFromItem, addCrossLinks } from "@/lib/board";
import { HttpError } from "@/lib/session";
import { numId, readJson, withTeacher } from "@/lib/http";

// urls: קישורים חדשים. itemId: פריט קיים. topicId: נושא, null = כל הנושאים, חסר = הנושא הפתוח.
const schema = z.object({
  urls: z.array(z.string().max(2000)).min(1).max(30).optional(),
  itemId: z.number().int().positive().optional(),
  topicId: z.number().int().positive().nullable().optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/groups/[id]/cross">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { urls, itemId, topicId } = await readJson(req, schema);
    if (itemId) return { added: await addCrossFromItem(numId(id), teacher.id, itemId, topicId) };
    if (urls) return { added: await addCrossLinks(numId(id), teacher.id, urls, topicId) };
    throw new HttpError(400, "חסרים קישורים או פריט");
  });
}
