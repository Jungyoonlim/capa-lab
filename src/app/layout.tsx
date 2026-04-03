import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mastery Engine",
  description: "Adaptive learning engine with ZPD tracking and SOLO-based assessment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b border-stone-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <a href="/" className="text-xl font-semibold tracking-tight text-stone-900">
              Mastery Engine
            </a>
            <div className="flex gap-6 text-base text-stone-500">
              <a href="/" className="hover:text-stone-900 transition-colors">Dashboard</a>
              <a href="/history" className="hover:text-stone-900 transition-colors">History</a>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
