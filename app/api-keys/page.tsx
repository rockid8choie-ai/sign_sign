import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, PageHeader } from "@/components/ui";

const SAMPLE = `curl -X POST "$SIGN_URL/api/v1/documents" \\
  -H "Authorization: Bearer sk_demo_fmos_000000000000000000000000" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "작업완료 확인서",
    "external_ref": "WO-2026-00042",
    "org_ref": "org_abc",
    "webhook_url": "https://fm-os.example.com/api/sign-webhook",
    "ordered": true,
    "file_base64": "<PDF를 base64로>",
    "recipients": [
      { "name": "홍길동", "email": "hong@ex.com",
        "fields": [
          { "type": "signature", "page": 1, "x": 0.6, "y": 0.8, "w": 0.24, "h": 0.08 },
          { "type": "date",      "page": 1, "x": 0.6, "y": 0.9, "w": 0.16, "h": 0.04 }
        ] }
    ]
  }'`;

export default async function ApiKeysPage() {
  const user = await requireUser();
  return (
    <DashboardShell email={user.email}>
      <Link href="/" className="mb-3 inline-block text-sm font-medium text-[#8b95a1] hover:text-[#4e5968]">
        ← 목록
      </Link>
      <PageHeader title="연동 · API" subtitle="FM OS·MomoCare 등 외부 앱에서 서명 요청을 생성하세요" />

      <Card className="mb-5">
        <h3 className="mb-2 text-sm font-bold text-[#191f28]">인증</h3>
        <p className="text-sm leading-relaxed text-[#4e5968]">
          모든 REST 호출에 <code className="rounded bg-[#f2f4f6] px-1.5 py-0.5 text-xs">Authorization: Bearer &lt;API_KEY&gt;</code>{" "}
          헤더를 넣으세요. 키는 Vercel 환경변수{" "}
          <code className="rounded bg-[#f2f4f6] px-1.5 py-0.5 text-xs">SIGN_API_KEYS</code> 또는 DB의{" "}
          <code className="rounded bg-[#f2f4f6] px-1.5 py-0.5 text-xs">api_keys</code> 테이블로 관리합니다.
        </p>
        <div className="mt-3 space-y-1.5 text-xs text-[#8b95a1]">
          <div>데모 키 (로컬 seed): <code className="text-[#4e5968]">sk_demo_fmos_000000000000000000000000</code></div>
          <div>데모 키 (로컬 seed): <code className="text-[#4e5968]">sk_demo_momo_000000000000000000000000</code></div>
        </div>
      </Card>

      <Card className="mb-5">
        <h3 className="mb-2 text-sm font-bold text-[#191f28]">서명 요청 생성 — POST /api/v1/documents</h3>
        <pre className="overflow-x-auto rounded-xl bg-[#191f28] p-4 text-xs leading-relaxed text-[#e8ebed]">
{SAMPLE}
        </pre>
        <p className="mt-3 text-xs leading-relaxed text-[#8b95a1]">
          응답으로 문서 id와 서명자별 <code className="text-[#4e5968]">sign_url</code>(무로그인 서명 링크)을 받습니다.
          좌표 x/y/w/h 는 페이지 기준 0~1 비율(좌상단 원점)입니다. 전원 서명이 끝나면{" "}
          <code className="text-[#4e5968]">webhook_url</code> 로{" "}
          <code className="text-[#4e5968]">document.completed</code> 이벤트가 POST 됩니다.
        </p>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-bold text-[#191f28]">상태 조회 — GET /api/v1/documents/:id</h3>
        <p className="text-sm leading-relaxed text-[#4e5968]">
          문서 상태, 서명자별 진행, 완료 시 <code className="rounded bg-[#f2f4f6] px-1.5 py-0.5 text-xs">signed_pdf_url</code> ·{" "}
          <code className="rounded bg-[#f2f4f6] px-1.5 py-0.5 text-xs">certificate_url</code> 을 반환합니다.
        </p>
      </Card>
    </DashboardShell>
  );
}
