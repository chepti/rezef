import { z } from "zod";
import { numId, readJson, withTeacher } from "@/lib/http";
import { addLessonBoard, listLessonBoards } from "@/lib/student";

const schema = z.object({ image: z.string().min(30), caption: z.string().max(120).optional() });

export async function GET(_req: Request, ctx: RouteContext<"/api/lessons/[id]/boards">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => ({ boards: await listLessonBoards(numId(id), teacher.id) }));
}

// שמירת "תצוגת לוח" (מה שצויר על המסך במצב שיעור) לתלמידים.
export async function POST(req: Request, ctx: RouteContext<"/api/lessons/[id]/boards">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { image, caption } = await readJson(req, schema);
    return addLessonBoard(numId(id), teacher.id, image, caption ?? "");
  });
}
