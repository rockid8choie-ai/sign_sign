import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * service-role 클라이언트 — RLS 우회. 서버 전용.
 * 익명 서명자 흐름과 외부 REST API 처리에 사용한다.
 * (호출부에서 반드시 토큰/API키를 검증한 뒤 사용할 것)
 */
export function createAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
