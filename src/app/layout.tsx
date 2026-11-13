import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Rubik } from "next/font/google";
import HeaderAuth from "@/components/HeaderAuth";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: "הרצף של חומר פתוח",
  description: "מארגנים שיעורים ברצף, בקלות.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="bg-white border-b border-line">
          <div className="mx-auto max-w-7xl px-5 py-2 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3" aria-label="הרצף של חומר פתוח">
              <Image src="/logo.png" alt="חומר פתוח" width={96} height={48} priority />
              <span className="text-lg font-extrabold">הרצף</span>
            </Link>
            <div className="ms-auto flex items-center gap-3">
              <HeaderAuth />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        {/* פס משוב מוצמד לתחתית המסך, דק, כדי לא לתפוס מקום מהתוכן */}
        <footer className="sticky bottom-0 z-40 border-t border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-center px-5 py-1">
            <a
              href={`mailto:chepti@gmail.com?subject=${encodeURIComponent("משוב: הרצף של חומר פתוח")}`}
              className="btn btn-ghost !py-1 text-sm"
              data-tip="נשמח לשמוע: מה עובד ומה מפריע"
            >
              <MessageSquare size={15} strokeWidth={2} /> משוב
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
