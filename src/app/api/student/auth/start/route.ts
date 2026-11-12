import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appUrl, cookieBase } from "@/lib/auth";
import { googleAuthUrl, googleConfigured, STUDENT_STATE_COOKIE } from "@/lib/student";

export async function GET(req: Request) {
  const origin = appUrl(req);
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/s?error=not-ready`);
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(googleAuthUrl(origin, state));
  res.cookies.set(STUDENT_STATE_COOKIE, state, { ...cookieBase, maxAge: 600 });
  return res;
}
