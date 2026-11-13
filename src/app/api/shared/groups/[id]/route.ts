import { numId, withTeacher } from "@/lib/http";
import { sharedSequenceView } from "@/lib/social";

// רצף משותף של מורה אחרת, לקריאה בלבד.
export async function GET(_req: Request, ctx: RouteContext<"/api/shared/groups/[id]">) {
  const { id } = await ctx.params;
  return withTeacher((teacher) => sharedSequenceView(numId(id), teacher.id));
}
