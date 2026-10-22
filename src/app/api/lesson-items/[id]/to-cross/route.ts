import { z } from "zod";
import { lessonItemToCross } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({ topicId: z.number().int().positive().nullable().optional() });

export async function POST(req: Request, ctx: RouteContext<"/api/lesson-items/[id]/to-cross">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { topicId } = await readJson(req, schema);
    return { added: await lessonItemToCross(numId(id), teacher.id, topicId) };
  });
}
