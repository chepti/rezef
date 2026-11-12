import { numId, withTeacher } from "@/lib/http";
import { listSubmissions } from "@/lib/student";

export async function GET(_req: Request, ctx: RouteContext<"/api/lesson-items/[id]/submissions">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => ({ rows: await listSubmissions(numId(id), teacher.id) }));
}
