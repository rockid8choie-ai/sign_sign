"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import { logEvent } from "@/lib/events";
import { markSent } from "@/lib/status";
import { generateAccessToken } from "@/lib/crypto";
import { downloadBytes, paths, BUCKET } from "@/lib/storage";
import { RECIPIENT_COLORS } from "@/lib/labels";

const recipientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["signer", "viewer"]).default("signer"),
});

const draftSchema = z.object({
  title: z.string().trim().min(1),
  message: z.string().trim().nullable().optional(),
  ordered: z.boolean().default(true),
  recipients: recipientSchema.array().min(1),
});

/**
 * 초안 문서 + 서명자 생성, 그리고 원본 PDF용 **서명 업로드 URL**을 발급한다.
 * 파일은 클라이언트가 이 URL로 Storage에 직접 올리므로 서버액션 본문 한도(1MB/
 * Vercel 4.5MB)에 걸리지 않는다.
 */
export async function createDraftDocument(input: z.infer<typeof draftSchema>) {
  const user = await requireUser();
  const supabase = await createClient();
  const admin = createAdminClient();
  const p = draftSchema.parse(input);

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      title: p.title,
      message: p.message ?? null,
      ordered: p.ordered,
      source_app: "manual",
      status: "draft",
      page_count: 0,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !doc) throw new Error(error?.message ?? "문서 생성 실패");

  await supabase.from("recipients").insert(
    p.recipients.map((r, i) => ({
      document_id: doc.id,
      name: r.name,
      email: r.email,
      role: r.role,
      order_index: i + 1,
      color: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length],
    }))
  );

  const path = paths.original(doc.id);
  const { data: signed, error: sErr } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (sErr || !signed) throw new Error(sErr?.message ?? "업로드 URL 발급 실패");

  await logEvent(supabase, { document_id: doc.id, type: "created", actor: user.email });
  return { documentId: doc.id, path: signed.path, token: signed.token };
}

/** 업로드 완료 후: Storage의 원본을 읽어 페이지 수를 계산하고 file_path를 확정. */
export async function finalizeUpload(documentId: string) {
  await requireUser();
  const supabase = await createClient(); // RLS: 본인 문서만
  const admin = createAdminClient();
  const path = paths.original(documentId);

  let pageCount = 1;
  try {
    const bytes = await downloadBytes(admin, path);
    pageCount = (await PDFDocument.load(bytes)).getPageCount();
  } catch {
    throw new Error("업로드된 파일이 유효한 PDF가 아닙니다");
  }

  const { error } = await supabase
    .from("documents")
    .update({ file_path: path, page_count: pageCount })
    .eq("id", documentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/documents/${documentId}`);
  return { ok: true };
}

const fieldInput = z.object({
  recipient_id: z.string().uuid(),
  type: z.enum(["signature", "initial", "text", "date", "checkbox", "name"]),
  page: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  required: z.boolean().default(true),
  label: z.string().nullable().optional(),
});

/** 에디터의 필드 배치 저장(전체 교체). */
export async function saveFields(documentId: string, fields: z.infer<typeof fieldInput>[]) {
  await requireUser();
  const supabase = await createClient();
  const parsed = fieldInput.array().parse(fields);

  await supabase.from("fields").delete().eq("document_id", documentId);
  if (parsed.length > 0) {
    const { error } = await supabase
      .from("fields")
      .insert(parsed.map((f) => ({ ...f, document_id: documentId, label: f.label ?? null })));
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/documents/${documentId}`);
}

/** 발송: 서명자별 토큰 생성 + 상태 전환. */
export async function sendDocument(documentId: string) {
  await requireUser();
  const supabase = await createClient();

  const { data: recips } = await supabase
    .from("recipients")
    .select("id, access_token")
    .eq("document_id", documentId);
  for (const r of recips ?? []) {
    if (!r.access_token) {
      await supabase.from("recipients").update({ access_token: generateAccessToken() }).eq("id", r.id);
    }
  }
  await markSent(supabase, documentId);
  revalidatePath(`/documents/${documentId}`);
}

export async function voidDocument(documentId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("documents").update({ status: "voided" }).eq("id", documentId);
  await logEvent(supabase, { document_id: documentId, type: "voided", actor: user.email });
  revalidatePath(`/documents/${documentId}`);
}

export async function deleteDocument(documentId: string) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("documents").delete().eq("id", documentId);
  redirect("/");
}
