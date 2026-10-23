import { and, asc, desc, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { HttpError } from "./session";
import { unfurl } from "./unfurl";

const { groups, sequences, topics, lessons, items, lessonItems, crossItems } = tables;

// צבעי הנושאים בסרגל: נבחרים לפי סדר היצירה ומסתובבים.
const TOPIC_COLORS = ["#6685f0", "#fb8255", "#34b3a0", "#9b7ede", "#e5a825", "#fb6965", "#4aa66a", "#d9649a"];

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

export function cleanTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>();
  for (const raw of tags ?? []) {
    const t = raw.trim().slice(0, 30);
    if (t) seen.add(t);
  }
  return [...seen].slice(0, 12);
}

export async function updateGroup(
  groupId: number,
  teacherId: number,
  patch: { name?: string; className?: string | null; subjectName?: string | null; tags?: string[] },
) {
  const db = await getDb();
  await ownedGroup(groupId, teacherId);
  const set: Partial<typeof groups.$inferInsert> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new HttpError(400, "חסר שם קבוצה");
    set.name = name;
  }
  if (patch.className !== undefined) set.className = patch.className?.trim() || null;
  if (patch.subjectName !== undefined) set.subjectName = patch.subjectName?.trim() || null;
  if (patch.tags !== undefined) set.tags = cleanTags(patch.tags);
  if (Object.keys(set).length === 0) return;
  await db.update(groups).set(set).where(eq(groups.id, groupId));
}

export async function createGroup(
  teacherId: number,
  input: { name: string; className?: string; subjectName?: string; tags?: string[] },
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
      tags: cleanTags(input.tags),
      schoolYear: currentSchoolYear(),
      joinCode,
    })
    .returning();

  const [sequence] = await db.insert(sequences).values({ groupId: group.id, title: name }).returning();
  const [topic] = await db
    .insert(topics)
    .values({ sequenceId: sequence.id, position: 1, name: "נושא 1", color: TOPIC_COLORS[0] })
    .returning();
  await db.insert(lessons).values({ sequenceId: sequence.id, topicId: topic.id, position: 1, title: "שיעור 1" });
  await db.update(sequences).set({ currentTopicId: topic.id }).where(eq(sequences.id, sequence.id));
  return group;
}

// רצפים שנוצרו לפני שהיו נושאים: מוודא שיש לפחות נושא אחד, ששיעורים בלי נושא משויכים אליו,
// ושהנושא הנוכחי תקין.
async function ensureTopics(sequenceId: number) {
  const db = await getDb();
  let rows = await db.select().from(topics).where(eq(topics.sequenceId, sequenceId)).orderBy(asc(topics.position));
  if (rows.length === 0) {
    const [created] = await db
      .insert(topics)
      .values({ sequenceId, position: 1, name: "נושא 1", color: TOPIC_COLORS[0] })
      .returning();
    rows = [created];
  }
  await db
    .update(lessons)
    .set({ topicId: rows[0].id })
    .where(and(eq(lessons.sequenceId, sequenceId), isNull(lessons.topicId)));
  const [seq] = await db.select().from(sequences).where(eq(sequences.id, sequenceId)).limit(1);
  if (!seq.currentTopicId || !rows.some((t) => t.id === seq.currentTopicId)) {
    await db.update(sequences).set({ currentTopicId: rows[0].id }).where(eq(sequences.id, sequenceId));
  }
  return rows;
}

async function sequenceOf(groupId: number) {
  const db = await getDb();
  const [sequence] = await db.select().from(sequences).where(eq(sequences.groupId, groupId)).limit(1);
  return sequence;
}

async function topicInSequence(topicId: number, sequenceId: number) {
  const db = await getDb();
  const [topic] = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
  if (!topic || topic.sequenceId !== sequenceId) throw new HttpError(404, "הנושא לא נמצא");
  return topic;
}

async function ownedTopic(topicId: number, teacherId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ topic: topics, group: groups })
    .from(topics)
    .innerJoin(sequences, eq(sequences.id, topics.sequenceId))
    .innerJoin(groups, eq(groups.id, sequences.groupId))
    .where(eq(topics.id, topicId))
    .limit(1);
  if (!row || row.group.teacherId !== teacherId) throw new HttpError(404, "הנושא לא נמצא");
  return row;
}

export async function createTopic(groupId: number, teacherId: number, name?: string) {
  const db = await getDb();
  const group = await ownedGroup(groupId, teacherId);
  const sequence = await sequenceOf(group.id);
  const existing = await db.select({ id: topics.id }).from(topics).where(eq(topics.sequenceId, sequence.id));
  const [{ top }] = await db.select({ top: max(topics.position) }).from(topics).where(eq(topics.sequenceId, sequence.id));
  const next = (top ?? 0) + 1;
  const [topic] = await db
    .insert(topics)
    .values({
      sequenceId: sequence.id,
      position: next,
      name: name?.trim() || `נושא ${next}`,
      color: TOPIC_COLORS[existing.length % TOPIC_COLORS.length],
    })
    .returning();
  // נושא חדש נפתח מיד, עם שיעור ראשון, כדי שיהיה במה להתחיל.
  await db.insert(lessons).values({ sequenceId: sequence.id, topicId: topic.id, position: 1, title: "שיעור 1" });
  await db.update(sequences).set({ currentTopicId: topic.id }).where(eq(sequences.id, sequence.id));
  return topic;
}

// שם ומקום של נושא. index = המקום החדש ברשימת הנושאים (0 = ראשון).
export async function updateTopic(topicId: number, teacherId: number, patch: { name?: string; index?: number }) {
  const db = await getDb();
  const { topic } = await ownedTopic(topicId, teacherId);

  if (patch.name !== undefined) {
    const clean = patch.name.trim();
    if (!clean) throw new HttpError(400, "חסר שם נושא");
    await db.update(topics).set({ name: clean }).where(eq(topics.id, topicId));
  }

  if (patch.index !== undefined) {
    const siblings = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.sequenceId, topic.sequenceId), ne(topics.id, topicId)))
      .orderBy(asc(topics.position), asc(topics.id));
    const ordered = siblings.map((s) => s.id);
    ordered.splice(Math.max(0, Math.min(patch.index, ordered.length)), 0, topicId);
    await db.transaction(async (tx) => {
      for (let i = 0; i < ordered.length; i++) {
        await tx.update(topics).set({ position: i + 1 }).where(eq(topics.id, ordered[i]));
      }
    });
  }
}

// מחיקת נושא. נושא ריק נמחק מיד. נושא עם שיעורים דורש החלטה מפורשת:
// moveTo = העברת השיעורים (והפריטים הרוחביים) לנושא אחר, deleteLessons = מחיקת השיעורים עם הנושא.
// הפריטים עצמם נשארים במחסן של המורה ("שלי") ואפשר לתלות אותם שוב.
export async function deleteTopic(
  topicId: number,
  teacherId: number,
  opts: { moveTo?: number; deleteLessons?: boolean } = {},
) {
  const db = await getDb();
  const { topic } = await ownedTopic(topicId, teacherId);
  const siblings = await db.select().from(topics).where(eq(topics.sequenceId, topic.sequenceId)).orderBy(asc(topics.position));
  if (siblings.length <= 1) throw new HttpError(400, "אי אפשר למחוק את הנושא היחיד");

  const inside = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.topicId, topicId));
  if (inside.length > 0 && opts.moveTo === undefined && !opts.deleteLessons) {
    throw new HttpError(400, "בנושא יש שיעורים: יש לבחור להעביר אותם לנושא אחר או למחוק אותם");
  }
  if (opts.moveTo !== undefined) {
    if (opts.moveTo === topicId) throw new HttpError(400, "אי אפשר להעביר לאותו נושא");
    await topicInSequence(opts.moveTo, topic.sequenceId);
  }

  const fallback = opts.moveTo ?? siblings.find((t) => t.id !== topicId)!.id;
  await db.transaction(async (tx) => {
    if (opts.moveTo !== undefined) {
      await tx.update(lessons).set({ topicId: opts.moveTo }).where(eq(lessons.topicId, topicId));
      await tx.update(crossItems).set({ topicId: opts.moveTo }).where(eq(crossItems.topicId, topicId));
    } else if (inside.length > 0) {
      // lesson_items נמחקים יחד עם השיעור (cascade). פריטים רוחביים של הנושא הופכים לכלליים.
      await tx.delete(lessons).where(eq(lessons.topicId, topicId));
    }
    await tx
      .update(sequences)
      .set({ currentTopicId: fallback })
      .where(and(eq(sequences.id, topic.sequenceId), eq(sequences.currentTopicId, topicId)));
    await tx.delete(topics).where(eq(topics.id, topicId));
  });
}

export async function setCurrentTopic(groupId: number, teacherId: number, topicId: number) {
  const db = await getDb();
  const group = await ownedGroup(groupId, teacherId);
  const sequence = await sequenceOf(group.id);
  await topicInSequence(topicId, sequence.id);
  await db.update(sequences).set({ currentTopicId: topicId }).where(eq(sequences.id, sequence.id));
}

async function ownedGroup(groupId: number, teacherId: number) {
  const db = await getDb();
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group || group.teacherId !== teacherId) throw new HttpError(404, "הקבוצה לא נמצאה");
  return group;
}

export async function ownedLesson(lessonId: number, teacherId: number) {
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
  const first = await sequenceOf(group.id);
  const topicRows = await ensureTopics(first.id);
  const sequence = await sequenceOf(group.id);
  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.sequenceId, sequence.id))
    .orderBy(asc(lessons.position), asc(lessons.id));

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
    topics: topicRows,
    lessons: lessonRows.map((l) => ({
      ...l,
      items: itemRows.filter((r) => r.li.lessonId === l.id).map((r) => ({ ...r.li, item: r.item })),
    })),
    crossItems: cross.map((r) => ({ ...r.ci, item: r.item })),
  };
}

export async function addLesson(groupId: number, teacherId: number, input: { title?: string; topicId?: number }) {
  const db = await getDb();
  const group = await ownedGroup(groupId, teacherId);
  const sequence = await sequenceOf(group.id);
  const topicId = input.topicId ?? sequence.currentTopicId;
  if (!topicId) throw new HttpError(400, "אין נושא פתוח");
  await topicInSequence(topicId, sequence.id);
  const [{ top }] = await db
    .select({ top: max(lessons.position) })
    .from(lessons)
    .where(eq(lessons.sequenceId, sequence.id));
  const inTopic = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.topicId, topicId));
  const [lesson] = await db
    .insert(lessons)
    .values({
      sequenceId: sequence.id,
      topicId,
      position: (top ?? 0) + 1,
      title: input.title?.trim() || `שיעור ${inTopic.length + 1}`,
    })
    .returning();
  return lesson;
}

// שם, נושא ומקום של שיעור. הגרירה משנה את הסדר בתוך הנושא בלבד, ומשתמשת מחדש במיקומים הקיימים
// של אותם שיעורים, כדי שלא להזיז שיעורים של נושאים אחרים.
export async function updateLesson(
  lessonId: number,
  teacherId: number,
  patch: { title?: string; topicId?: number; index?: number },
) {
  const db = await getDb();
  const { lesson } = await ownedLesson(lessonId, teacherId);

  if (patch.title !== undefined) {
    const clean = patch.title.trim();
    if (!clean) throw new HttpError(400, "חסרה כותרת");
    await db.update(lessons).set({ title: clean }).where(eq(lessons.id, lessonId));
  }

  if (patch.topicId !== undefined || patch.index !== undefined) {
    const targetTopicId = patch.topicId ?? lesson.topicId;
    if (!targetTopicId) throw new HttpError(400, "חסר נושא");
    await topicInSequence(targetTopicId, lesson.sequenceId);

    const siblings = await db
      .select({ id: lessons.id, position: lessons.position })
      .from(lessons)
      .where(and(eq(lessons.topicId, targetTopicId), ne(lessons.id, lessonId)))
      .orderBy(asc(lessons.position), asc(lessons.id));
    const pool = [...siblings.map((s) => s.position), lesson.position].sort((a, b) => a - b);
    const ordered = siblings.map((s) => s.id);
    const at = patch.index === undefined ? ordered.length : Math.max(0, Math.min(patch.index, ordered.length));
    ordered.splice(at, 0, lessonId);

    await db.transaction(async (tx) => {
      await tx.update(lessons).set({ topicId: targetTopicId }).where(eq(lessons.id, lessonId));
      for (let i = 0; i < ordered.length; i++) {
        await tx.update(lessons).set({ position: pool[i] }).where(eq(lessons.id, ordered[i]));
      }
    });
  }
}

const MAX_LINKS_PER_PASTE = 30;

async function unfurlMany(urls: string[]) {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(0, MAX_LINKS_PER_PASTE);
  const results: Array<NonNullable<Awaited<ReturnType<typeof unfurl>>>> = [];
  // במקביל, בקבוצות קטנות, כדי לא להציף אתרים חיצוניים.
  for (let i = 0; i < unique.length; i += 8) {
    const batch = await Promise.all(unique.slice(i, i + 8).map((u) => unfurl(u)));
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
        contentType: u.contentType,
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

// תיקון סוג התוכן של פריט (למשל כשהניחוש לקישור חיצוני שגוי). חל על הפריט בכל השיעורים.
export async function updateItem(id: number, teacherId: number, patch: { contentType?: string }) {
  const db = await getDb();
  const [item] = await db.select({ id: items.id, teacherId: items.teacherId }).from(items).where(eq(items.id, id)).limit(1);
  if (!item || item.teacherId !== teacherId) throw new HttpError(404, "הפריט לא נמצא");
  if (patch.contentType !== undefined) {
    await db.update(items).set({ contentType: patch.contentType }).where(eq(items.id, id));
  }
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

// topicId: מספר = משויך לנושא; null = חל על כל הנושאים; undefined = הנושא הפתוח כעת.
async function resolveCrossTopic(sequence: { id: number; currentTopicId: number | null }, topicId: number | null | undefined) {
  if (topicId === null) return null;
  const id = topicId ?? sequence.currentTopicId;
  if (!id) return null;
  await topicInSequence(id, sequence.id);
  return id;
}

export async function addCrossLinks(groupId: number, teacherId: number, urls: string[], topicId?: number | null) {
  const db = await getDb();
  const group = await ownedGroup(groupId, teacherId);
  const sequence = await sequenceOf(group.id);
  const topic = await resolveCrossTopic(sequence, topicId);
  const unfurled = await unfurlMany(urls);
  if (unfurled.length === 0) throw new HttpError(400, "לא נמצאו קישורים תקינים");
  const created = await insertItems(teacherId, unfurled);
  return db
    .insert(crossItems)
    .values(created.map((it) => ({ sequenceId: sequence.id, itemId: it.id, topicId: topic })))
    .returning();
}

export async function addCrossFromItem(groupId: number, teacherId: number, itemId: number, topicId?: number | null) {
  const db = await getDb();
  const group = await ownedGroup(groupId, teacherId);
  const sequence = await sequenceOf(group.id);
  const [item] = await db.select({ id: items.id, teacherId: items.teacherId }).from(items).where(eq(items.id, itemId)).limit(1);
  if (!item || item.teacherId !== teacherId) throw new HttpError(404, "הפריט לא נמצא");
  const topic = await resolveCrossTopic(sequence, topicId);
  const [row] = await db.insert(crossItems).values({ sequenceId: sequence.id, itemId, topicId: topic }).returning();
  return row;
}

// גרירת קישור כללי אל שיעור מסוים: מעביר (לא משכפל), ושומר את ההערה שלו.
export async function crossItemToLesson(crossId: number, teacherId: number, lessonId: number, index?: number) {
  const db = await getDb();
  const [row] = await db
    .select({ ci: crossItems, group: groups })
    .from(crossItems)
    .innerJoin(sequences, eq(sequences.id, crossItems.sequenceId))
    .innerJoin(groups, eq(groups.id, sequences.groupId))
    .where(eq(crossItems.id, crossId))
    .limit(1);
  if (!row || row.group.teacherId !== teacherId) throw new HttpError(404, "הקישור לא נמצא");
  const { lesson } = await ownedLesson(lessonId, teacherId);
  if (lesson.sequenceId !== row.ci.sequenceId) throw new HttpError(400, "אי אפשר להעביר בין קבוצות");

  const [created] = await attachItems(lessonId, [row.ci.itemId], index);
  if (row.ci.note) await db.update(lessonItems).set({ note: row.ci.note }).where(eq(lessonItems.id, created.id));
  await db.delete(crossItems).where(eq(crossItems.id, crossId));
  return created;
}

// גרירת פריט משיעור אל הקישורים הכלליים: מעביר (לא משכפל) את הפריט.
export async function lessonItemToCross(lessonItemId: number, teacherId: number, topicId?: number | null) {
  const db = await getDb();
  const { li, group } = await ownedLessonItem(lessonItemId, teacherId);
  const sequence = await sequenceOf(group.id);
  const topic = await resolveCrossTopic(sequence, topicId);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(crossItems).values({ sequenceId: sequence.id, itemId: li.itemId, note: li.note, topicId: topic }).returning();
    await tx.delete(lessonItems).where(eq(lessonItems.id, lessonItemId));
    return row;
  });
}

export async function updateCross(
  id: number,
  teacherId: number,
  patch: { topicId?: number | null; note?: string; duration?: string | null },
) {
  const db = await getDb();
  const [row] = await db
    .select({ ci: crossItems, group: groups })
    .from(crossItems)
    .innerJoin(sequences, eq(sequences.id, crossItems.sequenceId))
    .innerJoin(groups, eq(groups.id, sequences.groupId))
    .where(eq(crossItems.id, id))
    .limit(1);
  if (!row || row.group.teacherId !== teacherId) throw new HttpError(404, "הפריט לא נמצא");
  const set: Partial<typeof crossItems.$inferInsert> = {};
  if (patch.topicId !== undefined) {
    if (patch.topicId !== null) await topicInSequence(patch.topicId, row.ci.sequenceId);
    set.topicId = patch.topicId;
  }
  if (patch.note !== undefined) set.note = patch.note.slice(0, 2000);
  if (patch.duration !== undefined) set.duration = patch.duration;
  if (Object.keys(set).length > 0) await db.update(crossItems).set(set).where(eq(crossItems.id, id));
}

export async function updateLessonItem(
  id: number,
  teacherId: number,
  patch: {
    note?: string;
    phase?: string | null;
    level?: string | null;
    isAssignment?: boolean;
    duration?: string | null;
    shareNote?: boolean;
  },
) {
  const db = await getDb();
  await ownedLessonItem(id, teacherId);
  const set: Partial<typeof lessonItems.$inferInsert> = {};
  if (patch.duration !== undefined) set.duration = patch.duration;
  if (patch.shareNote !== undefined) set.shareNote = patch.shareNote;
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
