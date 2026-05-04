import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "업무 관리 (Vercel)",
  description: "Vercel DB를 활용한 동기화 투두 리스트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
