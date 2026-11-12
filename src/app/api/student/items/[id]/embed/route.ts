import { numId } from "@/lib/http";
import { studentItemEmbed, withStudent } from "@/lib/student";

export async function GET(_req: Request, ctx: RouteContext<"/api/student/items/[id]/embed">) {
  const { id } = await ctx.params;
  return withStudent((student) => studentItemEmbed(student.id, numId(id)));
}
