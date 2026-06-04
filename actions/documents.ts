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
import { uploadBytes, paths } from "@/lib/storage";
import { RECIPIENT_COLORS } from "@/lib/labels";
import type { FieldType } from "@/lib/database.types";

const recipientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["signer", "viewer"]).default("signer"),
});

/** PDF 업로드 + 서명자 등록 → 초안 문서 생성 후 에디터로 이동. */
export async function createDocument(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const admin = createAdminClient();

  const title = String(formData.get("title") ?? "").trim() || "제목 없는 문서";
  const message = String(formData.get("message") ?? "").trim() || null;
  const ordered = formData.get("ordered") === "on" || formData.get("ordered") === "true";
  const file = formData.get("file");
  const recipients = recipientSchema
    .array()
    .min(1)
    .parse(JSON.parse(String(formData.get("recipients") ?? "[]")));

  if (!(file instanceof File) || file.size === 0) throw new Error("PDF 파일을 첨부하세요");
  const bytes = new Uint8Array(await file.arrayBuffer());

  let pageCount = 1;
  try {
    pageCount = (await PDFDocument.load(bytes)).getPageCount();
  } catch {
    throw new Error("유효한 PDF가 아닙니다");
  }

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      title,
      message,
      ordered,
      source_app: "manual",
      status: "draft",
      page_count: pageCount,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !doc) throw new Error(error?.message ?? "문서 생성 실패");

  await uploadBytes(admin, paths.original(doc.id), bytes, "application/pdf");
  await supabase.from("documents").update({ file_path: paths.original(doc.id) }).eq("id", doc.id);

  await supabase.from("recipients").insert(
    recipients.map((r, i) => ({
      document_id: doc.id,
      name: r.name,
      email: r.email,
      role: r.role,
      order_index: i + 1,
      color: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length],
    }))
  );

  await logEvent(supabase, { document_id: doc.id, type: "created", actor: user.email });
  redirect(`/documents/${doc.id}`);
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
export async function saveFields(
  documentId: string,
  fields: z.infer<typeof fieldInput>[]
) {
  await requireUser();
  const supabase = await createClient();
  const parsed = fieldInput.array().parse(fields);

  await supabase.from("fields").delete().eq("document_id", documentId);
  if (parsed.length > 0) {
    const { error } = await supabase.from("fields").insert(
      parsed.map((f) => ({ ...f, document_id: documentId, label: f.label ?? null }))
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/documents/${documentId}`);
}

/** 발송: 서명자별 토큰 생성 + 상태 전환. (이메일 미설정 시 화면에서 링크 복사) */
export async function sendDocument(documentId: string) {
  await requireUser();
  const supabase = await createClient();

  const { data: recips } = await supabase
    .from("recipients")
    .select("id, access_token")
    .eq("document_id", documentId);
  for (const r of recips ?? []) {
    if (!r.access_token) {
      await supabase
        .from("recipients")
        .update({ access_token: generateAccessToken() })
        .eq("id", r.id);
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
