import { z } from "zod";
import { setTeacherBlocked } from "@/lib/admin";
import { numId, readJson, withAdmin } from "@/lib/http";

const schema = z.object({ blocked: z.boolean() });

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/teachers/[id]">) {
  const { id } = await ctx.params;
  return withAdmin(async (admin) => {
    const { blocked } = await readJson(req, schema);
    await setTeacherBlocked(numId(id), blocked, admin.id);
  });
}
