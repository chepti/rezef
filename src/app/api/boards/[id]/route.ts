import { numId, withTeacher } from "@/lib/http";
import { deleteLessonBoard } from "@/lib/student";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/boards/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    await deleteLessonBoard(numId(id), teacher.id);
  });
}
