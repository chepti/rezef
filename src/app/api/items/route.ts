import { z } from "zod";
import { createLooseItems, listTeacherItems } from "@/lib/board";
import { readJson, withTeacher } from "@/lib/http";

const schema = z.object({ urls: z.array(z.string().max(2000)).min(1).max(30) });

export async function GET() {
  return withTeacher(async (teacher) => ({ items: await listTeacherItems(teacher.id) }));
}

export async function POST(req: Request) {
  return withTeacher(async (teacher) => {
    const { urls } = await readJson(req, schema);
    return { created: await createLooseItems(teacher.id, urls) };
  });
}
