import { z } from "zod";
import { numId, readJson } from "@/lib/http";
import { errorResponse } from "@/lib/session";
import { renameSelf, studentGroupView, withStudent } from "@/lib/student";

// תצוגת הקבוצה לתלמיד שחבר בה, או למורה של הקבוצה (תצוגה מקדימה).
export async function GET(_req: Request, ctx: RouteContext<"/api/student/groups/[id]">) {
  const { id } = await ctx.params;
  try {
    return Response.json(await studentGroupView(numId(id)));
  } catch (e) {
    if (e && typeof e === "object" && (e as { digest?: string }).digest === "HANGING_PROMISE_REJECTION") throw e;
    return errorResponse(e);
  }
}

const schema = z.object({ nickname: z.string().min(1).max(40) });

export async function PATCH(req: Request, ctx: RouteContext<"/api/student/groups/[id]">) {
  const { id } = await ctx.params;
  return withStudent(async (student) => {
    const { nickname } = await readJson(req, schema);
    await renameSelf(student.id, numId(id), nickname);
  });
}
