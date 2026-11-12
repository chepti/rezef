import { z } from "zod";
import { readJson } from "@/lib/http";
import { deleteSubmission, saveSubmission, withStudent } from "@/lib/student";

const schema = z.object({
  lessonItemId: z.number().int().positive(),
  // remove: ביטול ההגשה.
  remove: z.boolean().optional(),
  answer: z.string().max(4000).optional(),
  link: z.string().max(500).nullable().optional(),
  rating: z.number().int().min(1).max(3).nullable().optional(),
  needsHelp: z.boolean().optional(),
});

export async function POST(req: Request) {
  return withStudent(async (student) => {
    const body = await readJson(req, schema);
    if (body.remove) {
      await deleteSubmission(student.id, body.lessonItemId);
      return;
    }
    await saveSubmission(student.id, body.lessonItemId, {
      answer: body.answer ?? "",
      link: body.link ?? null,
      rating: body.rating ?? null,
      needsHelp: body.needsHelp ?? false,
    });
  });
}
