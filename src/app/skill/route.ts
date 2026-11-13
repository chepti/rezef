import { REPORT_SKILL } from "@/lib/report-skill";

// ההנחיה להוספת שכבת דיווח, כטקסט פשוט: להדבקה לבינה שיצרה את הפעילות, או לקריאה ישירה על ידי סוכן.
export async function GET() {
  return new Response(REPORT_SKILL, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
