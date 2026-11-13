import { type NextRequest } from "next/server";
import { numId, withTeacher } from "@/lib/http";
import { peerCards } from "@/lib/social";

// המלצות מהרצפים המשותפים של מורים שאני עוקבת אחריהם, לפי הקבוצה שנבנית עכשיו.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return withTeacher((teacher) => peerCards(numId(sp.get("group") ?? ""), teacher.id, sp.get("q") ?? "", sp.get("topic") ?? ""));
}
