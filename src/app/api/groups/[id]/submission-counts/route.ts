import { numId, withTeacher } from "@/lib/http";
import { submissionCounts } from "@/lib/student";

export async function GET(_req: Request, ctx: RouteContext<"/api/groups/[id]/submission-counts">) {
  const { id } = await ctx.params;
  return withTeacher((teacher) => submissionCounts(numId(id), teacher.id));
}
