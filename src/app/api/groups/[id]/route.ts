import { z } from "zod";
import { updateGroup } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  className: z.string().max(30).nullable().optional(),
  subjectName: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().max(30)).max(12).optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/groups/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const patch = await readJson(req, schema);
    await updateGroup(numId(id), teacher.id, patch);
  });
}
