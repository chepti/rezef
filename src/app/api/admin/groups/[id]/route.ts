import { z } from "zod";
import { setGroupArchived } from "@/lib/admin";
import { numId, readJson, withAdmin } from "@/lib/http";

const schema = z.object({ archived: z.boolean() });

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/groups/[id]">) {
  const { id } = await ctx.params;
  return withAdmin(async () => {
    const { archived } = await readJson(req, schema);
    await setGroupArchived(numId(id), archived);
  });
}
