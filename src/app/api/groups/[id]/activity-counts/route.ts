import { activityCounts } from "@/lib/activity";
import { numId, withTeacher } from "@/lib/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/groups/[id]/activity-counts">) {
  const { id } = await ctx.params;
  return withTeacher((teacher) => activityCounts(numId(id), teacher.id));
}
