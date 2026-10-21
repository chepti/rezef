import { z } from "zod";
import { addLesson } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({ title: z.string().max(80).optional() });

export async function POST(req: Request, ctx: RouteContext<"/api/groups/[id]/lessons">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { title } = await readJson(req, schema);
    return { lesson: await addLesson(numId(id), teacher.id, title) };
  });
}
