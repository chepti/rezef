import { z } from "zod";
import { numId, readJson, withTeacher } from "@/lib/http";
import { publishLesson } from "@/lib/publish";

const row = z.object({
  lessonItemId: z.number().int().positive(),
  include: z.boolean(),
  note: z.string().max(500),
  title: z.string().max(200).optional(),
  intro: z.string().max(600).optional(),
  category: z.string().max(60).optional(),
  imageUrl: z.string().max(2000).optional(),
  credit: z.string().max(80).optional(),
});

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  classes: z.array(z.string().max(30)).max(14),
  subjects: z.array(z.string().max(60)).max(6),
  tags: z.array(z.string().max(30)).max(12),
  items: z.array(row).min(1).max(100),
});

export async function POST(req: Request, ctx: RouteContext<"/api/lessons/[id]/publish">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const input = await readJson(req, schema);
    return publishLesson(numId(id), teacher, input);
  });
}
