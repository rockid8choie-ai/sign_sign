import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Document, Recipient } from "@/lib/database.types";
import { logEvent } from "@/lib/events";
import { generateSignedPdf } from "@/lib/pdf/flatten";
import { deliverWebhook } from "@/lib/webhooks";

type Sb = SupabaseClient<Database>;

/** 순차 서명에서 이 서명자 차례인지 (앞 순번 signer가 모두 서명 완료). */
export function isRecipientTurn(doc: Document, recipients: Recipient[], me: Recipient): boolean {
  if (!doc.ordered) return true;
  const earlier = recipients.filter(
    (r) => r.role === "signer" && r.order_index < me.order_index
  );
  return earlier.every((r) => r.status === "signed");
}

/** 발송: 초기 서명자 상태/문서 상태 세팅. ordered면 첫 순번만 활성화. */
export async function markSent(sb: Sb, documentId: string) {
  const { data: doc } = await sb.from("documents").select("*").eq("id", documentId).single();
  if (!doc) throw new Error("document not found");
  const { data: recips } = await sb
    .from("recipients")
    .select("*")
    .eq("document_id", documentId)
    .order("order_index", { ascending: true });
  const recipients = (recips ?? []) as Recipient[];
  const signers = recipients.filter((r) => r.role === "signer");
  if (signers.length === 0) throw new Error("최소 1명의 서명자가 필요합니다");

  const firstOrder = Math.min(...signers.map((r) => r.order_index));
  for (const r of recipients) {
    if (r.role === "viewer") continue;
    const active = !doc.ordered || r.order_index === firstOrder;
    await sb.from("recipients").update({ status: active ? "sent" : "pending" }).eq("id", r.id);
  }
  await sb
    .from("documents")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", documentId);
  await logEvent(sb, { document_id: documentId, type: "sent", actor: "system" });
}

/**
 * 한 서명자가 서명을 마친 뒤 호출. 다음 순번을 활성화하거나, 전원 완료 시
 * 완료본 PDF·인증서를 생성하고 웹훅을 발송한다.
 */
export async function advanceAfterSign(sb: Sb, documentId: string) {
  const { data: doc } = await sb.from("documents").select("*").eq("id", documentId).single();
  if (!doc) return;
  const { data: recips } = await sb
    .from("recipients")
    .select("*")
    .eq("document_id", documentId)
    .order("order_index", { ascending: true });
  const recipients = (recips ?? []) as Recipient[];
  const signers = recipients.filter((r) => r.role === "signer");

  const allSigned = signers.every((r) => r.status === "signed");
  if (allSigned) {
    await completeDocument(sb, doc as Document);
    return;
  }

  // 순차 서명: 다음으로 낮은 미서명 순번을 활성화
  if (doc.ordered) {
    const pending = signers.filter((r) => r.status !== "signed");
    const nextOrder = Math.min(...pending.map((r) => r.order_index));
    for (const r of pending.filter((r) => r.order_index === nextOrder && r.status === "pending")) {
      await sb.from("recipients").update({ status: "sent" }).eq("id", r.id);
      await logEvent(sb, {
        document_id: documentId,
        recipient_id: r.id,
        type: "turn_started",
        actor: "system",
        meta: { email: r.email },
      });
    }
  }
  await sb.from("documents").update({ status: "in_progress" }).eq("id", documentId);
}

/** 전원 서명 완료 처리 — 합성 PDF/인증서 생성 + 웹훅. */
export async function completeDocument(sb: Sb, doc: Document) {
  let signedPath: string | null = null;
  let certPath: string | null = null;
  try {
    const out = await generateSignedPdf(sb, doc.id);
    signedPath = out.signedPath;
    certPath = out.certPath;
  } catch (e) {
    console.error("[complete] PDF 합성 실패:", e);
  }
  await sb
    .from("documents")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      signed_file_path: signedPath,
      cert_path: certPath,
    })
    .eq("id", doc.id);
  await logEvent(sb, { document_id: doc.id, type: "completed", actor: "system" });

  if (doc.webhook_url) {
    await deliverWebhook(doc.webhook_url, {
      event: "document.completed",
      document_id: doc.id,
      external_ref: doc.external_ref,
      org_ref: doc.org_ref,
      status: "completed",
      completed_at: new Date().toISOString(),
    });
  }
}
