import { type NextRequest, NextResponse } from "next/server";
import { studentsEnabled } from "@/lib/admin";
import { appUrl, cookieBase } from "@/lib/auth";
import {
  createStudentToken,
  domainAllowed,
  exchangeGoogleCode,
  googleConfigured,
  STUDENT_COOKIE,
  STUDENT_STATE_COOKIE,
  upsertStudent,
} from "@/lib/student";

export async function GET(req: NextRequest) {
  const origin = appUrl(req);
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${origin}/s?error=${code}`);
    res.cookies.delete(STUDENT_STATE_COOKIE);
    return res;
  };
  if (!googleConfigured()) return fail("not-ready");
  if (!(await studentsEnabled())) return fail("off");

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const expected = req.cookies.get(STUDENT_STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return fail("login");

  try {
    const { sub, domain } = await exchangeGoogleCode(origin, code);
    // רק חשבון של בית ספר מרשימת הדומיינים המותרים. חשבון פרטי נדחה.
    if (!(await domainAllowed(domain))) return fail("domain");
    const student = await upsertStudent(sub, domain);
    const res = NextResponse.redirect(`${origin}/s`);
    res.cookies.set(STUDENT_COOKIE, await createStudentToken(student.id), { ...cookieBase, maxAge: 60 * 60 * 24 * 30 });
    res.cookies.delete(STUDENT_STATE_COOKIE);
    return res;
  } catch {
    return fail("login");
  }
}
