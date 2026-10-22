import { z } from "zod";
import { createTopic } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({ name: z.string().max(60).optional() });

export async function POST(req: Request, ctx: RouteContext<"/api/groups/[id]/topics">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { name } = await readJson(req, schema);
    return { topic: await createTopic(numId(id), teacher.id, name) };
  });
}
