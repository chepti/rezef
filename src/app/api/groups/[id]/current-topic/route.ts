import { z } from "zod";
import { setCurrentTopic } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const schema = z.object({ topicId: z.number().int().positive() });

export async function POST(req: Request, ctx: RouteContext<"/api/groups/[id]/current-topic">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { topicId } = await readJson(req, schema);
    await setCurrentTopic(numId(id), teacher.id, topicId);
  });
}
