import { getBoard } from "@/lib/board";
import { numId, withTeacher } from "@/lib/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/groups/[id]/board">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => getBoard(numId(id), teacher.id));
}
