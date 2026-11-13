import { listTeachersAdmin } from "@/lib/admin";
import { withAdmin } from "@/lib/http";

export async function GET() {
  return withAdmin(async () => ({ teachers: await listTeachersAdmin() }));
}
