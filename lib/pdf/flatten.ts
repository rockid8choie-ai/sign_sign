import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Field, Recipient, Document, SignEvent } from "@/lib/database.types";
import { downloadBytes, uploadBytes, paths } from "@/lib/storage";
import { embedBodyFont, sanitizeWinAnsi } from "@/lib/pdf/font";

type Sb = SupabaseClient<Database>;

const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.45, 0.5, 0.56);

function drawFitText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxH: number,
  font: PDFFont,
  korean: boolean,
  color = INK
) {
  const value = korean ? text : sanitizeWinAnsi(text);
  const size = Math.max(8, Math.min(13, maxH * 0.7));
  page.drawText(value, { x: x + 2, y: y + (maxH - size) / 2 + 1, size, font, color });
}

/**
 * 원본 PDF에 모든 서명/입력 필드 값을 합성해 완료본을 만들고, 별도 감사 인증서를
 * 생성해 둘 다 storage에 업로드한다. 좌표는 0..1 정규화(좌상단)이므로 페이지 크기에
 * 맞춰 pdf-lib의 좌하단 원점으로 변환한다.
 */
export async function generateSignedPdf(
  sb: Sb,
  documentId: string
): Promise<{ signedPath: string; certPath: string }> {
  const { data: docRow } = await sb.from("documents").select("*").eq("id", documentId).single();
  const doc = docRow as Document;
  if (!doc?.file_path) throw new Error("원본 PDF가 없습니다");

  const { data: fieldRows } = await sb.from("fields").select("*").eq("document_id", documentId);
  const fields = (fieldRows ?? []) as Field[];

  const original = await downloadBytes(sb, doc.file_path);
  const pdf = await PDFDocument.load(original);
  const { body, korean } = await embedBodyFont(pdf);
  const pages = pdf.getPages();

  for (const f of fields) {
    const page = pages[f.page - 1];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();
    const rx = f.x * pw;
    const rw = f.w * pw;
    const rh = f.h * ph;
    const ry = ph - (f.y + f.h) * ph; // top-left → bottom-left

    if ((f.type === "signature" || f.type === "initial") && f.asset_path) {
      try {
        const png = await downloadBytes(sb, f.asset_path);
        const img = await pdf.embedPng(png);
        const scale = Math.min(rw / img.width, rh / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        page.drawImage(img, {
          x: rx + (rw - dw) / 2,
          y: ry + (rh - dh) / 2,
          width: dw,
          height: dh,
        });
      } catch (e) {
        console.error("[flatten] 서명 이미지 합성 실패:", e);
      }
    } else if (f.type === "checkbox") {
      const on = f.value === "true" || f.value === "on" || f.value === "1";
      page.drawRectangle({
        x: rx,
        y: ry,
        width: Math.min(rw, rh),
        height: Math.min(rw, rh),
        borderColor: INK,
        borderWidth: 1,
      });
      if (on) {
        drawFitText(page, "X", rx, ry, Math.min(rw, rh), body, korean);
      }
    } else if (f.value) {
      drawFitText(page, f.value, rx, ry, rh, body, korean);
    }
  }

  const signedBytes = await pdf.save();
  const signedPath = paths.signed(documentId);
  await uploadBytes(sb, signedPath, signedBytes, "application/pdf");

  const certPath = await generateCertificate(sb, documentId);
  return { signedPath, certPath };
}

/** 감사 인증서 PDF — 문서 정보 + 서명자별 시각/IP + 이벤트 로그. */
export async function generateCertificate(sb: Sb, documentId: string): Promise<string> {
  const { data: docRow } = await sb.from("documents").select("*").eq("id", documentId).single();
  const doc = docRow as Document;
  const { data: recipRows } = await sb
    .from("recipients")
    .select("*")
    .eq("document_id", documentId)
    .order("order_index", { ascending: true });
  const recipients = (recipRows ?? []) as Recipient[];
  const { data: eventRows } = await sb
    .from("events")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  const events = (eventRows ?? []) as SignEvent[];

  const pdf = await PDFDocument.create();
  const { body, korean } = await embedBodyFont(pdf);
  let page = pdf.addPage([595, 842]); // A4
  const M = 48;
  let y = 842 - M;

  const text = (s: string, size: number, color = INK, indent = 0) => {
    if (y < M + 40) {
      page = pdf.addPage([595, 842]);
      y = 842 - M;
    }
    page.drawText(korean ? s : sanitizeWinAnsi(s), {
      x: M + indent,
      y,
      size,
      font: body,
      color,
    });
    y -= size + 6;
  };
  const rule = () => {
    page.drawLine({
      start: { x: M, y: y + 4 },
      end: { x: 595 - M, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.9),
    });
    y -= 10;
  };

  text("Signing Certificate / 전자서명 인증서", 18);
  y -= 4;
  text(`Document ID: ${doc.id}`, 9, MUTED);
  rule();

  text("Document", 13);
  text(`Title: ${doc.title}`, 10, INK, 8);
  text(`Status: ${doc.status}`, 10, INK, 8);
  text(`Source: ${doc.source_app}${doc.external_ref ? ` (ref ${doc.external_ref})` : ""}`, 10, INK, 8);
  if (doc.sent_at) text(`Sent: ${doc.sent_at}`, 10, INK, 8);
  if (doc.completed_at) text(`Completed: ${doc.completed_at}`, 10, INK, 8);
  y -= 6;

  text("Signers", 13);
  for (const r of recipients) {
    text(`${r.order_index}. ${r.name} <${r.email}> — ${r.role}`, 10, INK, 8);
    text(`status: ${r.status}${r.signed_at ? ` · signed ${r.signed_at}` : ""}`, 9, MUTED, 18);
    if (r.sign_ip) text(`ip: ${r.sign_ip}`, 9, MUTED, 18);
  }
  y -= 6;

  text("Audit Trail", 13);
  for (const e of events) {
    const who = e.actor ? ` · ${e.actor}` : "";
    const ip = e.ip ? ` · ${e.ip}` : "";
    text(`${e.created_at}  ${e.type}${who}${ip}`, 9, MUTED, 8);
  }

  const bytes = await pdf.save();
  const certPath = paths.cert(documentId);
  await uploadBytes(sb, certPath, bytes, "application/pdf");
  return certPath;
}
