import { z } from "zod";
import { updateLesson } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({
  title: z.string().min(1).max(80).optional(),
  topicId: z.number().int().positive().optional(),
  index: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/lessons/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const patch = await readJson(req, schema);
    await updateLesson(numId(id), teacher.id, patch);
  });
}
