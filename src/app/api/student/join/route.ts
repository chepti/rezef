import { z } from "zod";
import { readJson } from "@/lib/http";
import { joinGroup, withStudent } from "@/lib/student";

const schema = z.object({ code: z.string().min(4).max(12), nickname: z.string().min(1).max(40) });

export async function POST(req: Request) {
  return withStudent(async (student) => {
    const { code, nickname } = await readJson(req, schema);
    return joinGroup(student.id, code, nickname);
  });
}
