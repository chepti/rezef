import { z } from "zod";
import { numId, readJson, withTeacher } from "@/lib/http";
import { setGroupSharing } from "@/lib/social";

const schema = z.object({ shared: z.boolean() });

export async function POST(req: Request, ctx: RouteContext<"/api/groups/[id]/sharing">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { shared } = await readJson(req, schema);
    await setGroupSharing(numId(id), teacher.id, shared);
  });
}
