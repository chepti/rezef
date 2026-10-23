import { eq, isNull } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { guessContentType, unfurl, type ItemKind } from "./unfurl";

const { items } = tables;

// פעם אחת אחרי הוספת סוג התוכן: פריטים קיימים בלי סוג מקבלים אותו.
// פריט של חומר פתוח: הקטגוריה האמיתית של הפוסט (שליפה אחת לפריט). אחרים: ניחוש לפי סוג הקישור.
export async function backfillContentTypes() {
  const db = await getDb();
  const rows = await db.select().from(items).where(isNull(items.contentType));
  let fromSite = 0;
  let guessed = 0;
  for (const row of rows) {
    let type = guessContentType(row.kind as ItemKind);
    if (row.kind === "openstuff") {
      const fresh = await unfurl(row.url).catch(() => null);
      if (fresh?.contentType) {
        type = fresh.contentType;
        fromSite++;
      } else {
        guessed++;
      }
    } else {
      guessed++;
    }
    await db.update(items).set({ contentType: type }).where(eq(items.id, row.id));
  }
  return { total: rows.length, fromSite, guessed };
}
