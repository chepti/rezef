import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getDb, tables } from "@/db";
import { getSettings } from "@/lib/admin";
import {
  appUrl,
  cookieBase,
  createSessionToken,
  isAdminClaims,
  isPilotAllowed,
  SESSION_COOKIE,
  STATE_COOKIE,
  verifyBridgeToken,
} from "@/lib/auth";

function fail(req: Request, reason: string) {
  const res = NextResponse.redirect(`${appUrl(req)}/?login_error=${reason}`);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;

  const claims = await verifyBridgeToken(token);
  if (!claims) return fail(req, "token");
  // state קשור לדפדפן שהתחיל את הכניסה: מונע הזרקת טוקן של מישהו אחר.
  if (!expectedState || claims.state !== expectedState) return fail(req, "state");
  if (!isPilotAllowed(claims.wpUserId)) return fail(req, "pilot");

  const db = await getDb();
  const { teachers } = tables;
  const [existing] = await db.select().from(teachers).where(eq(teachers.wpUserId, claims.wpUserId)).limit(1);
  const isAdmin = isAdminClaims(claims);
  if (existing?.blocked) return fail(req, "blocked");
  // רשימה סגורה: מורה שלא נכנסה בעבר לא תיכנס עד שהמנהלת תפתח את ההרשמה (מנהלת נכנסת תמיד).
  if (!existing && !isAdmin && (await getSettings()).teachers_open !== "1") return fail(req, "closed");
  let teacherId: number;
  if (existing) {
    teacherId = existing.id;
    await db.update(teachers).set({ displayName: claims.name, isAdmin, lastLoginAt: new Date() }).where(eq(teachers.id, existing.id));
  } else {
    const [created] = await db
      .insert(teachers)
      .values({ displayName: claims.name, wpUserId: claims.wpUserId, isAdmin, lastLoginAt: new Date() })
      .returning();
    teacherId = created.id;
  }

  const res = NextResponse.redirect(`${appUrl(req)}/`);
  res.cookies.set(SESSION_COOKIE, await createSessionToken(teacherId), {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.delete(STATE_COOKIE);
  return res;
}
