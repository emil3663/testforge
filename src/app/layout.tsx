import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TestForge — AI-native test automation",
  description:
    "Describe what you want to test in plain English. TestForge writes the Playwright code. You review it, run it, and ship with confidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 font-sans">
        {children}
      </body>
    </html>
  );
}
