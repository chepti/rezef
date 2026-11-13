import { getSettings } from "@/lib/admin";

// מה שהדפדפן צריך לדעת בלי להיות מחובר: הודעות, וכניסת תלמידים פתוחה או לא.
export async function GET() {
  const s = await getSettings();
  return Response.json({ studentsEnabled: s.students_enabled === "1", studentNotice: s.student_notice, teacherNotice: s.teacher_notice });
}
