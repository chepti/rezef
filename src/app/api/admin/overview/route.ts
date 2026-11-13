import { withAdmin } from "@/lib/http";
import { overview } from "@/lib/admin";

export async function GET() {
  return withAdmin(() => overview());
}
