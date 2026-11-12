import { z } from "zod";
import { numId, readJson, withTeacher } from "@/lib/http";
import { setFeedback } from "@/lib/student";

const schema = z.object({ feedback: z.string().max(1000) });

// משוב קצר של המורה על הגשה.
export async function PATCH(req: Request, ctx: RouteContext<"/api/submissions/[id]">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const { feedback } = await readJson(req, schema);
    await setFeedback(numId(id), teacher.id, feedback);
  });
}
