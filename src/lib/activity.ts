import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, tables } from "@/db";
import type { ActivityAnswer } from "@/db/schema";
import { addExistingItem, ownedLesson } from "./board";
import { hasReporting } from "./report-skill";
import { HttpError } from "./session";

const { htmlActivities, activityAttempts, items, lessonItems, lessons, sequences, groups, memberships } = tables;

export const MAX_HTML_CHARS = 1_500_000;
const MAX_ANSWERS = 400;

/* ---------- הקוד עצמו: שמירה, עדכון והגשה ---------- */

function cleanHtml(raw: string): string {
  // הבינה מחזירה לפעמים את הקוד עטוף בגדר של Markdown; מסירים אותה.
  const html = raw
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n/, "")
    .replace(/\n```\s*$/, "")
    .trim();
  if (html.length < 20 || !/<[a-zA-Z!]/.test(html)) throw new HttpError(400, "זה לא נראה כמו קוד HTML");
  if (html.length > MAX_HTML_CHARS) throw new HttpError(400, "הקוד ארוך מדי (עד 1.5MB)");
  return html;
}

function titleFrom(html: string, given: string): string {
  const fromTag = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1] ?? "";
  const title = (given.trim() || fromTag.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() || "פעילות").slice(0, 120);
  return title;
}

// קוד HTML שהמורה הדביקה: נשמר, והופך לפריט מסוג "פעילות" שמוטמע חי אצל המורה ואצל התלמידים.
export async function createHtmlActivity(lessonId: number, teacherId: number, origin: string, input: { html: string; title?: string; index?: number }) {
  await ownedLesson(lessonId, teacherId);
  const html = cleanHtml(input.html);
  const db = await getDb();
  const token = randomBytes(18).toString("base64url");
  const [item] = await db
    .insert(items)
    .values({ teacherId, url: `${origin}/h/${token}`, title: titleFrom(html, input.title ?? ""), kind: "html", contentType: "פעילות", siteName: "קוד HTML", meta: {} })
    .returning();
  await db.insert(htmlActivities).values({ token, teacherId, itemId: item.id, html });
  await addExistingItem(lessonId, teacherId, item.id, input.index);
  return { itemId: item.id, reporting: hasReporting(html) };
}

async function ownedActivity(itemId: number, teacherId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ activity: htmlActivities, title: items.title })
    .from(htmlActivities)
    .innerJoin(items, eq(items.id, htmlActivities.itemId))
    .where(and(eq(htmlActivities.itemId, itemId), eq(htmlActivities.teacherId, teacherId)))
    .limit(1);
  if (!row) throw new HttpError(404, "הפעילות לא נמצאה");
  return row;
}

export async function getHtmlActivity(itemId: number, teacherId: number) {
  const { activity, title } = await ownedActivity(itemId, teacherId);
  return { title, html: activity.html, reporting: hasReporting(activity.html), updatedAt: activity.updatedAt };
}

// עדכון הקוד (למשל אחרי שהבינה הוסיפה שכבת דיווח). הכתובת והנתונים שכבר נאספו נשארים.
export async function updateHtmlActivity(itemId: number, teacherId: number, patch: { html?: string; title?: string }) {
  const { activity } = await ownedActivity(itemId, teacherId);
  const db = await getDb();
  let reporting = hasReporting(activity.html);
  if (patch.html !== undefined) {
    const html = cleanHtml(patch.html);
    reporting = hasReporting(html);
    await db.update(htmlActivities).set({ html, updatedAt: new Date() }).where(eq(htmlActivities.id, activity.id));
  }
  const title = patch.title?.trim().slice(0, 120);
  if (title) await db.update(items).set({ title }).where(eq(items.id, itemId));
  return { reporting };
}

// רץ לפני הקוד של הפעילות. במסגרת מבודדת אין אחסון מקומי, וגישה אליו זורקת שגיאה שמפילה משחקים שלמים:
// נותנים תחליף בזיכרון. בנוסף מדווחים לדף העוטף שהתלמיד פעיל (בלי שום תוכן), כדי למדוד זמן עבודה אמיתי.
const SHIM = `<script>(function(){
function mem(){var s={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(s,k)?s[k]:null},setItem:function(k,v){s[k]=String(v)},removeItem:function(k){delete s[k]},clear:function(){s={}},key:function(i){return Object.keys(s)[i]||null},get length(){return Object.keys(s).length}}}
["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(e2){}}});
try{document.cookie}catch(e){try{Object.defineProperty(document,"cookie",{get:function(){return""},set:function(){},configurable:true})}catch(e2){}}
if(window.parent===window)return;
var last=0;function ping(){var now=Date.now();if(now-last<5000)return;last=now;try{window.parent.postMessage({rezef:1,type:"alive"},"*")}catch(e){}}
["pointerdown","pointermove","keydown","input","touchstart","wheel"].forEach(function(ev){window.addEventListener(ev,ping,{capture:true,passive:true})});
})();</script>`;

function withShim(html: string): string {
  // אחרי <head> (או <html>, או ה-doctype), כדי לא להעביר את הדף למצב תאימות ישן.
  for (const re of [/<head[^>]*>/i, /<html[^>]*>/i, /<!doctype[^>]*>/i]) {
    const m = html.match(re);
    if (m && m.index !== undefined) {
      const at = m.index + m[0].length;
      return html.slice(0, at) + SHIM + html.slice(at);
    }
  }
  return SHIM + html;
}

export async function readActivityPage(token: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ html: htmlActivities.html }).from(htmlActivities).where(eq(htmlActivities.token, token)).limit(1);
  return row ? withShim(row.html) : null;
}

/* ---------- דיווח מהתלמיד ---------- */

export type ActivityEvent =
  | { t: "start" }
  | { t: "answer"; id?: string; q?: string; concept?: string; correct: boolean | null; response?: string; expected?: string }
  | { t: "progress"; percent: number }
  | { t: "finish"; score?: number | null; maxScore?: number | null; summary?: string };

export type ActivityReportInput = { lessonItemId: number; clientKey: string; activeSeconds: number; events: ActivityEvent[] };

// דיווח מהדף של התלמיד: זמן עבודה מצטבר ואירועים חדשים. נשמר רק לפריט HTML בשיעור פתוח, בקבוצה שהתלמיד חבר בה.
export async function recordActivity(studentId: number, input: ActivityReportInput) {
  const db = await getDb();
  const [row] = await db
    .select({ membershipId: memberships.id, kind: items.kind })
    .from(lessonItems)
    .innerJoin(items, eq(items.id, lessonItems.itemId))
    .innerJoin(lessons, eq(lessons.id, lessonItems.lessonId))
    .innerJoin(sequences, eq(sequences.id, lessons.sequenceId))
    .innerJoin(memberships, and(eq(memberships.groupId, sequences.groupId), eq(memberships.studentId, studentId)))
    .where(and(eq(lessonItems.id, input.lessonItemId), isNotNull(lessons.openedAt)))
    .limit(1);
  if (!row || row.kind !== "html") throw new HttpError(404, "הפעילות לא נמצאה");

  const now = Date.now();
  const answers: ActivityAnswer[] = [];
  let progress: number | null = null;
  let finished = false;
  let score: number | null = null;
  let maxScore: number | null = null;
  let summary: string | null = null;
  for (const e of input.events) {
    if (e.t === "answer") {
      answers.push({ id: e.id, q: e.q, concept: e.concept, correct: e.correct, response: e.response, expected: e.expected, at: now });
    } else if (e.t === "progress") {
      progress = Math.round(e.percent);
    } else if (e.t === "finish") {
      finished = true;
      if (e.score != null) score = Math.round(e.score);
      if (e.maxScore != null) maxScore = Math.round(e.maxScore);
      if (e.summary) summary = e.summary;
    }
  }
  if (finished && progress == null) progress = 100;

  const key = { membershipId: row.membershipId, lessonItemId: input.lessonItemId, clientKey: input.clientKey };
  await db.insert(activityAttempts).values(key).onConflictDoNothing();
  // עדכון אחד ואטומי: שני דיווחים שמגיעים יחד (למשל בסגירת הדף) לא דורסים זה את זה.
  // הזמן המדווח לא יכול לעלות על הזמן שעבר מאז תחילת הניסיון.
  await db
    .update(activityAttempts)
    .set({
      activeSeconds: sql`greatest(${activityAttempts.activeSeconds}, least(${Math.max(0, Math.round(input.activeSeconds))}, (extract(epoch from now() - ${activityAttempts.startedAt}))::int + 10))`,
      ...(answers.length
        ? {
            answers: sql`case when jsonb_array_length(${activityAttempts.answers}) + ${answers.length} <= ${MAX_ANSWERS} then ${activityAttempts.answers} || ${JSON.stringify(answers)}::jsonb else ${activityAttempts.answers} end`,
          }
        : {}),
      ...(progress == null ? {} : { progress: sql`greatest(coalesce(${activityAttempts.progress}, 0), ${Math.max(0, Math.min(100, progress))})` }),
      ...(finished ? { finished: true } : {}),
      ...(score == null ? {} : { score }),
      ...(maxScore == null ? {} : { maxScore }),
      ...(summary == null ? {} : { summary }),
      updatedAt: new Date(),
    })
    .where(and(eq(activityAttempts.membershipId, key.membershipId), eq(activityAttempts.lessonItemId, key.lessonItemId), eq(activityAttempts.clientKey, key.clientKey)));
}

/* ---------- צד המורה: נתוני השימוש ---------- */

async function ownedLessonItemGroup(lessonItemId: number, teacherId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ groupId: groups.id, itemId: items.id, html: htmlActivities.html })
    .from(lessonItems)
    .innerJoin(items, eq(items.id, lessonItems.itemId))
    .innerJoin(lessons, eq(lessons.id, lessonItems.lessonId))
    .innerJoin(sequences, eq(sequences.id, lessons.sequenceId))
    .innerJoin(groups, eq(groups.id, sequences.groupId))
    .leftJoin(htmlActivities, eq(htmlActivities.itemId, items.id))
    .where(and(eq(lessonItems.id, lessonItemId), eq(groups.teacherId, teacherId)))
    .limit(1);
  if (!row) throw new HttpError(404, "הפריט לא נמצא");
  return row;
}

// ניסיון נחשב רק אם היה בו משהו: עבודה של כמה שניות לפחות, תשובה או סיום.
const meaningful = (a: { activeSeconds: number; answers: unknown[]; finished: boolean }) => a.activeSeconds >= 5 || a.answers.length > 0 || a.finished;

// כל תלמידי הקבוצה מול פעילות אחת: זמן עבודה, ניסיונות והתשובות של כל ניסיון.
export async function activityReport(lessonItemId: number, teacherId: number) {
  const db = await getDb();
  const owned = await ownedLessonItemGroup(lessonItemId, teacherId);
  const members = await db
    .select({ id: memberships.id, nickname: memberships.nickname })
    .from(memberships)
    .where(eq(memberships.groupId, owned.groupId))
    .orderBy(asc(memberships.nickname));
  const rows = await db.select().from(activityAttempts).where(eq(activityAttempts.lessonItemId, lessonItemId)).orderBy(asc(activityAttempts.startedAt));
  return {
    reporting: owned.html ? hasReporting(owned.html) : false,
    rows: members.map((m) => ({
      membershipId: m.id,
      nickname: m.nickname,
      attempts: rows
        .filter((r) => r.membershipId === m.id && meaningful(r))
        .map((r) => ({
          id: r.id,
          seconds: r.activeSeconds,
          answers: r.answers,
          progress: r.progress,
          finished: r.finished,
          score: r.score,
          maxScore: r.maxScore,
          summary: r.summary,
          startedAt: r.startedAt,
          updatedAt: r.updatedAt,
        })),
    })),
  };
}

// לכל פעילות HTML בקבוצה: כמה תלמידים עבדו בה ומה אחוז ההצלחה הממוצע. בשביל המונה שעל הפריט בלוח.
export async function activityCounts(groupId: number, teacherId: number) {
  const db = await getDb();
  const [group] = await db.select({ id: groups.id }).from(groups).where(and(eq(groups.id, groupId), eq(groups.teacherId, teacherId))).limit(1);
  if (!group) throw new HttpError(404, "הקבוצה לא נמצאה");
  const members = await db.select({ id: memberships.id }).from(memberships).where(eq(memberships.groupId, groupId));
  const ids = members.map((m) => m.id);
  const rows = ids.length
    ? await db
        .select({ membershipId: activityAttempts.membershipId, lessonItemId: activityAttempts.lessonItemId, activeSeconds: activityAttempts.activeSeconds, answers: activityAttempts.answers, finished: activityAttempts.finished })
        .from(activityAttempts)
        .where(inArray(activityAttempts.membershipId, ids))
    : [];
  const per = new Map<number, { students: Set<number>; correct: number; graded: number }>();
  for (const r of rows) {
    if (!meaningful(r)) continue;
    const c = per.get(r.lessonItemId) ?? { students: new Set<number>(), correct: 0, graded: 0 };
    c.students.add(r.membershipId);
    for (const a of r.answers) {
      if (a.correct === null) continue;
      c.graded++;
      if (a.correct) c.correct++;
    }
    per.set(r.lessonItemId, c);
  }
  const counts: Record<number, { students: number; percent: number | null }> = {};
  for (const [id, c] of per) counts[id] = { students: c.students.size, percent: c.graded ? Math.round((c.correct / c.graded) * 100) : null };
  return { counts };
}
