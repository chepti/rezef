import { z } from "zod";
import { readJson } from "@/lib/http";
import { setSubmission, withStudent } from "@/lib/student";

const schema = z.object({ lessonItemId: z.number().int().positive(), done: z.boolean() });

export async function POST(req: Request) {
  return withStudent(async (student) => {
    const { lessonItemId, done } = await readJson(req, schema);
    await setSubmission(student.id, lessonItemId, done);
  });
}
