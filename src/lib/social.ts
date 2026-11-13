import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { addCrossFromItem, addExistingItem, ownedLesson } from "./board";
import { HttpError } from "./session";

const { teachers, groups, sequences, topics, lessons, lessonItems, crossItems, items, teacherFollows } = tables;

// רצף משותף = המורה בחרה לשתף אותו עם מורים אחרים. ברירת המחדל פרטי.
const SHARED = "followable";

/* ---------- שיתוף רצף ---------- */

export async function setGroupSharing(groupId: number, teacherId: number, shared: boolean) {
  const db = await getDb();
  const [group] = await db.select().from(groups).where(and(eq(groups.id, groupId), eq(groups.teacherId, teacherId))).limit(1);
  if (!group) throw new HttpError(404, "הקבוצה לא נמצאה");
  await db
    .update(sequences)
    .set({ visibility: shared ? SHARED : "private" })
    .where(eq(sequences.groupId, groupId));
}

/* ---------- מורים ופרופיל ---------- */

type Scope = { subjects: string[]; classes: string[] };

async function sharedGroupsOf(teacherIds: number[]) {
  if (!teacherIds.length) return [];
  const db = await getDb();
  return db
    .select({ id: groups.id, teacherId: groups.teacherId, name: groups.name, className: groups.className, subjectName: groups.subjectName, sequenceId: sequences.id })
    .from(groups)
    .innerJoin(sequences, eq(sequences.groupId, groups.id))
    .where(and(inArray(groups.teacherId, teacherIds), eq(sequences.visibility, SHARED)))
    .orderBy(asc(groups.name));
}

// מורים שאפשר לעקוב אחריהם: מי ששיתפה לפחות רצף אחד. מי שלא שיתפה דבר לא מופיעה בחיפוש.
export async function listTeachers(viewerId: number, q: string) {
  const db = await getDb();
  const mine = await db.select().from(teacherFollows).where(eq(teacherFollows.followerId, viewerId));
  const followedIds = mine.map((f) => f.followedId);

  const sharing = await db
    .selectDistinct({ id: teachers.id })
    .from(teachers)
    .innerJoin(groups, eq(groups.teacherId, teachers.id))
    .innerJoin(sequences, eq(sequences.groupId, groups.id))
    .where(and(eq(sequences.visibility, SHARED), eq(teachers.blocked, false), ne(teachers.id, viewerId)));
  const ids = [...new Set([...sharing.map((r) => r.id), ...followedIds])];
  if (!ids.length) return [];

  const rows = await db.select({ id: teachers.id, displayName: teachers.displayName }).from(teachers).where(inArray(teachers.id, ids)).orderBy(asc(teachers.displayName));
  const shared = await sharedGroupsOf(ids);
  const followers = await db.select({ id: teacherFollows.followedId, n: count() }).from(teacherFollows).where(inArray(teacherFollows.followedId, ids)).groupBy(teacherFollows.followedId);
  const followerCount = new Map(followers.map((r) => [r.id, r.n]));
  const needle = q.trim();
  return rows
    .map((t) => {
      const follow = mine.find((f) => f.followedId === t.id);
      return {
        id: t.id,
        displayName: t.displayName,
        groups: shared.filter((g) => g.teacherId === t.id).map((g) => ({ id: g.id, name: g.name, className: g.className, subjectName: g.subjectName })),
        followers: followerCount.get(t.id) ?? 0,
        following: follow ? { subjects: follow.subjects, classes: follow.classes } : null,
      };
    })
    .filter((t) => !needle || t.displayName.includes(needle) || t.groups.some((g) => (g.subjectName ?? "").includes(needle) || g.name.includes(needle)));
}

export async function follow(viewerId: number, followedId: number, scope: Scope) {
  const db = await getDb();
  if (viewerId === followedId) throw new HttpError(400, "אי אפשר לעקוב אחרי עצמך");
  const [target] = await db.select({ id: teachers.id, blocked: teachers.blocked }).from(teachers).where(eq(teachers.id, followedId)).limit(1);
  if (!target || target.blocked) throw new HttpError(404, "המורה לא נמצאה");
  const clean = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter(Boolean))].slice(0, 20);
  const values = { subjects: clean(scope.subjects), classes: clean(scope.classes) };
  await db
    .insert(teacherFollows)
    .values({ followerId: viewerId, followedId, ...values })
    .onConflictDoUpdate({ target: [teacherFollows.followerId, teacherFollows.followedId], set: values });
}

export async function unfollow(viewerId: number, followedId: number) {
  const db = await getDb();
  await db.delete(teacherFollows).where(and(eq(teacherFollows.followerId, viewerId), eq(teacherFollows.followedId, followedId)));
}

// הרצף המשותף של מורה אחרת, לקריאה בלבד. בלי תלמידים, בלי הגשות, ובלי הערות פרטיות (רק הערה שסומנה לשיתוף).
export async function sharedSequenceView(groupId: number, viewerId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ group: groups, sequence: sequences, teacher: teachers.displayName })
    .from(groups)
    .innerJoin(sequences, eq(sequences.groupId, groups.id))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!row || (row.sequence.visibility !== SHARED && row.group.teacherId !== viewerId)) throw new HttpError(404, "הרצף לא נמצא או שאינו משותף");

  const topicRows = await db.select().from(topics).where(eq(topics.sequenceId, row.sequence.id)).orderBy(asc(topics.position));
  const lessonRows = await db.select().from(lessons).where(eq(lessons.sequenceId, row.sequence.id)).orderBy(asc(lessons.position), asc(lessons.id));
  const lessonIds = lessonRows.map((l) => l.id);
  const itemRows = lessonIds.length
    ? await db
        .select({ li: lessonItems, item: items })
        .from(lessonItems)
        .innerJoin(items, eq(items.id, lessonItems.itemId))
        .where(inArray(lessonItems.lessonId, lessonIds))
        .orderBy(asc(lessonItems.position))
    : [];
  return {
    group: { id: row.group.id, name: row.group.name, className: row.group.className, subjectName: row.group.subjectName },
    teacher: { id: row.group.teacherId, displayName: row.teacher },
    topics: topicRows.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    lessons: lessonRows.map((l) => ({
      id: l.id,
      title: l.title,
      topicId: l.topicId,
      goals: l.goals,
      items: itemRows
        .filter((r) => r.li.lessonId === l.id)
        .map((r) => ({
          id: r.item.id,
          title: r.item.title,
          url: r.item.url,
          imageUrl: r.item.imageUrl,
          kind: r.item.kind,
          contentType: r.item.contentType,
          phase: r.li.phase,
          duration: r.li.duration,
          note: r.li.shareNote ? r.li.note : "",
        })),
    })),
  };
}

/* ---------- המלצות במאגר ממורים שעוקבים אחריהם ---------- */

const STOP = new Set(["מבנה", "מערכת", "מערכות", "שיעור", "מבוא", "נושא", "יחידה", "חלק", "סיכום", "חזרה", "תרגול", "פתיחה", "כלי", "כלים", "של", "על", "עם", "או", "את", "אל", "מה", "איך", "למה"]);
function words(text: string): string[] {
  return [...new Set(text.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w)))];
}

// פריטים מהרצפים המשותפים של מורים שהמורה עוקבת אחריהם, כשההיקף של המעקב מתאים לקבוצה שנבנית עכשיו.
// כולל פריטים שאינם במאגר הרשמי (תמונות שהועלו, קישורים חיצוניים). מדורג לפי קרבה לשם השיעור ולנושא, ואז לפי חדש.
export async function peerCards(groupId: number, viewerId: number, q: string, topic: string) {
  const db = await getDb();
  const [mineGroup] = await db.select().from(groups).where(and(eq(groups.id, groupId), eq(groups.teacherId, viewerId))).limit(1);
  if (!mineGroup) throw new HttpError(404, "הקבוצה לא נמצאה");

  const follows = await db.select().from(teacherFollows).where(eq(teacherFollows.followerId, viewerId));
  const relevant = follows.filter(
    (f) =>
      (f.subjects.length === 0 || (mineGroup.subjectName != null && f.subjects.includes(mineGroup.subjectName))) &&
      (f.classes.length === 0 || (mineGroup.className != null && f.classes.includes(mineGroup.className))),
  );
  if (!relevant.length) return { cards: [], total: 0 };

  const shared = await sharedGroupsOf(relevant.map((f) => f.followedId));
  const seqIds = shared.map((g) => g.sequenceId);
  if (!seqIds.length) return { cards: [], total: 0 };
  const teacherRows = await db.select({ id: teachers.id, displayName: teachers.displayName, blocked: teachers.blocked }).from(teachers).where(inArray(teachers.id, relevant.map((f) => f.followedId)));
  const teacherName = new Map(teacherRows.filter((t) => !t.blocked).map((t) => [t.id, t.displayName]));

  const inLessons = await db
    .select({ item: items, lessonTitle: lessons.title, topicName: topics.name, sequenceId: lessons.sequenceId, at: lessonItems.createdAt })
    .from(lessonItems)
    .innerJoin(items, eq(items.id, lessonItems.itemId))
    .innerJoin(lessons, eq(lessons.id, lessonItems.lessonId))
    .leftJoin(topics, eq(topics.id, lessons.topicId))
    .where(inArray(lessons.sequenceId, seqIds))
    .orderBy(desc(lessonItems.createdAt))
    .limit(600);
  const inCross = await db
    .select({ item: items, sequenceId: crossItems.sequenceId, at: crossItems.createdAt })
    .from(crossItems)
    .innerJoin(items, eq(items.id, crossItems.itemId))
    .where(inArray(crossItems.sequenceId, seqIds))
    .orderBy(desc(crossItems.createdAt))
    .limit(200);

  // מה שכבר ברצף שלי לא מוצע שוב.
  const [mySeq] = await db.select({ id: sequences.id }).from(sequences).where(eq(sequences.groupId, groupId)).limit(1);
  const myUrls = new Set<string>();
  if (mySeq) {
    const a = await db.select({ url: items.url }).from(lessonItems).innerJoin(items, eq(items.id, lessonItems.itemId)).innerJoin(lessons, eq(lessons.id, lessonItems.lessonId)).where(eq(lessons.sequenceId, mySeq.id));
    const b = await db.select({ url: items.url }).from(crossItems).innerJoin(items, eq(items.id, crossItems.itemId)).where(eq(crossItems.sequenceId, mySeq.id));
    for (const r of [...a, ...b]) myUrls.add(r.url);
  }

  const lessonWords = words(q);
  const topicWords = words(topic);
  const hit = (text: string, list: string[], weight: number) => list.reduce((sum, w) => sum + (text.includes(w) ? weight : 0), 0);

  const seen = new Set<string>();
  const cards = [...inLessons.map((r) => ({ ...r, context: `${r.lessonTitle} ${r.topicName ?? ""}` })), ...inCross.map((r) => ({ ...r, lessonTitle: "", context: "" }))]
    .filter((r) => {
      if (!teacherName.has(r.item.teacherId) || myUrls.has(r.item.url) || seen.has(r.item.url)) return false;
      seen.add(r.item.url);
      return true;
    })
    .map((r) => ({
      id: r.item.id,
      url: r.item.url,
      title: r.item.title,
      imageUrl: r.item.imageUrl,
      kind: r.item.kind,
      contentType: r.item.contentType,
      teacher: teacherName.get(r.item.teacherId) ?? "",
      lessonTitle: r.lessonTitle,
      // כותרת הפריט שוקלת יותר מההקשר (שם השיעור והנושא אצל המורה השנייה).
      score: hit(r.item.title, lessonWords, 3) + hit(r.item.title, topicWords, 2) + hit(r.context, lessonWords, 2) + hit(r.context, topicWords, 1),
      at: r.at.getTime(),
    }))
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, 40);
  return { cards, total: cards.length };
}

// העתקת פריט של מורה אחרת אל הרצף שלי: נוצר פריט חדש בבעלותי, כך ששינוי או מחיקה אצלה לא ישפיעו עליי.
export async function copyPeerItem(viewerId: number, sourceItemId: number, target: { lessonId?: number; index?: number; groupId?: number; topicId?: number | null }) {
  const db = await getDb();
  const [source] = await db.select().from(items).where(eq(items.id, sourceItemId)).limit(1);
  if (!source) throw new HttpError(404, "הפריט לא נמצא");
  if (source.teacherId !== viewerId) {
    // מותר להעתיק רק פריט שנמצא ברצף משותף.
    const a = await db
      .select({ id: lessonItems.id })
      .from(lessonItems)
      .innerJoin(lessons, eq(lessons.id, lessonItems.lessonId))
      .innerJoin(sequences, eq(sequences.id, lessons.sequenceId))
      .where(and(eq(lessonItems.itemId, sourceItemId), eq(sequences.visibility, SHARED)))
      .limit(1);
    const b = a.length
      ? a
      : await db
          .select({ id: crossItems.id })
          .from(crossItems)
          .innerJoin(sequences, eq(sequences.id, crossItems.sequenceId))
          .where(and(eq(crossItems.itemId, sourceItemId), eq(sequences.visibility, SHARED)))
          .limit(1);
    if (!b.length) throw new HttpError(404, "הפריט לא נמצא");
  }
  if (target.lessonId) await ownedLesson(target.lessonId, viewerId);

  const [copy] = await db
    .insert(items)
    .values({
      teacherId: viewerId,
      url: source.url,
      title: source.title,
      imageUrl: source.imageUrl,
      siteName: source.siteName,
      kind: source.kind,
      contentType: source.contentType,
      openstuffPostId: source.openstuffPostId,
      meta: source.meta,
    })
    .returning();
  if (target.lessonId) await addExistingItem(target.lessonId, viewerId, copy.id, target.index);
  else if (target.groupId) await addCrossFromItem(target.groupId, viewerId, copy.id, target.topicId);
  else throw new HttpError(400, "חסר יעד להעתקה");
  return { itemId: copy.id };
}
