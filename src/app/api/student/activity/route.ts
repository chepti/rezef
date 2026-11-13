import { z } from "zod";
import { recordActivity } from "@/lib/activity";
import { readJson } from "@/lib/http";
import { withStudent } from "@/lib/student";

const text = (max: number) => z.string().max(max).optional();
const event = z.discriminatedUnion("t", [
  z.object({ t: z.literal("start") }),
  z.object({ t: z.literal("answer"), id: text(80), q: text(500), concept: text(80), correct: z.boolean().nullable(), response: text(2000), expected: text(500) }),
  z.object({ t: z.literal("progress"), percent: z.number().min(0).max(100) }),
  z.object({ t: z.literal("finish"), score: z.number().min(0).max(100000).nullable().optional(), maxScore: z.number().min(0).max(100000).nullable().optional(), summary: text(1000) }),
]);
const schema = z.object({
  lessonItemId: z.number().int().positive(),
  clientKey: z.string().regex(/^[\w-]{8,40}$/),
  activeSeconds: z.number().min(0).max(86400),
  events: z.array(event).max(100),
});

// דיווח שימוש מפעילות HTML: זמן עבודה ואירועים (תשובות, התקדמות, סיום). נשלח מהדף של התלמיד, לא מהפעילות עצמה.
export async function POST(req: Request) {
  return withStudent(async (student) => {
    const body = await readJson(req, schema);
    await recordActivity(student.id, body);
  });
}
