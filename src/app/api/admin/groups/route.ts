import { listGroupsAdmin } from "@/lib/admin";
import { withAdmin } from "@/lib/http";

export async function GET() {
  return withAdmin(async () => ({ groups: await listGroupsAdmin() }));
}
