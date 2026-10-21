import { z } from "zod";
import { errorResponse, HttpError, requireTeacher, type Teacher } from "./session";

export async function withTeacher(fn: (teacher: Teacher) => Promise<unknown>): Promise<Response> {
  try {
    const teacher = await requireTeacher();
    const result = await fn(teacher);
    return Response.json(result ?? { ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "גוף הבקשה אינו JSON תקין");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "נתונים לא תקינים");
  }
  return parsed.data;
}

export function numId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, "מזהה לא תקין");
  return n;
}
