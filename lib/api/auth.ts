import type { NextRequest } from "next/server";
import { hashApiKey } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApiCaller = { source_app: string; api_key_id: string | null };

function extractKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key");
}

/** env(SIGN_API_KEYS="label:key,...") 또는 DB(api_keys)에서 키 검증. */
export async function authenticateApi(req: NextRequest): Promise<ApiCaller | null> {
  const key = extractKey(req);
  if (!key) return null;

  // 1) env 키 (간단 구성)
  const envKeys = process.env.SIGN_API_KEYS;
  if (envKeys) {
    for (const pair of envKeys.split(",")) {
      const [label, k] = pair.split(":");
      if (k && k.trim() === key) return { source_app: (label || "external").trim(), api_key_id: null };
    }
  }

  // 2) DB 키 (해시 대조)
  const sb = createAdminClient();
  const { data } = await sb
    .from("api_keys")
    .select("id, source_app, revoked")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();
  if (data && !data.revoked) return { source_app: data.source_app, api_key_id: data.id };

  return null;
}

export function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}
