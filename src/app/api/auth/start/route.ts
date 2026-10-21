import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookieBase, STATE_COOKIE } from "@/lib/auth";

export async function GET() {
  const wp = (process.env.WP_URL ?? "https://openstuff.co.il").replace(/\/$/, "");
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(`${wp}/?rezef_login=1&state=${state}`);
  res.cookies.set(STATE_COOKIE, state, { ...cookieBase, maxAge: 600 });
  return res;
}
