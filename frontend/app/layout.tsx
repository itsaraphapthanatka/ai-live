import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Live Agency — ระบบ AI Live Commerce อัตโนมัติ",
  description: "SaaS สำหรับ Agency ที่รับทำ AI Live ให้ธุรกิจ ครบวงจร — AI Script, TTS, Streaming, Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
