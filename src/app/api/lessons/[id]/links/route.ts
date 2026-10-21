import { z } from "zod";
import { addLinksToLesson } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({
  urls: z.array(z.string().max(2000)).min(1).max(30),
  index: z.number().int().min(0).optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/lessons/[id]/links">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { urls, index } = await readJson(req, schema);
    return { added: await addLinksToLesson(numId(id), teacher.id, urls, index) };
  });
}
