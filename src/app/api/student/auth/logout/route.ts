import { NextResponse } from "next/server";
import { STUDENT_COOKIE } from "@/lib/student";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(STUDENT_COOKIE);
  return res;
}
