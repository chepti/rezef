import { z } from "zod";
import { renameLesson } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({ title: z.string().min(1).max(80) });

export async function PATCH(req: Request, ctx: RouteContext<"/api/lessons/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { title } = await readJson(req, schema);
    await renameLesson(numId(id), teacher.id, title);
  });
}
