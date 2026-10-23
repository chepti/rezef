import { eq, isNotNull } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { signedPost } from "./wp-bridge";

const { items, lessonItems, lessons, crossItems, sequences, groups, teachers } = tables;

type UsageRow = {
  post_id: number;
  sequences: number;
  phases: Record<string, number>;
  durations: Record<string, number>;
  notes: Array<{ text: string; author: string }>;
};

// נתוני שימוש מצטברים לכל פריט של חומר פתוח: בכמה רצפים הוא נמצא, באילו שלבים ובאיזה משך.
// הערות נכללות רק כשהמורה סימנה "שיתוף" (shareNote), ועם שמה. אין כאן שום מידע על תלמידים.
export async function computeUsage(): Promise<UsageRow[]> {
  const db = await getDb();
  const byPost = new Map<number, UsageRow & { seq: Set<number>; noted: Array<{ at: number; text: string; author: string }> }>();
  const slot = (postId: number) => {
    let row = byPost.get(postId);
    if (!row) {
      row = { post_id: postId, sequences: 0, phases: {}, durations: {}, notes: [], seq: new Set(), noted: [] };
      byPost.set(postId, row);
    }
    return row;
  };

  const inLessons = await db
    .select({ li: lessonItems, postId: items.openstuffPostId, sequenceId: lessons.sequenceId, author: teachers.displayName })
    .from(lessonItems)
    .innerJoin(items, eq(items.id, lessonItems.itemId))
    .innerJoin(lessons, eq(lessons.id, lessonItems.lessonId))
    .innerJoin(sequences, eq(sequences.id, lessons.sequenceId))
    .innerJoin(groups, eq(groups.id, sequences.groupId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .where(isNotNull(items.openstuffPostId));

  for (const r of inLessons) {
    const row = slot(r.postId!);
    row.seq.add(r.sequenceId);
    if (r.li.phase) row.phases[r.li.phase] = (row.phases[r.li.phase] ?? 0) + 1;
    if (r.li.duration) row.durations[r.li.duration] = (row.durations[r.li.duration] ?? 0) + 1;
    if (r.li.shareNote && r.li.note.trim()) {
      row.noted.push({ at: r.li.createdAt.getTime(), text: r.li.note.trim(), author: r.author });
    }
  }

  const inCross = await db
    .select({ postId: items.openstuffPostId, sequenceId: crossItems.sequenceId })
    .from(crossItems)
    .innerJoin(items, eq(items.id, crossItems.itemId))
    .where(isNotNull(items.openstuffPostId));
  for (const r of inCross) slot(r.postId!).seq.add(r.sequenceId);

  return [...byPost.values()].map((row) => ({
    post_id: row.post_id,
    sequences: row.seq.size,
    phases: row.phases,
    durations: row.durations,
    notes: row.noted
      .sort((a, b) => b.at - a.at)
      .slice(0, 5)
      .map((n) => ({ text: n.text, author: n.author })),
  }));
}

export async function syncUsage(dry: boolean) {
  const rows = await computeUsage();
  if (dry) return { dry: true, items: rows };
  const result = await signedPost("usage", 0, { items: rows });
  return { dry: false, status: result.status, response: result.json, sent: rows.length };
}
