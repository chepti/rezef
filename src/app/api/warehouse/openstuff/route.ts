import { type NextRequest } from "next/server";
import { groupContext } from "@/lib/board";
import { HttpError } from "@/lib/session";
import { numId, withTeacher } from "@/lib/http";
import { searchOpenstuff } from "@/lib/openstuff";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return withTeacher(async (teacher) => {
    const ctx = await groupContext(numId(sp.get("group") ?? ""), teacher.id);
    const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
    try {
      // ברירת מחדל: לפי הכיתה והתחום של הקבוצה. all=1 פותח את כל המאגר.
      return await searchOpenstuff({
        q: sp.get("q") ?? "",
        className: sp.get("all") === "1" ? null : ctx.className,
        subjectName: sp.get("all") === "1" ? null : ctx.subjectName,
        page,
      });
    } catch {
      throw new HttpError(502, "חומר פתוח לא ענה כרגע");
    }
  });
}
