import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사인사인 · 전자서명",
  description: "서명이 필요한 모든 곳에 — FM OS·MomoCare 공용 전자서명 서비스",
  applicationName: "사인사인",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "사인사인",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1B64FF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
