import { withTeacher } from "@/lib/http";
import { getTerms } from "@/lib/openstuff";

export async function GET() {
  return withTeacher(async () => {
    const [classes, subjects] = await Promise.all([getTerms("classes"), getTerms("subjects")]);
    // "מורים" ו"גנים" הן קטגוריות קהל, לא כיתות לימוד.
    return {
      classes: classes.filter((c) => c.name !== "מורים").map((c) => c.name),
      subjects: subjects.map((s) => s.name),
    };
  });
}
