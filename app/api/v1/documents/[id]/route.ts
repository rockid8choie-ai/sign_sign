import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApi } from "@/lib/api/auth";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}

/** 단일 문서 상태 조회 — 서명자별 진행, 완료본/인증서 다운로드 URL 포함. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await authenticateApi(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const sb = createAdminClient();

  const { data: doc } = await sb.from("documents").select("*").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (doc.source_app !== caller.source_app)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: recipients } = await sb
    .from("recipients")
    .select("id, name, email, role, order_index, status, viewed_at, signed_at")
    .eq("document_id", id)
    .order("order_index");

  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    status: doc.status,
    external_ref: doc.external_ref,
    org_ref: doc.org_ref,
    created_at: doc.created_at,
    sent_at: doc.sent_at,
    completed_at: doc.completed_at,
    recipients: recipients ?? [],
    signed_pdf_url: doc.signed_file_path ? `${appUrl()}/api/files/${id}/signed` : null,
    certificate_url: doc.cert_path ? `${appUrl()}/api/files/${id}/cert` : null,
  });
}
