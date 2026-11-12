import { type NextRequest } from "next/server";
import { HttpError } from "@/lib/session";
import { withTeacher } from "@/lib/http";
import { resolveEmbed } from "@/lib/embed";

// האם אפשר להציג את הקישור בתוך מסגרת במצב שיעור, ובאיזו כתובת.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  return withTeacher(async () => {
    if (!/^https?:\/\//i.test(url) || url.length > 2000) throw new HttpError(400, "קישור לא תקין");
    return resolveEmbed(url);
  });
}
