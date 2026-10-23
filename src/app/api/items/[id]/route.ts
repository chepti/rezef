import { z } from "zod";
import { updateItem } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";
import { CONTENT_TYPES } from "@/lib/unfurl";

const schema = z.object({ contentType: z.enum(CONTENT_TYPES).optional() });

export async function PATCH(req: Request, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const patch = await readJson(req, schema);
    await updateItem(numId(id), teacher.id, patch);
  });
}
