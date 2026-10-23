import { type NextRequest } from "next/server";
import { z } from "zod";
import { deleteTopic, updateTopic } from "@/lib/board";
import { numId, readJson, withTeacher } from "@/lib/http";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  index: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/topics/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const patch = await readJson(req, patchSchema);
    await updateTopic(numId(id), teacher.id, patch);
  });
}

// ?moveTo=<topicId> להעברת השיעורים לנושא אחר, או ?deleteLessons=1 למחיקתם עם הנושא.
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/topics/[id]">) {
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  return withTeacher(async (teacher) => {
    await deleteTopic(numId(id), teacher.id, {
      moveTo: sp.get("moveTo") ? numId(sp.get("moveTo")!) : undefined,
      deleteLessons: sp.get("deleteLessons") === "1",
    });
  });
}
