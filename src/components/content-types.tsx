import { File as FileGeneric, FileText, Gamepad2, LayoutTemplate, Presentation, Printer, Smartphone, Video } from "lucide-react";

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number }>;

// סוגי התוכן של חומר פתוח: אייקון וגוון לכל סוג. משותף למסכי התלמיד (והלוח של המורה מחזיק עותק זהה).
export const TYPE_META: Record<string, { icon: IconType; color: string }> = {
  סרטון: { icon: Video, color: "#e5484d" },
  מצגת: { icon: Presentation, color: "#4f6cd6" },
  להדפסה: { icon: Printer, color: "#0e9f8a" },
  "מערך שיעור": { icon: FileText, color: "#8a63d2" },
  פעילות: { icon: Gamepad2, color: "#f2702f" },
  "כלי דיגיטלי": { icon: Smartphone, color: "#0f8fb8" },
  תבנית: { icon: LayoutTemplate, color: "#b7791f" },
  אחר: { icon: FileGeneric, color: "#5b6472" },
};

const KIND_TO_TYPE: Record<string, string> = { youtube: "סרטון", video: "סרטון", slides: "מצגת", doc: "מערך שיעור", file: "להדפסה", game: "פעילות" };

export function typeOf(item: { kind: string; contentType?: string | null }): string {
  const type = item.contentType ?? KIND_TO_TYPE[item.kind] ?? "אחר";
  return TYPE_META[type] ? type : "אחר";
}
