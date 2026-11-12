import { NextResponse } from "next/server";
import { appUrl, cookieBase } from "@/lib/auth";
import { createStudentToken, STUDENT_COOKIE, upsertStudent } from "@/lib/student";

// כניסת תלמיד לדוגמה, לפיתוח מקומי בלבד. בייצור DEV_LOGIN לא מוגדר והנתיב מחזיר 404.
export async function GET(req: Request) {
  if (process.env.DEV_LOGIN !== "1") return new NextResponse(null, { status: 404 });
  const n = new URL(req.url).searchParams.get("n") ?? "1";
  const student = await upsertStudent(`dev-student-${n.replace(/\W/g, "")}`, "schools.org.il");
  const res = NextResponse.redirect(`${appUrl(req)}/s`);
  res.cookies.set(STUDENT_COOKIE, await createStudentToken(student.id), { ...cookieBase, maxAge: 60 * 60 * 24 });
  return res;
}
