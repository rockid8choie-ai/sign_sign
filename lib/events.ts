import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Sb = SupabaseClient<Database>;

/** 감사 로그 1줄 기록. 실패해도 본 흐름을 막지 않는다. */
export async function logEvent(
  sb: Sb,
  e: {
    document_id: string;
    recipient_id?: string | null;
    type: string;
    actor?: string | null;
    ip?: string | null;
    user_agent?: string | null;
    meta?: Record<string, unknown> | null;
  }
) {
  try {
    await sb.from("events").insert({
      document_id: e.document_id,
      recipient_id: e.recipient_id ?? null,
      type: e.type,
      actor: e.actor ?? null,
      ip: e.ip ?? null,
      user_agent: e.user_agent ?? null,
      meta: e.meta ?? null,
    });
  } catch {
    /* 감사 로그 실패는 무시 */
  }
}
