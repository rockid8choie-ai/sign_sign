import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사인사인 · 전자서명",
  description: "FM OS·MomoCare 공용 전자서명 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
