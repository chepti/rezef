import { z } from "zod";
import { addCrossLinks } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({ urls: z.array(z.string().max(2000)).min(1).max(30) });

export async function POST(req: Request, ctx: RouteContext<"/api/groups/[id]/cross">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { urls } = await readJson(req, schema);
    return { added: await addCrossLinks(numId(id), teacher.id, urls) };
  });
}
