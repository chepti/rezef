import { eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { HttpError, type Teacher } from "./session";
import { signedPost } from "./wp-bridge";

const { items } = tables;

export type PublishInput = {
  title: string;
  intro: string;
  category: string;
  classes: string[];
  subjects: string[];
  tags: string[];
  credit?: string;
  imageUrl?: string;
};

// פרסום פריט מהרצף כהגשה ממתינה בחומר פתוח. עובר באותו צינור וולידציה כמו טופס ההגשה,
// ולכן נכנס לתור הסקירה הרגיל ולא מתפרסם מיד.
export async function publishItem(itemId: number, teacher: Teacher, input: PublishInput) {
  const db = await getDb();
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item || item.teacherId !== teacher.id) throw new HttpError(404, "הפריט לא נמצא");
  if (item.kind === "openstuff") throw new HttpError(400, "הפריט כבר נמצא בחומר פתוח");
  if (item.publishedPostId) throw new HttpError(409, "הפריט כבר נשלח לחומר פתוח");
  if (!teacher.wpUserId || teacher.wpUserId < 1) throw new HttpError(400, "פרסום זמין רק עם חשבון חומר פתוח");

  const result = await signedPost("publish", teacher.wpUserId, {
    title: input.title,
    intro: input.intro,
    content_link: item.url,
    credit: input.credit ?? teacher.displayName,
    platform: item.siteName ?? "",
    tags: input.tags.join(", "),
    class: input.classes,
    subject: input.subjects,
    category: [input.category],
    featured_image_url: input.imageUrl ?? item.imageUrl ?? "",
  });

  const body = result.json as { id?: number; message?: string; data?: { errors?: Record<string, string> } };
  if (result.status !== 201 || !body.id) {
    const fieldErrors = body.data?.errors ? Object.values(body.data.errors).join(" ") : "";
    throw new HttpError(result.status >= 400 && result.status < 500 ? 400 : 502, fieldErrors || body.message || "הפרסום נכשל");
  }

  const [updated] = await db
    .update(items)
    .set({ publishedPostId: body.id, publishedAt: new Date() })
    .where(eq(items.id, itemId))
    .returning();
  return updated;
}
