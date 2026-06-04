import { createHash, randomBytes } from "crypto";

/** 서명자 무로그인 링크용 비밀 토큰 (URL-safe, 추측 불가). */
export function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

/** 외부 앱용 API 키 발급 (label 접두사 + 난수). */
export function generateApiKey(app: string): { key: string; prefix: string } {
  const slug = app.replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase() || "app";
  const prefix = `sk_live_${slug}_`;
  const key = prefix + randomBytes(24).toString("hex");
  return { key, prefix };
}

/** API 키 저장/대조용 해시 (DB seed의 pgcrypto digest와 동일한 sha256 hex). */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
