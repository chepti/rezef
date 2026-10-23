import { z } from "zod";
import { crossItemToLesson } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({
  lessonId: z.number().int().positive(),
  index: z.number().int().min(0).optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/cross/[id]/to-lesson">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { lessonId, index } = await readJson(req, schema);
    return { added: await crossItemToLesson(numId(id), teacher.id, lessonId, index) };
  });
}
