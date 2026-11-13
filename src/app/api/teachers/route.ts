import { type NextRequest } from "next/server";
import { withTeacher } from "@/lib/http";
import { listTeachers } from "@/lib/social";

// מורים ששיתפו רצף, ומורים שאני כבר עוקבת אחריהם.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return withTeacher(async (teacher) => ({ teachers: await listTeachers(teacher.id, q) }));
}
