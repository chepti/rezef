import { deleteCrossItem } from "@/lib/board";
import { numId, withTeacher } from "@/lib/http";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/cross/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    await deleteCrossItem(numId(id), teacher.id);
  });
}
