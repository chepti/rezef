import { z } from "zod";
import { numId, readJson, withTeacher } from "@/lib/http";
import { removeMember, updateMember } from "@/lib/student";

const schema = z.object({ nickname: z.string().min(1).max(40) });

// המורה יכולה לתקן כינוי לא מתאים, או להסיר תלמיד מהקבוצה.
export async function PATCH(req: Request, ctx: RouteContext<"/api/members/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { nickname } = await readJson(req, schema);
    await updateMember(numId(id), teacher.id, nickname);
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/members/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    await removeMember(numId(id), teacher.id);
  });
}
