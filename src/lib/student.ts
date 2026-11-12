import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT, createRemoteJWKSet } from "jose";
import { getDb, tables } from "@/db";
import { HttpError, errorResponse, requireTeacher } from "./session";
import { resolveEmbed } from "./embed";

const { students, memberships, submissions, groups, sequences, lessons, lessonItems, items, topics, lessonBoards, allowedDomains, teachers } = tables;

export const STUDENT_COOKIE = "rezef_student";
export const STUDENT_STATE_COOKIE = "rezef_student_state";
const STUDENT_DAYS = 30;
const WP = (process.env.WP_URL ?? "https://openstuff.co.il").replace(/\/$/, "");

function sessionKey(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET חסר או קצר מדי");
  return new TextEncoder().encode(value);
}

export type Student = typeof students.$inferSelect;

/* ---------- כניסה עם Google ארגוני ---------- */

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${origin}/api/student/auth/callback`,
    response_type: "code",
    // openid בלבד בתוספת email: לא מבקשים פרופיל (שם ותמונה), כי לא שומרים אותם.
    scope: "openid email",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

// מחליף את הקוד מ-Google בזהות מאומתת. מחזיר רק מזהה חשבון ודומיין: המייל עצמו לא נשמר.
export async function exchangeGoogleCode(origin: string, code: string): Promise<{ sub: string; domain: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/api/student/auth/callback`,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new HttpError(401, "הכניסה עם Google נכשלה");
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) throw new HttpError(401, "הכניסה עם Google נכשלה");

  const { payload } = await jwtVerify(idToken, googleKeys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!payload.sub || !email || payload.email_verified !== true) throw new HttpError(401, "חשבון Google לא מאומת");
  return { sub: String(payload.sub), domain: email.slice(email.lastIndexOf("@") + 1) };
}

export async function domainAllowed(domain: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select().from(allowedDomains).where(eq(allowedDomains.domain, domain.toLowerCase())).limit(1);
  return Boolean(row);
}

export async function upsertStudent(sub: string, domain: string): Promise<Student> {
  const db = await getDb();
  const [existing] = await db.select().from(students).where(eq(students.googleSub, sub)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(students).values({ googleSub: sub, domain }).returning();
  return created;
}

export async function createStudentToken(studentId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(studentId))
    .setAudience("rezef-student")
    .setIssuedAt()
    .setExpirationTime(`${STUDENT_DAYS}d`)
    .sign(sessionKey());
}

async function readStudentToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"], audience: "rezef-student" });
    const id = Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function currentStudent(): Promise<Student | null> {
  // cookies() קודם לכל גישה ל-DB, כמו בצד המורה.
  const jar = await cookies();
  const token = jar.get(STUDENT_COOKIE)?.value;
  if (!token) return null;
  const id = await readStudentToken(token);
  if (!id) return null;
  const db = await getDb();
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return student ?? null;
}

export async function requireStudent(): Promise<Student> {
  const student = await currentStudent();
  if (!student) throw new HttpError(401, "נדרשת כניסה עם חשבון Google של בית הספר");
  return student;
}

// המורה המחוברת, אם יש (כולל מורה הפיתוח המקומי). בשביל "תצוגת תלמיד" של קבוצה שלה.
async function currentTeacherId(): Promise<number | null> {
  try {
    return (await requireTeacher()).id;
  } catch (e) {
    if (e instanceof HttpError) return null;
    throw e;
  }
}

export async function withStudent(fn: (student: Student) => Promise<unknown>): Promise<Response> {
  try {
    const student = await requireStudent();
    return Response.json((await fn(student)) ?? { ok: true });
  } catch (e) {
    if (e && typeof e === "object" && (e as { digest?: string }).digest === "HANGING_PROMISE_REJECTION") throw e;
    return errorResponse(e);
  }
}

/* ---------- קבוצות והצטרפות ---------- */

function cleanNickname(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 24) throw new HttpError(400, "הכינוי צריך להיות באורך 2 עד 24 תווים");
  // כינוי ולא פרטים מזהים: בלי כתובות מייל ובלי מספרים ארוכים (טלפון, תעודת זהות).
  if (/@/.test(name) || /\d{5,}/.test(name)) throw new HttpError(400, "כינוי בלבד, בלי מייל ובלי מספרים ארוכים");
  return name;
}

export async function listStudentGroups(studentId: number) {
  const db = await getDb();
  return db
    .select({ id: groups.id, name: groups.name, subjectName: groups.subjectName, nickname: memberships.nickname, teacher: teachers.displayName })
    .from(memberships)
    .innerJoin(groups, eq(groups.id, memberships.groupId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .where(eq(memberships.studentId, studentId))
    .orderBy(desc(memberships.createdAt));
}

export async function joinGroup(studentId: number, code: string, nickname: string) {
  const db = await getDb();
  const joinCode = code.replace(/\s+/g, "").toUpperCase();
  const [group] = await db.select().from(groups).where(eq(groups.joinCode, joinCode)).limit(1);
  // אותה הודעה לקוד שגוי ולקבוצה בארכיון, כדי לא לחשוף אילו קודים קיימים.
  if (!group || group.archivedAt) throw new HttpError(404, "לא נמצאה קבוצה עם הקוד הזה");
  const name = cleanNickname(nickname);
  const [existing] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.studentId, studentId), eq(memberships.groupId, group.id)))
    .limit(1);
  if (existing) return { groupId: group.id };
  await db.insert(memberships).values({ studentId, groupId: group.id, nickname: name });
  return { groupId: group.id };
}

export async function renameSelf(studentId: number, groupId: number, nickname: string) {
  const db = await getDb();
  await db
    .update(memberships)
    .set({ nickname: cleanNickname(nickname) })
    .where(and(eq(memberships.studentId, studentId), eq(memberships.groupId, groupId)));
}

/* ---------- מה התלמיד רואה ---------- */

type Viewer = { kind: "student"; membershipId: number; nickname: string } | { kind: "teacher" };

// תלמיד רואה קבוצה רק אם הוא חבר בה; מורה רואה תצוגה מקדימה רק של קבוצה שלה.
async function viewerOf(groupId: number): Promise<{ viewer: Viewer; group: typeof groups.$inferSelect }> {
  const db = await getDb();
  const student = await currentStudent();
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) throw new HttpError(404, "הקבוצה לא נמצאה");

  if (student) {
    const [member] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.studentId, student.id), eq(memberships.groupId, groupId)))
      .limit(1);
    if (member) return { viewer: { kind: "student", membershipId: member.id, nickname: member.nickname }, group };
  }
  const asTeacher = await currentTeacherId();
  if (asTeacher && group.teacherId === asTeacher) return { viewer: { kind: "teacher" }, group };
  if (!student && !asTeacher) throw new HttpError(401, "נדרשת כניסה");
  throw new HttpError(404, "הקבוצה לא נמצאה");
}

// הקישור לפריט עצמו (ולא לעמוד הפוסט) לפריטים מחומר פתוח. נשמר בזיכרון, כי הוא כמעט לא משתנה.
const linkCache = new Map<number, { at: number; link: string | null }>();
async function directLink(postId: number): Promise<string | null> {
  const hit = linkCache.get(postId);
  if (hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.link;
  let link: string | null = null;
  try {
    const res = await fetch(`${WP}/wp-json/rezef/v1/preview/${postId}`, { signal: AbortSignal.timeout(6000) });
    if (res.ok) link = ((await res.json()) as { link?: string | null }).link ?? null;
  } catch {
    // בלי קישור ישיר התלמיד יגיע לעמוד הפוסט.
  }
  linkCache.set(postId, { at: Date.now(), link });
  return link;
}

// רק שיעורים שהמורה פתחה, ורק מה שמיועד לתלמידים: בלי הערות המורה ובלי פרטי פרסום.
export async function studentGroupView(groupId: number) {
  const db = await getDb();
  const { viewer, group } = await viewerOf(groupId);
  const [sequence] = await db.select().from(sequences).where(eq(sequences.groupId, group.id)).limit(1);
  if (!sequence) throw new HttpError(404, "הקבוצה לא נמצאה");

  const topicRows = await db.select().from(topics).where(eq(topics.sequenceId, sequence.id)).orderBy(asc(topics.position));
  const allLessons = await db.select().from(lessons).where(eq(lessons.sequenceId, sequence.id)).orderBy(asc(lessons.position), asc(lessons.id));
  // מספר השיעור בתוך הנושא נספר על כל השיעורים, גם אלה שעדיין סגורים, כדי שיתאים למה שהמורה רואה.
  const numberOf = new Map<number, number>();
  const perTopic = new Map<number | null, number>();
  for (const l of allLessons) {
    const n = (perTopic.get(l.topicId) ?? 0) + 1;
    perTopic.set(l.topicId, n);
    numberOf.set(l.id, n);
  }
  const open = allLessons.filter((l) => l.openedAt);
  const lessonIds = open.map((l) => l.id);

  const itemRows = lessonIds.length
    ? await db
        .select({ li: lessonItems, item: items })
        .from(lessonItems)
        .innerJoin(items, eq(items.id, lessonItems.itemId))
        .where(inArray(lessonItems.lessonId, lessonIds))
        .orderBy(asc(lessonItems.position))
    : [];
  const boards = lessonIds.length
    ? await db.select().from(lessonBoards).where(inArray(lessonBoards.lessonId, lessonIds)).orderBy(asc(lessonBoards.id))
    : [];
  const mine = viewer.kind === "student" ? await db.select().from(submissions).where(eq(submissions.membershipId, viewer.membershipId)) : [];
  const submissionOf = new Map(mine.map((r) => [r.lessonItemId, r]));

  const links = new Map<number, string | null>();
  await Promise.all(
    [...new Set(itemRows.map((r) => r.item.openstuffPostId).filter((id): id is number => id != null))].map(async (postId) => {
      links.set(postId, await directLink(postId));
    }),
  );

  return {
    viewer: viewer.kind === "student" ? { kind: "student" as const, nickname: viewer.nickname } : { kind: "teacher" as const },
    group: { id: group.id, name: group.name, subjectName: group.subjectName },
    topics: topicRows.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    // החדש ביותר ראשון: התלמיד רוצה קודם את השיעור של היום.
    lessons: [...open]
      .sort((a, b) => (b.openedAt?.getTime() ?? 0) - (a.openedAt?.getTime() ?? 0))
      .map((l) => ({
        id: l.id,
        number: numberOf.get(l.id) ?? 0,
        title: l.title,
        topicId: l.topicId,
        openedAt: l.openedAt,
        goals: l.goals,
        recap: l.recap,
        boards: boards.filter((b) => b.lessonId === l.id).map((b) => ({ id: b.id, image: b.image, caption: b.caption })),
        items: itemRows
          .filter((r) => r.li.lessonId === l.id)
          .map((r) => ({
            id: r.li.id,
            title: r.item.title,
            imageUrl: r.item.imageUrl,
            contentType: r.item.contentType,
            kind: r.item.kind,
            url: (r.item.openstuffPostId ? links.get(r.item.openstuffPostId) : null) ?? r.item.url,
            phase: r.li.phase,
            isAssignment: r.li.isAssignment,
            submission: submissionView(submissionOf.get(r.li.id)),
          })),
      })),
  };
}

type SubmissionRow = typeof submissions.$inferSelect;

function submissionView(row: SubmissionRow | undefined) {
  if (!row) return null;
  return { answer: row.answer, link: row.link, rating: row.rating, needsHelp: row.needsHelp, feedback: row.feedback, updatedAt: row.updatedAt };
}

// פריט בשיעור פתוח, בקבוצה שהתלמיד חבר בה. מחזיר גם את החברות שלו.
async function memberItem(studentId: number, lessonItemId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ membershipId: memberships.id, isAssignment: lessonItems.isAssignment, url: items.url, postId: items.openstuffPostId })
    .from(lessonItems)
    .innerJoin(items, eq(items.id, lessonItems.itemId))
    .innerJoin(lessons, eq(lessons.id, lessonItems.lessonId))
    .innerJoin(sequences, eq(sequences.id, lessons.sequenceId))
    .innerJoin(memberships, and(eq(memberships.groupId, sequences.groupId), eq(memberships.studentId, studentId)))
    .where(and(eq(lessonItems.id, lessonItemId), isNotNull(lessons.openedAt)))
    .limit(1);
  if (!row) throw new HttpError(404, "הפריט לא נמצא");
  return row;
}

export type SubmissionInput = { answer: string; link: string | null; rating: number | null; needsHelp: boolean };

// הגשה של מטלה: תשובה, קישור לעבודה, כמה היה קשה ובקשת עזרה. הגשה חוזרת מעדכנת את הקיימת.
export async function saveSubmission(studentId: number, lessonItemId: number, input: SubmissionInput) {
  const db = await getDb();
  const row = await memberItem(studentId, lessonItemId);
  if (!row.isAssignment) throw new HttpError(404, "המטלה לא נמצאה");
  const link = input.link?.trim() || null;
  if (link && !/^https?:\/\//i.test(link)) throw new HttpError(400, "הקישור צריך להתחיל ב-http");
  const values = { answer: input.answer.trim().slice(0, 4000), link, rating: input.rating, needsHelp: input.needsHelp, updatedAt: new Date() };
  await db
    .insert(submissions)
    .values({ membershipId: row.membershipId, lessonItemId, ...values })
    .onConflictDoUpdate({ target: [submissions.membershipId, submissions.lessonItemId], set: values });
}

export async function deleteSubmission(studentId: number, lessonItemId: number) {
  const db = await getDb();
  const row = await memberItem(studentId, lessonItemId);
  await db.delete(submissions).where(and(eq(submissions.membershipId, row.membershipId), eq(submissions.lessonItemId, lessonItemId)));
}

// האם אפשר להציג את הפריט בתוך הדף של התלמיד. רק לפריט שהתלמיד רשאי לראות.
export async function studentItemEmbed(studentId: number, lessonItemId: number) {
  const row = await memberItem(studentId, lessonItemId);
  const url = (row.postId ? await directLink(row.postId) : null) ?? row.url;
  return resolveEmbed(url);
}

/* ---------- צד המורה: פתיחת שיעור, רשימת תלמידים, לוחות ---------- */

async function ownedLessonRow(lessonId: number, teacherId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ lesson: lessons, groupId: groups.id })
    .from(lessons)
    .innerJoin(sequences, eq(sequences.id, lessons.sequenceId))
    .innerJoin(groups, eq(groups.id, sequences.groupId))
    .where(and(eq(lessons.id, lessonId), eq(groups.teacherId, teacherId)))
    .limit(1);
  if (!row) throw new HttpError(404, "השיעור לא נמצא");
  return row;
}

export async function setLessonOpen(lessonId: number, teacherId: number, isOpen: boolean) {
  const db = await getDb();
  const { lesson } = await ownedLessonRow(lessonId, teacherId);
  // פתיחה חוזרת של שיעור פתוח לא משנה את מועד הפתיחה (הוא קובע את הסדר אצל התלמידים).
  if (isOpen && lesson.openedAt) return;
  await db
    .update(lessons)
    .set({ openedAt: isOpen ? new Date() : null })
    .where(eq(lessons.id, lessonId));
}

const MAX_BOARDS = 12;
const MAX_BOARD_CHARS = 900_000;

export async function addLessonBoard(lessonId: number, teacherId: number, image: string, caption: string) {
  const db = await getDb();
  await ownedLessonRow(lessonId, teacherId);
  if (!/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_BOARD_CHARS) {
    throw new HttpError(400, "תמונת הלוח גדולה מדי או לא תקינה");
  }
  const existing = await db.select({ id: lessonBoards.id }).from(lessonBoards).where(eq(lessonBoards.lessonId, lessonId));
  if (existing.length >= MAX_BOARDS) throw new HttpError(400, `אפשר לשמור עד ${MAX_BOARDS} לוחות לשיעור`);
  const [created] = await db.insert(lessonBoards).values({ lessonId, image, caption: caption.slice(0, 120) }).returning({ id: lessonBoards.id });
  return created;
}

export async function listLessonBoards(lessonId: number, teacherId: number) {
  const db = await getDb();
  await ownedLessonRow(lessonId, teacherId);
  return db.select().from(lessonBoards).where(eq(lessonBoards.lessonId, lessonId)).orderBy(asc(lessonBoards.id));
}

export async function deleteLessonBoard(boardId: number, teacherId: number) {
  const db = await getDb();
  const [board] = await db.select().from(lessonBoards).where(eq(lessonBoards.id, boardId)).limit(1);
  if (!board) throw new HttpError(404, "הלוח לא נמצא");
  await ownedLessonRow(board.lessonId, teacherId);
  await db.delete(lessonBoards).where(eq(lessonBoards.id, boardId));
}

async function ownedGroupId(groupId: number, teacherId: number) {
  const db = await getDb();
  const [group] = await db.select().from(groups).where(and(eq(groups.id, groupId), eq(groups.teacherId, teacherId))).limit(1);
  if (!group) throw new HttpError(404, "הקבוצה לא נמצאה");
  return group.id;
}

// רשימת התלמידים של הקבוצה, עם כמה מטלות כל אחד סימן.
export async function listMembers(groupId: number, teacherId: number) {
  const db = await getDb();
  await ownedGroupId(groupId, teacherId);
  const members = await db
    .select({ id: memberships.id, nickname: memberships.nickname, domain: students.domain, joinedAt: memberships.createdAt })
    .from(memberships)
    .innerJoin(students, eq(students.id, memberships.studentId))
    .where(eq(memberships.groupId, groupId))
    .orderBy(asc(memberships.nickname));
  const ids = members.map((m) => m.id);
  const subs = ids.length ? await db.select({ membershipId: submissions.membershipId }).from(submissions).where(inArray(submissions.membershipId, ids)) : [];
  return members.map((m) => ({ ...m, submitted: subs.filter((s) => s.membershipId === m.id).length }));
}

export async function updateMember(membershipId: number, teacherId: number, nickname: string) {
  const db = await getDb();
  const [member] = await db.select().from(memberships).where(eq(memberships.id, membershipId)).limit(1);
  if (!member) throw new HttpError(404, "התלמיד לא נמצא");
  await ownedGroupId(member.groupId, teacherId);
  await db
    .update(memberships)
    .set({ nickname: cleanNickname(nickname) })
    .where(eq(memberships.id, membershipId));
}

export async function removeMember(membershipId: number, teacherId: number) {
  const db = await getDb();
  const [member] = await db.select().from(memberships).where(eq(memberships.id, membershipId)).limit(1);
  if (!member) throw new HttpError(404, "התלמיד לא נמצא");
  await ownedGroupId(member.groupId, teacherId);
  await db.delete(memberships).where(eq(memberships.id, membershipId));
}

/* ---------- צד המורה: הגשות ---------- */

async function ownedLessonItemGroup(lessonItemId: number, teacherId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ groupId: groups.id })
    .from(lessonItems)
    .innerJoin(lessons, eq(lessons.id, lessonItems.lessonId))
    .innerJoin(sequences, eq(sequences.id, lessons.sequenceId))
    .innerJoin(groups, eq(groups.id, sequences.groupId))
    .where(and(eq(lessonItems.id, lessonItemId), eq(groups.teacherId, teacherId)))
    .limit(1);
  if (!row) throw new HttpError(404, "הפריט לא נמצא");
  return row.groupId;
}

// כל תלמידי הקבוצה מול מטלה אחת: מי הגיש, מה כתב, ומי עוד לא.
export async function listSubmissions(lessonItemId: number, teacherId: number) {
  const db = await getDb();
  const groupId = await ownedLessonItemGroup(lessonItemId, teacherId);
  const members = await db
    .select({ id: memberships.id, nickname: memberships.nickname })
    .from(memberships)
    .where(eq(memberships.groupId, groupId))
    .orderBy(asc(memberships.nickname));
  const rows = await db.select().from(submissions).where(eq(submissions.lessonItemId, lessonItemId));
  const byMember = new Map(rows.map((r) => [r.membershipId, r]));
  return members.map((m) => {
    const r = byMember.get(m.id);
    return { membershipId: m.id, nickname: m.nickname, submission: r ? { id: r.id, ...submissionView(r) } : null };
  });
}

export async function setFeedback(submissionId: number, teacherId: number, feedback: string) {
  const db = await getDb();
  const [row] = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);
  if (!row) throw new HttpError(404, "ההגשה לא נמצאה");
  await ownedLessonItemGroup(row.lessonItemId, teacherId);
  await db
    .update(submissions)
    .set({ feedback: feedback.trim().slice(0, 1000), feedbackAt: new Date() })
    .where(eq(submissions.id, submissionId));
}

// לכל מטלה בקבוצה: כמה הגישו וכמה ביקשו עזרה. בשביל המונה שעל הפריט בלוח של המורה.
export async function submissionCounts(groupId: number, teacherId: number) {
  const db = await getDb();
  await ownedGroupId(groupId, teacherId);
  const members = await db.select({ id: memberships.id }).from(memberships).where(eq(memberships.groupId, groupId));
  const ids = members.map((m) => m.id);
  const rows = ids.length
    ? await db.select({ lessonItemId: submissions.lessonItemId, needsHelp: submissions.needsHelp }).from(submissions).where(inArray(submissions.membershipId, ids))
    : [];
  const counts: Record<number, { submitted: number; help: number }> = {};
  for (const r of rows) {
    const c = (counts[r.lessonItemId] ??= { submitted: 0, help: 0 });
    c.submitted++;
    if (r.needsHelp) c.help++;
  }
  return { members: ids.length, counts };
}
