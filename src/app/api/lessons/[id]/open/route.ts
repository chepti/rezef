import { z } from "zod";
import { numId, readJson, withTeacher } from "@/lib/http";
import { setLessonOpen } from "@/lib/student";

const schema = z.object({ open: z.boolean() });

// פתיחה או סגירה של שיעור לתלמידים.
export async function POST(req: Request, ctx: RouteContext<"/api/lessons/[id]/open">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { open } = await readJson(req, schema);
    await setLessonOpen(numId(id), teacher.id, open);
  });
}
