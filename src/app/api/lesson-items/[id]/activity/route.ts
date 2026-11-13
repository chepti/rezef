import { activityReport } from "@/lib/activity";
import { numId, withTeacher } from "@/lib/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/lesson-items/[id]/activity">) {
  const { id } = await ctx.params;
  return withTeacher((teacher) => activityReport(numId(id), teacher.id));
}
