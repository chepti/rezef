import { z } from "zod";
import { deleteCrossItem, updateCross } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({
  topicId: z.number().int().positive().nullable().optional(),
  note: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/cross/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const patch = await readJson(req, schema);
    await updateCross(numId(id), teacher.id, patch);
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/cross/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    await deleteCrossItem(numId(id), teacher.id);
  });
}
