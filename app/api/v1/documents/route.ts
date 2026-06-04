import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApi, clientIp } from "@/lib/api/auth";
import { generateAccessToken } from "@/lib/crypto";
import { uploadBytes, paths } from "@/lib/storage";
import { logEvent } from "@/lib/events";
import { markSent } from "@/lib/status";
import { RECIPIENT_COLORS } from "@/lib/labels";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}

const fieldSchema = z.object({
  type: z.enum(["signature", "initial", "text", "date", "checkbox", "name"]),
  page: z.number().int().min(1).default(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  required: z.boolean().default(true),
  label: z.string().optional(),
});

const recipientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["signer", "viewer"]).default("signer"),
  fields: fieldSchema.array().default([]),
});

const createSchema = z
  .object({
    title: z.string().min(1),
    message: z.string().optional(),
    ordered: z.boolean().default(true),
    external_ref: z.string().optional(),
    org_ref: z.string().optional(),
    webhook_url: z.string().url().optional(),
    send: z.boolean().default(true),
    file_base64: z.string().optional(),
    file_url: z.string().url().optional(),
    recipients: recipientSchema.array().min(1),
  })
  .refine((d) => d.file_base64 || d.file_url, {
    message: "file_base64 또는 file_url 중 하나는 필수입니다",
  });

async function loadPdfBytes(body: z.infer<typeof createSchema>): Promise<Uint8Array> {
  if (body.file_base64) {
    const b64 = body.file_base64.includes(",") ? body.file_base64.split(",")[1] : body.file_base64;
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const res = await fetch(body.file_url!, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`file_url fetch 실패: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** 외부 앱이 서명 요청을 생성. API 키 인증. 기본적으로 즉시 발송하고 서명 링크를 반환. */
export async function POST(req: NextRequest) {
  const caller = await authenticateApi(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_request", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }

  let bytes: Uint8Array;
  let pageCount = 1;
  try {
    bytes = await loadPdfBytes(body);
    pageCount = (await PDFDocument.load(bytes)).getPageCount();
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_pdf", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }

  const sb = createAdminClient();
  const { data: doc, error } = await sb
    .from("documents")
    .insert({
      title: body.title,
      message: body.message ?? null,
      ordered: body.ordered,
      source_app: caller.source_app,
      api_key_id: caller.api_key_id,
      external_ref: body.external_ref ?? null,
      org_ref: body.org_ref ?? null,
      webhook_url: body.webhook_url ?? null,
      status: "draft",
      page_count: pageCount,
    })
    .select("id")
    .single();
  if (error || !doc) return NextResponse.json({ error: "create_failed" }, { status: 500 });

  await uploadBytes(sb, paths.original(doc.id), bytes, "application/pdf");
  await sb.from("documents").update({ file_path: paths.original(doc.id) }).eq("id", doc.id);

  // 수신자 + 필드
  const tokens: Record<string, string> = {};
  for (let i = 0; i < body.recipients.length; i++) {
    const r = body.recipients[i];
    const token = generateAccessToken();
    const { data: rec } = await sb
      .from("recipients")
      .insert({
        document_id: doc.id,
        name: r.name,
        email: r.email,
        role: r.role,
        order_index: i + 1,
        color: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length],
        access_token: token,
      })
      .select("id")
      .single();
    if (!rec) continue;
    tokens[rec.id] = token;
    if (r.fields.length > 0) {
      await sb.from("fields").insert(
        r.fields.map((f) => ({
          document_id: doc.id,
          recipient_id: rec.id,
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          w: f.w,
          h: f.h,
          required: f.required,
          label: f.label ?? null,
        }))
      );
    }
  }

  await logEvent(sb, {
    document_id: doc.id,
    type: "created",
    actor: `api:${caller.source_app}`,
    ip: clientIp(req),
  });

  if (body.send) await markSent(sb, doc.id);

  const { data: recipients } = await sb
    .from("recipients")
    .select("id, name, email, role, order_index, status")
    .eq("document_id", doc.id)
    .order("order_index");

  return NextResponse.json(
    {
      id: doc.id,
      status: body.send ? "sent" : "draft",
      recipients: (recipients ?? []).map((r) => ({
        ...r,
        sign_url: tokens[r.id] ? `${appUrl()}/sign/${tokens[r.id]}` : null,
      })),
    },
    { status: 201 }
  );
}

/** 호출 앱이 자기 source_app 의 문서 목록 조회 (org_ref 필터 가능). */
export async function GET(req: NextRequest) {
  const caller = await authenticateApi(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = createAdminClient();
  let q = sb
    .from("documents")
    .select("id, title, status, external_ref, org_ref, created_at, completed_at")
    .eq("source_app", caller.source_app)
    .order("created_at", { ascending: false })
    .limit(100);
  const orgRef = req.nextUrl.searchParams.get("org_ref");
  if (orgRef) q = q.eq("org_ref", orgRef);

  const { data } = await q;
  return NextResponse.json({ documents: data ?? [] });
}
