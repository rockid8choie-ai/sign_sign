import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "사인사인 · 전자서명",
    short_name: "사인사인",
    description: "서명이 필요한 모든 곳에 — 전자서명 워크스페이스",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1B64FF",
    lang: "ko",
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "any", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
