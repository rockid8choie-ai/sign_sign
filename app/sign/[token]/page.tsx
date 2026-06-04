import { createAdminClient } from "@/lib/supabase/admin";
import { markViewed } from "@/actions/sign";
import { isRecipientTurn } from "@/lib/status";
import { SignerView } from "@/components/SignerView";
import type { Document, Recipient, Field } from "@/lib/database.types";

function StatusScreen({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="card max-w-sm text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#f2f4f6] text-2xl">
          {icon}
        </div>
        <h2 className="text-lg font-bold text-[#191f28]">{title}</h2>
        <p className="mt-1.5 text-sm text-[#8b95a1]">{desc}</p>
      </div>
    </div>
  );
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = createAdminClient();

  const { data: rRow } = await sb.from("recipients").select("*").eq("access_token", token).maybeSingle();
  if (!rRow)
    return <StatusScreen icon="🔗" title="유효하지 않은 링크" desc="링크가 만료되었거나 잘못되었습니다." />;
  const recip = rRow as Recipient;

  const { data: dRow } = await sb.from("documents").select("*").eq("id", recip.document_id).single();
  const doc = dRow as Document;

  if (recip.status === "signed")
    return <StatusScreen icon="✓" title="이미 서명을 완료했어요" desc="이 문서에 대한 서명이 이미 제출되었습니다." />;
  if (recip.status === "declined")
    return <StatusScreen icon="✕" title="서명을 거절했어요" desc="이 요청은 거절 처리되었습니다." />;
  if (doc.status === "voided")
    return <StatusScreen icon="🚫" title="취소된 요청" desc="요청자가 이 서명 요청을 취소했습니다." />;
  if (doc.status === "completed")
    return <StatusScreen icon="✓" title="완료된 문서" desc="이 문서는 모든 서명이 완료되었습니다." />;
  if (doc.status === "expired")
    return <StatusScreen icon="⏳" title="만료된 요청" desc="서명 기한이 지났습니다." />;

  const { data: allRecips } = await sb.from("recipients").select("*").eq("document_id", doc.id);
  if (recip.role === "signer" && !isRecipientTurn(doc, (allRecips ?? []) as Recipient[], recip))
    return (
      <StatusScreen
        icon="⏳"
        title="아직 차례가 아니에요"
        desc="앞 순서의 서명자가 서명을 마치면 알림을 받게 됩니다."
      />
    );

  await markViewed(token);

  const { data: fRows } = await sb
    .from("fields")
    .select("*")
    .eq("document_id", doc.id)
    .eq("recipient_id", recip.id);
  const fields = (fRows ?? []) as Field[];

  return (
    <SignerView
      token={token}
      title={doc.title}
      message={doc.message}
      recipientName={recip.name}
      fileUrl={`/api/files/${doc.id}/original?token=${token}`}
      fields={fields.map((f) => ({
        id: f.id,
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        w: f.w,
        h: f.h,
        required: f.required,
      }))}
    />
  );
}
