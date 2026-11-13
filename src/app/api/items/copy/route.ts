import { z } from "zod";
import { readJson, withTeacher } from "@/lib/http";
import { copyPeerItem } from "@/lib/social";

const schema = z.object({
  sourceItemId: z.number().int().positive(),
  lessonId: z.number().int().positive().optional(),
  index: z.number().int().min(0).optional(),
  groupId: z.number().int().positive().optional(),
  topicId: z.number().int().positive().nullable().optional(),
});

// העתקת פריט מרצף משותף של מורה אחרת אל שיעור שלי, או אל הקישורים הכלליים שלי.
export async function POST(req: Request) {
  return withTeacher(async (teacher) => {
    const body = await readJson(req, schema);
    return copyPeerItem(teacher.id, body.sourceItemId, body);
  });
}
