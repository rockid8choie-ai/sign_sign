"use client";

import { useMemo, useState } from "react";
import { PdfViewer } from "@/components/PdfViewer";
import { SignaturePadModal } from "@/components/SignaturePadModal";
import { submitSignature, declineDocument, type SignPayload } from "@/actions/sign";
import { FIELD_LABEL } from "@/lib/labels";
import type { FieldType } from "@/lib/database.types";

type SField = {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
};

export function SignerView({
  token,
  title,
  message,
  recipientName,
  fields,
  fileUrl,
}: {
  token: string;
  title: string;
  message: string | null;
  recipientName: string;
  fields: SField[];
  fileUrl: string;
}) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      if (f.type === "name") init[f.id] = recipientName;
      if (f.type === "date") init[f.id] = today;
      if (f.type === "checkbox") init[f.id] = "false";
    }
    return init;
  });
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [openField, setOpenField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFilled = (f: SField) => {
    if (f.type === "signature" || f.type === "initial") return !!signatures[f.id];
    if (f.type === "checkbox") return !f.required || values[f.id] === "true";
    return !f.required || !!(values[f.id] ?? "").trim();
  };
  const remaining = fields.filter((f) => f.required && !isFilled(f)).length;

  const submit = async () => {
    setError(null);
    if (remaining > 0) {
      setError(`아직 채우지 않은 필수 항목이 ${remaining}개 있어요`);
      return;
    }
    setSubmitting(true);
    try {
      const payload: SignPayload = { values, signatures };
      await submitSignature(token, payload);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const decline = async () => {
    const reason = window.prompt("거절 사유를 입력하세요 (선택)") ?? "";
    if (!window.confirm("정말 서명을 거절하시겠어요?")) return;
    await declineDocument(token, reason);
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="card max-w-sm text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl">
            ✓
          </div>
          <h2 className="text-lg font-bold text-[#191f28]">처리가 완료되었어요</h2>
          <p className="mt-1.5 text-sm text-[#8b95a1]">결과는 요청한 곳으로 전달됩니다. 창을 닫으셔도 됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 border-b border-[#eaecef] bg-white/90 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div className="text-sm font-bold text-[#191f28]">{title}</div>
          <div className="text-xs text-[#8b95a1]">{recipientName} 님 · 서명을 요청받았어요</div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-5">
        {message && (
          <div className="card mb-4 text-sm text-[#4e5968]">{message}</div>
        )}

        <PdfViewer
          url={fileUrl}
          renderOverlay={(page, size) => (
            <div className="absolute inset-0">
              {fields
                .filter((f) => f.page === page)
                .map((f) => {
                  const style: React.CSSProperties = {
                    left: f.x * size.width,
                    top: f.y * size.height,
                    width: f.w * size.width,
                    height: f.h * size.height,
                  };
                  if (f.type === "signature" || f.type === "initial") {
                    return (
                      <button
                        key={f.id}
                        onClick={() => setOpenField(f.id)}
                        className="field-box field-signature absolute overflow-hidden"
                        style={style}
                      >
                        {signatures[f.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={signatures[f.id]} alt="서명" className="h-full w-full object-contain" />
                        ) : (
                          <span>{FIELD_LABEL[f.type]} 하기</span>
                        )}
                      </button>
                    );
                  }
                  if (f.type === "checkbox") {
                    const on = values[f.id] === "true";
                    return (
                      <button
                        key={f.id}
                        onClick={() => setValues((v) => ({ ...v, [f.id]: on ? "false" : "true" }))}
                        className="field-box field-checkbox absolute"
                        style={style}
                      >
                        {on ? "✓" : ""}
                      </button>
                    );
                  }
                  return (
                    <input
                      key={f.id}
                      value={values[f.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                      placeholder={FIELD_LABEL[f.type]}
                      className="field-box field-text absolute bg-white/80 px-1 text-center outline-none"
                      style={style}
                    />
                  );
                })}
            </div>
          )}
        />
      </div>

      {/* 하단 액션 바 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eaecef] bg-white/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex-1 text-xs text-[#8b95a1]">
            {error ? (
              <span className="font-semibold text-red-500">{error}</span>
            ) : remaining > 0 ? (
              `남은 필수 항목 ${remaining}개`
            ) : (
              "모든 항목을 채웠어요"
            )}
          </div>
          <button onClick={decline} className="btn-ghost text-red-500">
            거절
          </button>
          <button onClick={submit} disabled={submitting} className="btn-primary">
            {submitting ? "제출 중…" : "서명 완료"}
          </button>
        </div>
      </div>

      {openField && (
        <SignaturePadModal
          name={recipientName}
          onClose={() => setOpenField(null)}
          onSave={(dataUrl) => {
            setSignatures((s) => ({ ...s, [openField]: dataUrl }));
            setOpenField(null);
          }}
        />
      )}
    </div>
  );
}
