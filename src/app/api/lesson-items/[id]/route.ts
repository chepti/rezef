import { z } from "zod";
import { deleteLessonItem, moveLessonItem, updateLessonItem } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({
  note: z.string().max(2000).optional(),
  phase: z.enum(["הקניה", "תרגול", "הערכה", "רקע", "העשרה"]).nullable().optional(),
  level: z.enum(["base", "mid", "advanced"]).nullable().optional(),
  isAssignment: z.boolean().optional(),
  move: z.object({ lessonId: z.number().int().positive(), index: z.number().int().min(0) }).optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/lesson-items/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { move, ...patch } = await readJson(req, schema);
    const itemId = numId(id);
    await updateLessonItem(itemId, teacher.id, patch);
    if (move) await moveLessonItem(itemId, teacher.id, move.lessonId, move.index);
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/lesson-items/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    await deleteLessonItem(numId(id), teacher.id);
  });
}
