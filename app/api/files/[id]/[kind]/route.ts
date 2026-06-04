import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadBytes } from "@/lib/storage";

// 원본/완료본/인증서 PDF 스트리밍. private 버킷이므로 접근 권한을 먼저 검증한다.
//  - 발신자(소유자): 로그인 세션 + RLS 로 본인 문서 확인
//  - 서명자: ?token= 으로 해당 문서의 수신자임을 확인
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kind: string }> }
) {
  const { id, kind } = await params;
  const token = req.nextUrl.searchParams.get("token");

  let allowed = false;
  if (token) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("recipients")
      .select("id")
      .eq("document_id", id)
      .eq("access_token", token)
      .maybeSingle();
    allowed = !!data;
  } else {
    const rls = await createClient();
    const { data } = await rls.from("documents").select("id").eq("id", id).maybeSingle();
    allowed = !!data; // RLS 가 소유자만 통과시킴
  }
  if (!allowed) return new NextResponse("forbidden", { status: 403 });

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("file_path, signed_file_path, cert_path, status")
    .eq("id", id)
    .single();
  if (!doc) return new NextResponse("not found", { status: 404 });

  const path =
    kind === "signed" ? doc.signed_file_path : kind === "cert" ? doc.cert_path : doc.file_path;
  if (!path) return new NextResponse("not found", { status: 404 });

  try {
    const bytes = await downloadBytes(admin, path);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${kind}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
