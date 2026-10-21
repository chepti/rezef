import { asc, desc, eq, inArray, max, sql } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { HttpError } from "./session";
import { unfurl } from "./unfurl";

const { groups, sequences, lessons, items, lessonItems, crossItems } = tables;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function currentSchoolYear(now = new Date()): string {
  const y = now.getFullYear();
  const start = now.getMonth() >= 7 ? y : y - 1; // שנת הלימודים מתחילה באוגוסט-ספטמבר
  return `${start}-${String(start + 1).slice(2)}`;
}

export async function listGroups(teacherId: number) {
  const db = await getDb();
  return db.select().from(groups).where(eq(groups.teacherId, teacherId)).orderBy(asc(groups.createdAt));
}

export async function createGroup(
  teacherId: number,
  input: { name: string; className?: string; subjectName?: string },
) {
  const db = await getDb();
  const name = input.name.trim();
  if (!name) throw new HttpError(400, "חסר שם קבוצה");

  let joinCode = randomCode();
  for (let i = 0; i < 5; i++) {
    const clash = await db.select({ id: groups.id }).from(groups).where(eq(groups.joinCode, joinCode)).limit(1);
    if (clash.length === 0) break;
    joinCode = randomCode();
  }

  const [group] = await db
    .insert(groups)
    .values({
      teacherId,
      name,
      className: input.className?.trim() || null,
      subjectName: input.subjectName?.trim() || null,
      schoolYear: currentSchoolYear(),
      joinCode,
    })
    .returning();

  const [sequence] = await db.insert(sequences).values({ groupId: group.id, title: name }).returning();
  await db.insert(lessons).values({ sequenceId: sequence.id, position: 1, title: "שיעור 1" });
  return group;
}

async function ownedGroup(groupId: number, teacherId: number) {
  const db = await getDb();
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group || group.teacherId !== teacherId) throw new HttpError(404, "הקבוצה לא נמצאה");
  return group;
}

async function ownedLesson(lessonId: number, teacherId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ lesson: lessons, group: groups })
    .from(lessons)
    .innerJoin(sequences, eq(sequences.id, lessons.sequenceId))
    .innerJoin(groups, eq(groups.id, sequences.groupId))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!row || row.group.teacherId !== teacherId) throw new HttpError(404, "השיעור לא נמצא");
  return row;
}

async function ownedLessonItem(id: number, teacherId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ li: lessonItems, lesson: lessons, group: groups })
    .from(lessonItems)
    .innerJoin(lessons, eq(lessons.id, lessonItems.lessonId))
    .innerJoin(sequences, eq(sequences.id, lessons.sequenceId))
    .innerJoin(groups, eq(groups.id, sequences.groupId))
    .where(eq(lessonItems.id, id))
    .limit(1);
  if (!row || row.group.teacherId !== teacherId) throw new HttpError(404, "הפריט לא נמצא");
  return row;
}

export async function getBoard(groupId: number, teacherId: number) {
  const db = await getDb();
  const group = await ownedGroup(groupId, teacherId);
  const [sequence] = await db.select().from(sequences).where(eq(sequences.groupId, group.id)).limit(1);
  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.sequenceId, sequence.id))
    .orderBy(asc(lessons.position));

  const lessonIds = lessonRows.map((l) => l.id);
  const itemRows = lessonIds.length
    ? await db
        .select({ li: lessonItems, item: items })
        .from(lessonItems)
        .innerJoin(items, eq(items.id, lessonItems.itemId))
        .where(inArray(lessonItems.lessonId, lessonIds))
        .orderBy(asc(lessonItems.position))
    : [];

  const cross = await db
    .select({ ci: crossItems, item: items })
    .from(crossItems)
    .innerJoin(items, eq(items.id, crossItems.itemId))
    .where(eq(crossItems.sequenceId, sequence.id))
    .orderBy(asc(crossItems.id));

  return {
    group,
    sequence,
    lessons: lessonRows.map((l) => ({
      ...l,
      items: itemRows.filter((r) => r.li.lessonId === l.id).map((r) => ({ ...r.li, item: r.item })),
    })),
    crossItems: cross.map((r) => ({ ...r.ci, item: r.item })),
  };
}

export async function addLesson(lessonSequenceGroupId: number, teacherId: number, title?: string) {
  const db = await getDb();
  const group = await ownedGroup(lessonSequenceGroupId, teacherId);
  const [sequence] = await db.select().from(sequences).where(eq(sequences.groupId, group.id)).limit(1);
  const [{ top }] = await db
    .select({ top: max(lessons.position) })
    .from(lessons)
    .where(eq(lessons.sequenceId, sequence.id));
  const next = (top ?? 0) + 1;
  const [lesson] = await db
    .insert(lessons)
    .values({ sequenceId: sequence.id, position: next, title: title?.trim() || `שיעור ${next}` })
    .returning();
  return lesson;
}

export async function renameLesson(lessonId: number, teacherId: number, title: string) {
  const db = await getDb();
  await ownedLesson(lessonId, teacherId);
  const clean = title.trim();
  if (!clean) throw new HttpError(400, "חסרה כותרת");
  await db.update(lessons).set({ title: clean }).where(eq(lessons.id, lessonId));
}

const MAX_LINKS_PER_PASTE = 30;

async function unfurlMany(urls: string[]) {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(0, MAX_LINKS_PER_PASTE);
  const results: Array<NonNullable<Awaited<ReturnType<typeof unfurl>>>> = [];
  // במקביל, בקבוצות קטנות, כדי לא להציף אתרים חיצוניים.
  for (let i = 0; i < unique.length; i += 5) {
    const batch = await Promise.all(unique.slice(i, i + 5).map((u) => unfurl(u)));
    for (const r of batch) if (r) results.push(r);
  }
  return results;
}

async function insertItems(teacherId: number, unfurled: Awaited<ReturnType<typeof unfurlMany>>) {
  if (unfurled.length === 0) return [];
  const db = await getDb();
  return db
    .insert(items)
    .values(
      unfurled.map((u) => ({
        teacherId,
        url: u.url,
        title: u.title,
        imageUrl: u.imageUrl,
        siteName: u.siteName,
        kind: u.kind,
        openstuffPostId: u.openstuffPostId,
        meta: u.meta as Record<string, unknown>,
      })),
    )
    .returning();
}

// מוסיף פריטים לשיעור: בסוף, או במקום מסוים (index) כשגוררים מהמחסן.
async function attachItems(lessonId: number, itemIds: number[], index?: number) {
  const db = await getDb();
  const [{ top }] = await db
    .select({ top: max(lessonItems.position) })
    .from(lessonItems)
    .where(eq(lessonItems.lessonId, lessonId));
  let pos = top ?? 0;
  const created = await db
    .insert(lessonItems)
    .values(itemIds.map((itemId) => ({ lessonId, itemId, position: ++pos })))
    .returning();

  if (index !== undefined) {
    const newIds = new Set(created.map((c) => c.id));
    const rows = await db
      .select({ id: lessonItems.id })
      .from(lessonItems)
      .where(eq(lessonItems.lessonId, lessonId))
      .orderBy(asc(lessonItems.position), asc(lessonItems.id));
    const ordered = rows.map((r) => r.id).filter((id) => !newIds.has(id));
    ordered.splice(Math.max(0, Math.min(index, ordered.length)), 0, ...created.map((c) => c.id));
    for (let i = 0; i < ordered.length; i++) {
      await db.update(lessonItems).set({ position: i + 1 }).where(eq(lessonItems.id, ordered[i]));
    }
  }
  return created;
}

export async function addLinksToLesson(lessonId: number, teacherId: number, urls: string[], index?: number) {
  await ownedLesson(lessonId, teacherId);
  const unfurled = await unfurlMany(urls);
  if (unfurled.length === 0) throw new HttpError(400, "לא נמצאו קישורים תקינים");
  const created = await insertItems(teacherId, unfurled);
  return attachItems(
    lessonId,
    created.map((c) => c.id),
    index,
  );
}

export async function addExistingItem(lessonId: number, teacherId: number, itemId: number, index?: number) {
  const db = await getDb();
  await ownedLesson(lessonId, teacherId);
  const [item] = await db.select({ id: items.id, teacherId: items.teacherId }).from(items).where(eq(items.id, itemId)).limit(1);
  if (!item || item.teacherId !== teacherId) throw new HttpError(404, "הפריט לא נמצא");
  return attachItems(lessonId, [itemId], index);
}

// הדבקה למחסן: יוצר פריטים בלי לתלות אותם בשיעור.
export async function createLooseItems(teacherId: number, urls: string[]) {
  const unfurled = await unfurlMany(urls);
  if (unfurled.length === 0) throw new HttpError(400, "לא נמצאו קישורים תקינים");
  return insertItems(teacherId, unfurled);
}

export async function listTeacherItems(teacherId: number) {
  const db = await getDb();
  const rows = await db
    .select({ item: items, placed: sql<number>`count(${lessonItems.id})::int` })
    .from(items)
    .leftJoin(lessonItems, eq(lessonItems.itemId, items.id))
    .where(eq(items.teacherId, teacherId))
    .groupBy(items.id)
    .orderBy(desc(items.createdAt))
    .limit(60);
  return rows.map((r) => ({ ...r.item, placed: r.placed }));
}

export async function groupContext(groupId: number, teacherId: number) {
  const group = await ownedGroup(groupId, teacherId);
  return { className: group.className, subjectName: group.subjectName };
}

export async function addCrossLinks(groupId: number, teacherId: number, urls: string[]) {
  const db = await getDb();
  const group = await ownedGroup(groupId, teacherId);
  const [sequence] = await db.select().from(sequences).where(eq(sequences.groupId, group.id)).limit(1);
  const unfurled = await unfurlMany(urls);
  if (unfurled.length === 0) throw new HttpError(400, "לא נמצאו קישורים תקינים");
  const created = await insertItems(teacherId, unfurled);
  return db
    .insert(crossItems)
    .values(created.map((it) => ({ sequenceId: sequence.id, itemId: it.id })))
    .returning();
}

export async function updateLessonItem(
  id: number,
  teacherId: number,
  patch: { note?: string; phase?: string | null; level?: string | null; isAssignment?: boolean; minutes?: number | null },
) {
  const db = await getDb();
  await ownedLessonItem(id, teacherId);
  const set: Partial<typeof lessonItems.$inferInsert> = {};
  if (patch.minutes !== undefined) set.minutes = patch.minutes;
  if (patch.note !== undefined) set.note = patch.note.slice(0, 2000);
  if (patch.phase !== undefined) set.phase = patch.phase;
  if (patch.level !== undefined) set.level = patch.level;
  if (patch.isAssignment !== undefined) set.isAssignment = patch.isAssignment;
  if (Object.keys(set).length === 0) return;
  await db.update(lessonItems).set(set).where(eq(lessonItems.id, id));
}

// גרירה: מעבירה פריט לשיעור (אותו שיעור או אחר) במיקום נתון, ומסדרת מחדש את שני הצדדים.
export async function moveLessonItem(id: number, teacherId: number, toLessonId: number, toIndex: number) {
  const db = await getDb();
  const source = await ownedLessonItem(id, teacherId);
  const target = await ownedLesson(toLessonId, teacherId);
  if (source.group.id !== target.group.id) throw new HttpError(400, "אי אפשר להעביר בין קבוצות");

  await db.transaction(async (tx) => {
    await tx.update(lessonItems).set({ lessonId: toLessonId }).where(eq(lessonItems.id, id));
    const affected = new Set([source.lesson.id, toLessonId]);
    for (const lid of affected) {
      const rows = await tx
        .select({ id: lessonItems.id })
        .from(lessonItems)
        .where(eq(lessonItems.lessonId, lid))
        .orderBy(asc(lessonItems.position), asc(lessonItems.id));
      const ids = rows.map((r) => r.id).filter((x) => x !== id);
      if (lid === toLessonId) {
        ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, id);
      }
      for (let i = 0; i < ids.length; i++) {
        await tx.update(lessonItems).set({ position: i + 1 }).where(eq(lessonItems.id, ids[i]));
      }
    }
  });
}

export async function deleteLessonItem(id: number, teacherId: number) {
  const db = await getDb();
  await ownedLessonItem(id, teacherId);
  await db.delete(lessonItems).where(eq(lessonItems.id, id));
}

export async function deleteCrossItem(id: number, teacherId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ ci: crossItems, group: groups })
    .from(crossItems)
    .innerJoin(sequences, eq(sequences.id, crossItems.sequenceId))
    .innerJoin(groups, eq(groups.id, sequences.groupId))
    .where(eq(crossItems.id, id))
    .limit(1);
  if (!row || row.group.teacherId !== teacherId) throw new HttpError(404, "הפריט לא נמצא");
  await db.delete(crossItems).where(eq(crossItems.id, id));
}
