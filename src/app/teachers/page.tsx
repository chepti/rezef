import type { Metadata } from "next";
import TeachersDirectory from "@/components/TeachersDirectory";

export const metadata: Metadata = { title: "מורים | הרצף של חומר פתוח" };

export default function TeachersPage() {
  return <TeachersDirectory />;
}
