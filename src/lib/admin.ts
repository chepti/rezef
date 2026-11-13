import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { HttpError } from "./session";

const { teachers, groups, lessons, lessonItems, items, students, memberships, submissions, allowedDomains, lessonBoards, files, appSettings } = tables;

/* ---------- הגדרות ---------- */

export const SETTING_DEFAULTS = {
  // כניסת תלמידים: כבויה אפשר לכבות בזמן תקלה או לפני שהמערכת מוכנה.
  students_enabled: "1",
  // הודעה שמוצגת לתלמידים בדף הכניסה (למשל "המערכת בתחזוקה עד 16:00").
  student_notice: "",
  // הודעה שמוצגת למורים בראש "הקבוצות שלי".
  teacher_notice: "",
  // מורים חדשים: 1 = כל מורה מחומר פתוח נכנסת, 0 = רק מורות שכבר נכנסו (רשימה סגורה).
  teachers_open: "1",
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;
const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const db = await getDb();
  const rows = await db.select().from(appSettings);
  const out = { ...SETTING_DEFAULTS } as Record<SettingKey, string>;
  for (const r of rows) if (SETTING_KEYS.includes(r.key as SettingKey)) out[r.key as SettingKey] = r.value;
  return out;
}

export async function setSettings(patch: Partial<Record<SettingKey, string>>) {
  const db = await getDb();
  for (const [key, value] of Object.entries(patch)) {
    if (!SETTING_KEYS.includes(key as SettingKey) || typeof value !== "string") continue;
    const clean = key === "student_notice" || key === "teacher_notice" ? value.trim().slice(0, 300) : value === "1" ? "1" : "0";
    await db
      .insert(appSettings)
      .values({ key, value: clean })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: clean, updatedAt: new Date() } });
  }
}

export async function studentsEnabled(): Promise<boolean> {
  return (await getSettings()).students_enabled === "1";
}

/* ---------- דומיינים מותרים לתלמידים ---------- */

const DOMAIN_RE = /^(?=.{4,100}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

export function normalizeDomain(raw: string): string | null {
  const d = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^.*@/, "")
    .replace(/\/.*$/, "");
  return DOMAIN_RE.test(d) ? d : null;
}

export async function listDomains() {
  const db = await getDb();
  const rows = await db.select().from(allowedDomains).orderBy(asc(allowedDomains.domain));
  const perDomain = await db.select({ domain: students.domain, n: count() }).from(students).groupBy(students.domain);
  const counts = new Map(perDomain.map((r) => [r.domain, r.n]));
  const known = new Set(rows.map((r) => r.domain));
  return {
    domains: rows.map((r) => ({ ...r, students: counts.get(r.domain) ?? 0 })),
    // תלמידים שנכנסו בעבר מדומיין שהוסר מהרשימה: נשארים בקבוצות אבל לא יוכלו להיכנס שוב.
    orphaned: perDomain.filter((r) => !known.has(r.domain)).map((r) => ({ domain: r.domain, students: r.n })),
  };
}

// מקבל כמה דומיינים בבת אחת (שורה, פסיק או רווח), ומחזיר מה נוסף ומה נדחה.
export async function addDomains(text: string, region?: string, note?: string) {
  const db = await getDb();
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const added: string[] = [];
  const rejected: string[] = [];
  for (const part of parts) {
    const d = normalizeDomain(part);
    if (!d) {
      rejected.push(part);
      continue;
    }
    const res = await db
      .insert(allowedDomains)
      .values({ domain: d, region: region?.trim() || null, note: note?.trim() || null })
      .onConflictDoNothing()
      .returning({ domain: allowedDomains.domain });
    if (res.length) added.push(d);
  }
  return { added, rejected, existing: parts.length - added.length - rejected.length };
}

export async function updateDomain(domain: string, patch: { region?: string | null; note?: string | null }) {
  const db = await getDb();
  await db
    .update(allowedDomains)
    .set({ ...(patch.region !== undefined ? { region: patch.region?.trim() || null } : {}), ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}) })
    .where(eq(allowedDomains.domain, domain));
}

export async function deleteDomain(domain: string) {
  const db = await getDb();
  await db.delete(allowedDomains).where(eq(allowedDomains.domain, domain));
}

/* ---------- סקירה ונתוני שימוש ---------- */

const DAY = 24 * 60 * 60 * 1000;

export async function overview() {
  const db = await getDb();
  const since7 = new Date(Date.now() - 7 * DAY);
  const since30 = new Date(Date.now() - 30 * DAY);
  const n = async (q: Promise<Array<{ n: number }>>) => (await q)[0]?.n ?? 0;

  const totals = {
    teachers: await n(db.select({ n: count() }).from(teachers)),
    groups: await n(db.select({ n: count() }).from(groups)),
    activeGroups: await n(db.select({ n: count() }).from(groups).where(sql`${groups.archivedAt} is null`)),
    lessons: await n(db.select({ n: count() }).from(lessons)),
    openLessons: await n(db.select({ n: count() }).from(lessons).where(sql`${lessons.openedAt} is not null`)),
    lessonItems: await n(db.select({ n: count() }).from(lessonItems)),
    items: await n(db.select({ n: count() }).from(items)),
    openstuffItems: await n(db.select({ n: count() }).from(items).where(eq(items.kind, "openstuff"))),
    imageItems: await n(db.select({ n: count() }).from(items).where(eq(items.kind, "image"))),
    publishedLessons: await n(db.select({ n: count() }).from(lessons).where(sql`${lessons.publishedCollectionId} is not null`)),
    publishedItems: await n(db.select({ n: count() }).from(items).where(sql`${items.publishedPostId} is not null`)),
    students: await n(db.select({ n: count() }).from(students)),
    memberships: await n(db.select({ n: count() }).from(memberships)),
    submissions: await n(db.select({ n: count() }).from(submissions)),
    helpRequests: await n(db.select({ n: count() }).from(submissions).where(eq(submissions.needsHelp, true))),
    boards: await n(db.select({ n: count() }).from(lessonBoards)),
  };

  const recent = {
    teachersNew7: await n(db.select({ n: count() }).from(teachers).where(gte(teachers.createdAt, since7))),
    teachersActive7: await n(db.select({ n: count() }).from(teachers).where(gte(teachers.lastLoginAt, since7))),
    teachersActive30: await n(db.select({ n: count() }).from(teachers).where(gte(teachers.lastLoginAt, since30))),
    groupsNew30: await n(db.select({ n: count() }).from(groups).where(gte(groups.createdAt, since30))),
    itemsNew7: await n(db.select({ n: count() }).from(items).where(gte(items.createdAt, since7))),
    itemsNew30: await n(db.select({ n: count() }).from(items).where(gte(items.createdAt, since30))),
    studentsNew7: await n(db.select({ n: count() }).from(students).where(gte(students.createdAt, since7))),
    submissions7: await n(db.select({ n: count() }).from(submissions).where(gte(submissions.updatedAt, since7))),
  };

  // פריטים והגשות לפי יום, 30 ימים אחרונים.
  const perDay = async (table: "items" | "submissions") => {
    const col = table === "items" ? items.createdAt : submissions.updatedAt;
    const tbl = table === "items" ? items : submissions;
    const rows = await db
      .select({ day: sql<string>`to_char(${col}, 'YYYY-MM-DD')`, n: count() })
      .from(tbl)
      .where(gte(col, since30))
      .groupBy(sql`to_char(${col}, 'YYYY-MM-DD')`);
    return new Map(rows.map((r) => [r.day, r.n]));
  };
  const itemDays = await perDay("items");
  const subDays = await perDay("submissions");
  const series: Array<{ day: string; items: number; submissions: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    series.push({ day, items: itemDays.get(day) ?? 0, submissions: subDays.get(day) ?? 0 });
  }

  // מה הכי נתלה ברצפים: תחומי הדעת, והאתרים שהמורים מדביקים.
  const subjects = await db
    .select({ name: groups.subjectName, n: count() })
    .from(groups)
    .where(sql`${groups.subjectName} is not null`)
    .groupBy(groups.subjectName)
    .orderBy(desc(count()))
    .limit(8);
  const types = await db
    .select({ name: sql<string>`coalesce(${items.contentType}, 'אחר')`, n: count() })
    .from(items)
    .groupBy(sql`coalesce(${items.contentType}, 'אחר')`)
    .orderBy(desc(count()));
  const sites = await db
    .select({ name: sql<string>`coalesce(${items.siteName}, 'ללא שם אתר')`, n: count() })
    .from(items)
    .where(sql`${items.kind} <> 'openstuff'`)
    .groupBy(sql`coalesce(${items.siteName}, 'ללא שם אתר')`)
    .orderBy(desc(count()))
    .limit(8);

  const [fileStats] = await db.select({ n: count(), bytes: sql<number>`coalesce(sum(${files.size}), 0)::bigint` }).from(files);
  return { totals, recent, series, subjects, types, sites, storage: { files: fileStats?.n ?? 0, bytes: Number(fileStats?.bytes ?? 0) } };
}

/* ---------- מורים וקבוצות ---------- */

export async function listTeachersAdmin() {
  const db = await getDb();
  const rows = await db.select().from(teachers).orderBy(desc(teachers.createdAt));
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];
  const groupRows = await db.select({ teacherId: groups.teacherId, n: count() }).from(groups).where(inArray(groups.teacherId, ids)).groupBy(groups.teacherId);
  const itemRows = await db.select({ teacherId: items.teacherId, n: count(), last: sql<string | null>`max(${items.createdAt})` }).from(items).where(inArray(items.teacherId, ids)).groupBy(items.teacherId);
  const lessonRows = await db
    .select({ teacherId: groups.teacherId, n: count(lessons.id) })
    .from(groups)
    .innerJoin(tables.sequences, eq(tables.sequences.groupId, groups.id))
    .innerJoin(lessons, eq(lessons.sequenceId, tables.sequences.id))
    .where(inArray(groups.teacherId, ids))
    .groupBy(groups.teacherId);
  const g = new Map(groupRows.map((r) => [r.teacherId, r.n]));
  const i = new Map(itemRows.map((r) => [r.teacherId, r]));
  const l = new Map(lessonRows.map((r) => [r.teacherId, r.n]));
  return rows.map((t) => ({
    id: t.id,
    displayName: t.displayName,
    wpUserId: t.wpUserId,
    isAdmin: t.isAdmin,
    blocked: t.blocked,
    createdAt: t.createdAt,
    lastLoginAt: t.lastLoginAt,
    groups: g.get(t.id) ?? 0,
    lessons: l.get(t.id) ?? 0,
    items: i.get(t.id)?.n ?? 0,
    lastItemAt: i.get(t.id)?.last ?? null,
  }));
}

export async function setTeacherBlocked(teacherId: number, blocked: boolean, actingAdminId: number) {
  const db = await getDb();
  if (teacherId === actingAdminId) throw new HttpError(400, "אי אפשר להשעות את עצמך");
  const [t] = await db.select().from(teachers).where(eq(teachers.id, teacherId)).limit(1);
  if (!t) throw new HttpError(404, "המורה לא נמצאה");
  if (t.isAdmin) throw new HttpError(400, "אי אפשר להשעות מנהלת");
  await db.update(teachers).set({ blocked }).where(eq(teachers.id, teacherId));
}

export async function listGroupsAdmin() {
  const db = await getDb();
  const rows = await db
    .select({ g: groups, teacher: teachers.displayName })
    .from(groups)
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .orderBy(desc(groups.createdAt));
  const ids = rows.map((r) => r.g.id);
  if (!ids.length) return [];
  const members = await db.select({ groupId: memberships.groupId, n: count() }).from(memberships).where(inArray(memberships.groupId, ids)).groupBy(memberships.groupId);
  const lessonRows = await db
    .select({ groupId: tables.sequences.groupId, n: count(lessons.id), opened: sql<number>`count(${lessons.openedAt})::int` })
    .from(tables.sequences)
    .innerJoin(lessons, eq(lessons.sequenceId, tables.sequences.id))
    .where(inArray(tables.sequences.groupId, ids))
    .groupBy(tables.sequences.groupId);
  const m = new Map(members.map((r) => [r.groupId, r.n]));
  const l = new Map(lessonRows.map((r) => [r.groupId, r]));
  return rows.map(({ g, teacher }) => ({
    id: g.id,
    name: g.name,
    teacher,
    className: g.className,
    subjectName: g.subjectName,
    schoolYear: g.schoolYear,
    joinCode: g.joinCode,
    archivedAt: g.archivedAt,
    createdAt: g.createdAt,
    students: m.get(g.id) ?? 0,
    lessons: l.get(g.id)?.n ?? 0,
    openLessons: l.get(g.id)?.opened ?? 0,
  }));
}

export async function setGroupArchived(groupId: number, archived: boolean) {
  const db = await getDb();
  await db
    .update(groups)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(groups.id, groupId)));
}
