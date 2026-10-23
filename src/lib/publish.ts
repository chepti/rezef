import { asc, eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { ownedLesson } from "./board";
import { HttpError, type Teacher } from "./session";
import { signedPost } from "./wp-bridge";

const { items, lessonItems, lessons } = tables;

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

export type LessonPublishRow = {
  lessonItemId: number;
  include: boolean;
  // ההערה "איך משתמשים בזה" שתופיע בפריט באוסף.
  note: string;
  // רק לפריט חיצוני שעוד לא פורסם: פרטי ההגשה החדשה.
  title?: string;
  intro?: string;
  category?: string;
  imageUrl?: string;
  credit?: string;
};

export type LessonPublishInput = {
  name: string;
  description: string;
  classes: string[];
  subjects: string[];
  tags: string[];
  items: LessonPublishRow[];
};

// פרסום שיעור שלם כאוסף בחומר פתוח: פריט שכבר באתר נכנס כמו שהוא, פריט חיצוני מפורסם קודם כהגשה
// ממתינה, ואז נוצר אוסף בבעלות המורה עם כולם לפי סדר השיעור וההערה של כל פריט.
// פרסום חוזר של אותו שיעור מעדכן את אותו אוסף, ולא יוצר כפילות.
export async function publishLesson(lessonId: number, teacher: Teacher, input: LessonPublishInput) {
  const db = await getDb();
  const { lesson } = await ownedLesson(lessonId, teacher.id);
  if (!teacher.wpUserId || teacher.wpUserId < 1) throw new HttpError(400, "פרסום זמין רק עם חשבון חומר פתוח");

  const rows = await db
    .select({ li: lessonItems, item: items })
    .from(lessonItems)
    .innerJoin(items, eq(items.id, lessonItems.itemId))
    .where(eq(lessonItems.lessonId, lessonId))
    .orderBy(asc(lessonItems.position), asc(lessonItems.id));

  const byId = new Map(input.items.map((r) => [r.lessonItemId, r]));
  const resolved: Array<{ post_id: number; note: string }> = [];
  const failed: Array<{ lessonItemId: number; title: string; error: string }> = [];

  for (const { li, item } of rows) {
    const row = byId.get(li.id);
    if (!row?.include) continue;

    let postId: number | null = item.kind === "openstuff" ? item.openstuffPostId : item.publishedPostId;
    if (!postId) {
      try {
        const published = await publishItem(item.id, teacher, {
          title: row.title?.trim() || item.title,
          intro: row.intro?.trim() ?? "",
          category: row.category ?? item.contentType ?? "אחר",
          classes: input.classes,
          subjects: input.subjects,
          tags: input.tags,
          credit: row.credit,
          imageUrl: row.imageUrl?.trim() || item.imageUrl || undefined,
        });
        postId = published.publishedPostId;
      } catch (e) {
        failed.push({ lessonItemId: li.id, title: item.title, error: e instanceof Error ? e.message : "הפרסום נכשל" });
        continue;
      }
    }
    if (postId) resolved.push({ post_id: postId, note: row.note.trim() });
  }

  if (resolved.length === 0) {
    throw new HttpError(400, failed[0]?.error ?? "אין פריטים לפרסום");
  }

  const result = await signedPost("collection", teacher.wpUserId, {
    term_id: lesson.publishedCollectionId ?? undefined,
    name: input.name,
    description: input.description,
    items: resolved,
  });
  const body = result.json as { term_id?: number; url?: string; added?: number; message?: string };
  if (result.status !== 200 || !body.term_id) {
    throw new HttpError(result.status >= 400 && result.status < 500 ? 400 : 502, body.message || "יצירת האוסף נכשלה");
  }

  await db
    .update(lessons)
    .set({ publishedCollectionId: body.term_id, publishedCollectionUrl: body.url ?? null, publishedAt: new Date() })
    .where(eq(lessons.id, lessonId));

  return { url: body.url ?? null, termId: body.term_id, added: body.added ?? resolved.length, failed };
}
