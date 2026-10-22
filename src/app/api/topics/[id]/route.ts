import { z } from "zod";
import { deleteTopic, renameTopic } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({ name: z.string().min(1).max(60) });

export async function PATCH(req: Request, ctx: RouteContext<"/api/topics/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { name } = await readJson(req, schema);
    await renameTopic(numId(id), teacher.id, name);
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/topics/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    await deleteTopic(numId(id), teacher.id);
  });
}
