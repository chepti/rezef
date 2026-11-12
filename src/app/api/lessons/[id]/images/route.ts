import { z } from "zod";
import { appUrl } from "@/lib/auth";
import { numId, readJson, withTeacher } from "@/lib/http";
import { addImageToLesson } from "@/lib/uploads";

const schema = z.object({ dataUrl: z.string().min(30).max(4_300_000), name: z.string().max(200).optional(), index: z.number().int().min(0).optional() });

// הדבקה או גרירה של תמונה לשיעור.
export async function POST(req: Request, ctx: RouteContext<"/api/lessons/[id]/images">) {
  const { id } = await ctx.params;
  return withTeacher(async (teacher) => {
    const body = await readJson(req, schema);
    return addImageToLesson(numId(id), teacher.id, appUrl(req), { dataUrl: body.dataUrl, name: body.name ?? "", index: body.index });
  });
}
