import { z } from "zod";
import { addExistingItem } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({
  itemId: z.number().int().positive(),
  index: z.number().int().min(0).optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/lessons/[id]/items">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { itemId, index } = await readJson(req, schema);
    return { added: await addExistingItem(numId(id), teacher.id, itemId, index) };
  });
}
