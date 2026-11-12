import { errorResponse } from "@/lib/session";
import { currentStudent, googleConfigured, listStudentGroups } from "@/lib/student";

export async function GET() {
  try {
    const student = await currentStudent();
    return Response.json({
      signedIn: Boolean(student),
      googleReady: googleConfigured(),
      devLogin: process.env.DEV_LOGIN === "1",
      groups: student ? await listStudentGroups(student.id) : [],
    });
  } catch (e) {
    if (e && typeof e === "object" && (e as { digest?: string }).digest === "HANGING_PROMISE_REJECTION") throw e;
    return errorResponse(e);
  }
}
