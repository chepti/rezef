import { numId, withTeacher } from "@/lib/http";
import { listMembers } from "@/lib/student";

export async function GET(_req: Request, ctx: RouteContext<"/api/groups/[id]/members">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => ({ members: await listMembers(numId(id), teacher.id) }));
}
