import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Rubik } from "next/font/google";
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
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
