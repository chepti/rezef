import { z } from "zod";
import { createGroup, listGroups } from "@/lib/board";
import { readJson, withTeacher } from "@/lib/http";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  className: z.string().max(30).optional(),
  subjectName: z.string().max(60).optional(),
});

export async function GET() {
  return withTeacher(async (teacher) => ({ groups: await listGroups(teacher.id) }));
}

export async function POST(req: Request) {
  return withTeacher(async (teacher) => {
    const input = await readJson(req, createSchema);
    return { group: await createGroup(teacher.id, input) };
  });
}
