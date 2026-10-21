import { withTeacher } from "@/lib/http";

export async function GET() {
  return withTeacher(async (t) => ({ teacher: { id: t.id, displayName: t.displayName } }));
}
