import { withTeacher } from "@/lib/http";
import { getTerms } from "@/lib/openstuff";

export async function GET() {
  return withTeacher(async () => {
    const [classes, subjects, categories] = await Promise.all([getTerms("classes"), getTerms("subjects"), getTerms("categories")]);
    // "מורים" ו"גנים" הן קטגוריות קהל, לא כיתות לימוד. "ללא קטגוריה" היא ברירת מחדל טכנית של וורדפרס.
    return {
      classes: classes.filter((c) => c.name !== "מורים").map((c) => c.name),
      subjects: subjects.map((s) => s.name),
      categories: categories.filter((c) => c.name !== "ללא קטגוריה" && c.name !== "Uncategorized").map((c) => c.name),
    };
  });
}
