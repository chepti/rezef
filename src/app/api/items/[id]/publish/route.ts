import { z } from "zod";
import { numId, readJson, withTeacher } from "@/lib/http";
import { publishItem } from "@/lib/publish";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  intro: z.string().trim().min(1).max(600),
  category: z.string().trim().min(1).max(60),
  classes: z.array(z.string().max(30)).min(1).max(14),
  subjects: z.array(z.string().max(60)).min(1).max(6),
  tags: z.array(z.string().max(30)).max(12),
  credit: z.string().trim().max(80).optional(),
  imageUrl: z.string().url().max(2000).optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/items/[id]/publish">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const input = await readJson(req, schema);
    const item = await publishItem(numId(id), teacher, input);
    return { item };
  });
}
