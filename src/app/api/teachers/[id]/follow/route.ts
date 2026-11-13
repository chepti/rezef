import { z } from "zod";
import { numId, readJson, withTeacher } from "@/lib/http";
import { follow, unfollow } from "@/lib/social";

const schema = z.object({ subjects: z.array(z.string().max(60)).max(20).default([]), classes: z.array(z.string().max(30)).max(20).default([]) });

// מעקב (או עדכון ההיקף שלו): באילו תחומים וכיתות להציע לי את התוכן של המורה.
export async function PUT(req: Request, ctx: RouteContext<"/api/teachers/[id]/follow">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    await follow(teacher.id, numId(id), await readJson(req, schema));
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/teachers/[id]/follow">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    await unfollow(teacher.id, numId(id));
  });
}
