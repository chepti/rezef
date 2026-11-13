import { z } from "zod";
import { getSettings, setSettings } from "@/lib/admin";
import { readJson, withAdmin } from "@/lib/http";

export async function GET() {
  return withAdmin(() => getSettings());
}

const schema = z.object({
  students_enabled: z.enum(["0", "1"]).optional(),
  teachers_open: z.enum(["0", "1"]).optional(),
  student_notice: z.string().max(300).optional(),
  teacher_notice: z.string().max(300).optional(),
});

export async function PATCH(req: Request) {
  return withAdmin(async () => {
    await setSettings(await readJson(req, schema));
    return getSettings();
  });
}
