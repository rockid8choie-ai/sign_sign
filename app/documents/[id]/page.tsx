import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { Badge, Card, fmtDate } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { FieldEditor } from "@/components/FieldEditor";
import { sendDocument, voidDocument, deleteDocument } from "@/actions/documents";
import { DOC_STATUS_LABEL, RECIPIENT_STATUS_LABEL, FIELD_LABEL } from "@/lib/labels";
import type { Document, Recipient, Field, SignEvent } from "@/lib/database.types";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}

export default async function DocumentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: docRow } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  if (!docRow) notFound();
  const doc = docRow as Document;

  const [{ data: recipRows }, { data: fieldRows }, { data: eventRows }] = await Promise.all([
    supabase.from("recipients").select("*").eq("document_id", id).order("order_index"),
    supabase.from("fields").select("*").eq("document_id", id),
    supabase.from("events").select("*").eq("document_id", id).order("created_at", { ascending: false }),
  ]);
  const recipients = (recipRows ?? []) as Recipient[];
  const fields = (fieldRows ?? []) as Field[];
  const events = (eventRows ?? []) as SignEvent[];

  const isDraft = doc.status === "draft";
  const fileUrl = `/api/files/${id}/original`;
  const signers = recipients.filter((r) => r.role === "signer");
  const fieldsForSigner = (rid: string) => fields.filter((f) => f.recipient_id === rid).length;
  const canSend = signers.length > 0 && signers.every((r) => fieldsForSigner(r.id) > 0);

  return (
    <DashboardShell email={user.email}>
      <Link href="/" className="mb-3 inline-block text-sm font-medium text-[#8b95a1] hover:text-[#4e5968]">
        ← 목록
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[1.5rem] font-bold tracking-tight text-[#191f28]">{doc.title}</h1>
            <Badge value={doc.status} label={DOC_STATUS_LABEL[doc.status]} />
          </div>
          <p className="mt-1 text-sm text-[#8b95a1]">
            {fmtDate(doc.created_at)} · {doc.page_count}페이지 · {doc.ordered ? "순차 서명" : "동시 서명"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc.status === "completed" && (
            <>
              <a href={`/api/files/${id}/signed`} target="_blank" className="btn-dark">
                완료본 PDF
              </a>
              <a href={`/api/files/${id}/cert`} target="_blank" className="btn-ghost">
                인증서
              </a>
            </>
          )}
          {isDraft && (
            <form action={sendDocument.bind(null, id)}>
              <button className="btn-primary" disabled={!canSend} title={canSend ? "" : "모든 서명자에게 필드를 1개 이상 배치하세요"}>
                서명 요청 발송
              </button>
            </form>
          )}
          {(doc.status === "sent" || doc.status === "in_progress") && (
            <form action={voidDocument.bind(null, id)}>
              <button className="btn-ghost">발송 취소</button>
            </form>
          )}
          {isDraft && (
            <form action={deleteDocument.bind(null, id)}>
              <button className="btn-ghost text-red-500">삭제</button>
            </form>
          )}
        </div>
      </div>

      {/* 서명자 진행 현황 */}
      <Card className="mb-5 !p-2">
        <div className="divide-y divide-[#f2f4f6]">
          {recipients.map((r) => {
            const link = r.access_token ? `${appUrl()}/sign/${r.access_token}` : null;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: r.color }}
                >
                  {r.order_index}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#191f28]">
                    {r.name} {r.role === "viewer" && <span className="text-xs text-[#8b95a1]">(참조)</span>}
                  </div>
                  <div className="truncate text-xs text-[#8b95a1]">
                    {r.email} · 필드 {fieldsForSigner(r.id)}개
                    {r.signed_at && ` · 서명 ${fmtDate(r.signed_at)}`}
                  </div>
                </div>
                <Badge value={r.status} label={RECIPIENT_STATUS_LABEL[r.status]} />
                {link && r.status !== "signed" && <CopyButton text={link} />}
              </div>
            );
          })}
        </div>
      </Card>

      {!isDraft && doc.message && (
        <Card className="mb-5">
          <div className="text-xs font-semibold text-[#8b95a1]">안내 메시지</div>
          <p className="mt-1 text-sm text-[#4e5968]">{doc.message}</p>
        </Card>
      )}

      {/* 초안: 필드 에디터 / 그 외: 보기 안내 */}
      {isDraft ? (
        recipients.length > 0 ? (
          <FieldEditor
            documentId={id}
            fileUrl={fileUrl}
            recipients={signers.map((r) => ({
              id: r.id,
              name: r.name,
              color: r.color,
              order_index: r.order_index,
            }))}
            initialFields={fields.map((f) => ({
              recipient_id: f.recipient_id!,
              type: f.type,
              page: f.page,
              x: f.x,
              y: f.y,
              w: f.w,
              h: f.h,
              required: f.required,
            }))}
          />
        ) : (
          <Card>서명자가 없습니다.</Card>
        )
      ) : (
        <>
          <Card className="mb-5">
            <div className="mb-2 text-sm font-bold text-[#191f28]">배치된 필드 {fields.length}개</div>
            <div className="flex flex-wrap gap-2 text-xs text-[#4e5968]">
              {fields.map((f) => (
                <span key={f.id} className="rounded-lg bg-[#f2f4f6] px-2 py-1">
                  p{f.page} · {FIELD_LABEL[f.type]}
                </span>
              ))}
            </div>
          </Card>

          {/* 감사 추적 */}
          <Card>
            <div className="mb-3 text-sm font-bold text-[#191f28]">감사 추적</div>
            <ol className="space-y-2.5">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4cad1]" />
                  <div>
                    <span className="font-semibold text-[#191f28]">{e.type}</span>
                    {e.actor && <span className="text-[#4e5968]"> · {e.actor}</span>}
                    <div className="text-xs text-[#8b95a1]">
                      {fmtDate(e.created_at)}
                      {e.ip && ` · ${e.ip}`}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </DashboardShell>
  );
}
