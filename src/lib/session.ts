import { eq } from "drizzle-orm";
import { getDb, tables } from "@/db";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Teacher = typeof tables.teachers.$inferSelect;

// כניסת מורה אמיתית (גשר חומר פתוח + Google ארגוני) תיכנס בשלב הבא.
// עד אז: מצב פיתוח בלבד, מורה אחד קבוע. בייצור בלי DEV_LOGIN=1 ובלי כניסה אמיתית: 401.
export async function requireTeacher(): Promise<Teacher> {
  if (process.env.DEV_LOGIN !== "1") {
    throw new HttpError(401, "נדרשת התחברות");
  }
  const db = await getDb();
  const existing = await db.select().from(tables.teachers).where(eq(tables.teachers.wpUserId, -1)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(tables.teachers)
    .values({ displayName: "מורה לדוגמה", wpUserId: -1 })
    .returning();
  return created;
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return Response.json({ error: "שגיאת שרת" }, { status: 500 });
}
