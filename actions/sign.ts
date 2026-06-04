"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { isRecipientTurn, advanceAfterSign } from "@/lib/status";
import { uploadBytes, paths } from "@/lib/storage";
import type { Document, Recipient, Field } from "@/lib/database.types";

export type SignPayload = {
  values: Record<string, string>; // fieldId -> 값 (text/date/checkbox)
  signatures: Record<string, string>; // fieldId -> PNG dataURL
};

async function reqMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? null,
    ua: h.get("user-agent") ?? null,
  };
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** 서명자가 열람 시각/상태 기록. */
export async function markViewed(token: string) {
  const sb = createAdminClient();
  const { data: r } = await sb
    .from("recipients")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();
  if (!r) return;
  const recip = r as Recipient;
  if (recip.status === "sent") {
    await sb
      .from("recipients")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", recip.id);
    const meta = await reqMeta();
    await logEvent(sb, {
      document_id: recip.document_id,
      recipient_id: recip.id,
      type: "viewed",
      actor: recip.email,
      ip: meta.ip,
      user_agent: meta.ua,
    });
  }
}

/** 서명 제출. 토큰으로 본인 확인 후 필드 값/서명 이미지를 저장하고 상태를 진행. */
export async function submitSignature(token: string, payload: SignPayload) {
  const sb = createAdminClient();
  const meta = await reqMeta();

  const { data: rRow } = await sb.from("recipients").select("*").eq("access_token", token).maybeSingle();
  if (!rRow) throw new Error("유효하지 않은 링크입니다");
  const recip = rRow as Recipient;

  const { data: dRow } = await sb.from("documents").select("*").eq("id", recip.document_id).single();
  const doc = dRow as Document;
  if (!["sent", "in_progress"].includes(doc.status)) throw new Error("서명할 수 없는 문서 상태입니다");
  if (["signed", "declined"].includes(recip.status)) throw new Error("이미 처리된 서명입니다");

  const { data: allRecips } = await sb.from("recipients").select("*").eq("document_id", doc.id);
  if (!isRecipientTurn(doc, (allRecips ?? []) as Recipient[], recip))
    throw new Error("아직 서명할 차례가 아닙니다");

  const { data: fRows } = await sb
    .from("fields")
    .select("*")
    .eq("document_id", doc.id)
    .eq("recipient_id", recip.id);
  const fields = (fRows ?? []) as Field[];

  for (const f of fields) {
    if (f.type === "signature" || f.type === "initial") {
      const dataUrl = payload.signatures[f.id];
      if (!dataUrl) {
        if (f.required) throw new Error("서명을 입력하세요");
        continue;
      }
      const png = decodeDataUrl(dataUrl);
      const path = paths.signature(doc.id, f.id);
      await uploadBytes(sb, path, png, "image/png");
      await sb.from("fields").update({ asset_path: path }).eq("id", f.id);
    } else if (f.type === "checkbox") {
      const v = payload.values[f.id] === "true" ? "true" : "false";
      await sb.from("fields").update({ value: v }).eq("id", f.id);
    } else {
      let v = payload.values[f.id]?.trim() ?? "";
      if (!v && f.type === "name") v = recip.name;
      if (!v && f.required) throw new Error("필수 입력 항목을 채워주세요");
      await sb.from("fields").update({ value: v }).eq("id", f.id);
    }
  }

  await sb
    .from("recipients")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      sign_ip: meta.ip,
      user_agent: meta.ua,
    })
    .eq("id", recip.id);

  await logEvent(sb, {
    document_id: doc.id,
    recipient_id: recip.id,
    type: "signed",
    actor: recip.email,
    ip: meta.ip,
    user_agent: meta.ua,
  });

  await advanceAfterSign(sb, doc.id);
  return { ok: true };
}

/** 서명 거절. */
export async function declineDocument(token: string, reason: string) {
  const sb = createAdminClient();
  const meta = await reqMeta();
  const { data: rRow } = await sb.from("recipients").select("*").eq("access_token", token).maybeSingle();
  if (!rRow) throw new Error("유효하지 않은 링크입니다");
  const recip = rRow as Recipient;

  await sb
    .from("recipients")
    .update({ status: "declined", declined_reason: reason || null })
    .eq("id", recip.id);
  await sb.from("documents").update({ status: "declined" }).eq("id", recip.document_id);
  await logEvent(sb, {
    document_id: recip.document_id,
    recipient_id: recip.id,
    type: "declined",
    actor: recip.email,
    ip: meta.ip,
    user_agent: meta.ua,
    meta: { reason },
  });
  return { ok: true };
}
