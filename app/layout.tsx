import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "스터디결 | 나만의 공부, 나만의 결",
  description: "개인의 학습 기록부터 학원의 학생 관리까지. 개인과 학원을 위한 스터디결을 만나보세요. 현재 기존 학원 계정으로 이용할 수 있습니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
