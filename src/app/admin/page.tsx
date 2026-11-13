import type { Metadata } from "next";
import AdminPanel from "@/components/AdminPanel";

export const metadata: Metadata = { title: "ניהול | הרצף של חומר פתוח" };

export default function AdminPage() {
  return <AdminPanel />;
}
