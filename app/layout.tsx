import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SG Learning Apps",
  description: "SG 오답노트 Vercel 버전",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
