import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, tables } from "@/db";
import { readSessionToken, SESSION_COOKIE } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Teacher = typeof tables.teachers.$inferSelect;

export async function requireTeacher(): Promise<Teacher> {
  // cookies() קודם לכל גישה ל-DB: כך בזמן build הבקשה נעצרת מיד כדינמית ולא מתחילה אתחול DB.
  const jar = await cookies();
  const db = await getDb();

  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const teacherId = await readSessionToken(token);
    if (teacherId) {
      const [teacher] = await db.select().from(tables.teachers).where(eq(tables.teachers.id, teacherId)).limit(1);
      if (teacher) return teacher;
    }
  }

  // מצב פיתוח מקומי בלבד: מורה קבוע בלי כניסה. בייצור DEV_LOGIN לא מוגדר.
  if (process.env.DEV_LOGIN === "1") {
    const existing = await db.select().from(tables.teachers).where(eq(tables.teachers.wpUserId, -1)).limit(1);
    if (existing[0]) return existing[0];
    const [created] = await db
      .insert(tables.teachers)
      .values({ displayName: "מורה לדוגמה", wpUserId: -1 })
      .returning();
    return created;
  }

  throw new HttpError(401, "נדרשת התחברות");
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return Response.json({ error: "שגיאת שרת" }, { status: 500 });
}
