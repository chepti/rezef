import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { addExistingItem, ownedLesson } from "./board";
import { HttpError } from "./session";

const { files, items } = tables;
const MAX_BYTES = 3 * 1024 * 1024;
const MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// תמונה שהמורה הדביקה או גררה לשיעור: נשמרת כקובץ, והופכת לפריט מסוג "תמונה" שמוצג על המסך במצב שיעור.
export async function addImageToLesson(lessonId: number, teacherId: number, origin: string, input: { dataUrl: string; name: string; index?: number }) {
  await ownedLesson(lessonId, teacherId);
  const m = input.dataUrl.match(/^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m || !MIMES.includes(m[1])) throw new HttpError(400, "אפשר להעלות רק תמונה (PNG, JPG, WEBP או GIF)");
  const size = Math.floor((m[2].length * 3) / 4);
  if (size > MAX_BYTES) throw new HttpError(400, "התמונה גדולה מדי (עד 3MB)");

  const db = await getDb();
  const token = randomBytes(18).toString("base64url");
  await db.insert(files).values({ token, teacherId, mime: m[1], size, data: m[2] });
  const url = `${origin}/f/${token}`;
  const title = input.name.replace(/\.\w+$/, "").trim().slice(0, 80) || "תמונה";
  const [item] = await db.insert(items).values({ teacherId, url, title, imageUrl: url, kind: "image", contentType: "אחר", meta: {} }).returning();
  await addExistingItem(lessonId, teacherId, item.id, input.index);
  return { itemId: item.id, url };
}

export async function readFile(token: string) {
  const db = await getDb();
  const [file] = await db.select().from(files).where(eq(files.token, token)).limit(1);
  return file ?? null;
}
