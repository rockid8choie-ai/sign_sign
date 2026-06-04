"use client";

import { useRef, useState } from "react";
import { PdfViewer, type PageSize } from "@/components/PdfViewer";
import { saveFields } from "@/actions/documents";
import { FIELD_LABEL } from "@/lib/labels";
import type { FieldType } from "@/lib/database.types";

type EditorRecipient = { id: string; name: string; color: string; order_index: number };
type EditorField = {
  key: string;
  recipient_id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
};

const DEFAULT_SIZE: Record<FieldType, { w: number; h: number }> = {
  signature: { w: 0.24, h: 0.08 },
  initial: { w: 0.1, h: 0.07 },
  text: { w: 0.26, h: 0.045 },
  date: { w: 0.16, h: 0.045 },
  checkbox: { w: 0.035, h: 0.035 },
  name: { w: 0.2, h: 0.045 },
};

const TYPES: FieldType[] = ["signature", "text", "date", "name", "checkbox", "initial"];

let counter = 0;
const newKey = () => `f${++counter}_${Math.floor(performance.now())}`;

export function FieldEditor({
  documentId,
  fileUrl,
  recipients,
  initialFields,
}: {
  documentId: string;
  fileUrl: string;
  recipients: EditorRecipient[];
  initialFields: Omit<EditorField, "key">[];
}) {
  const [fields, setFields] = useState<EditorField[]>(
    initialFields.map((f) => ({ ...f, key: newKey() }))
  );
  const [activeType, setActiveType] = useState<FieldType>("signature");
  const [activeRecipient, setActiveRecipient] = useState<string>(recipients[0]?.id ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const sizes = useRef<Record<number, PageSize>>({});

  const recipientOf = (id: string) => recipients.find((r) => r.id === id);

  const addField = (page: number, nx: number, ny: number) => {
    if (!activeRecipient) return;
    const d = DEFAULT_SIZE[activeType];
    setFields((fs) => [
      ...fs,
      {
        key: newKey(),
        recipient_id: activeRecipient,
        type: activeType,
        page,
        x: Math.max(0, Math.min(1 - d.w, nx - d.w / 2)),
        y: Math.max(0, Math.min(1 - d.h, ny - d.h / 2)),
        w: d.w,
        h: d.h,
        required: true,
      },
    ]);
    setSaved(false);
  };

  const updateField = (key: string, patch: Partial<EditorField>) => {
    setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
    setSaved(false);
  };
  const removeField = (key: string) => {
    setFields((fs) => fs.filter((f) => f.key !== key));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveFields(
        documentId,
        fields.map((f) => ({
          recipient_id: f.recipient_id,
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          w: f.w,
          h: f.h,
          required: f.required,
          label: null,
        }))
      );
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  // 박스 이동/리사이즈 (parentElement = 페이지 오버레이, 크기=페이지 CSS px)
  const startDrag = (e: React.PointerEvent, key: string, mode: "move" | "resize") => {
    e.stopPropagation();
    const box = e.currentTarget as HTMLElement;
    const overlay = box.closest("[data-overlay]") as HTMLElement | null;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const field = fields.find((f) => f.key === key);
    if (!field) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...field };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (mode === "move") {
        updateField(key, {
          x: Math.max(0, Math.min(1 - orig.w, orig.x + dx)),
          y: Math.max(0, Math.min(1 - orig.h, orig.y + dy)),
        });
      } else {
        updateField(key, {
          w: Math.max(0.03, Math.min(1 - orig.x, orig.w + dx)),
          h: Math.max(0.02, Math.min(1 - orig.y, orig.h + dy)),
        });
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      {/* 도구 패널 */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-3">
          <div className="text-sm font-bold text-[#191f28]">서명자 선택</div>
          <div className="flex flex-wrap gap-2">
            {recipients.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRecipient(r.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeRecipient === r.id ? "text-white" : "text-[#4e5968]"
                }`}
                style={{ background: activeRecipient === r.id ? r.color : "#f2f4f6" }}
              >
                {r.order_index}. {r.name}
              </button>
            ))}
          </div>
        </div>

        <div className="card space-y-3">
          <div className="text-sm font-bold text-[#191f28]">필드 종류</div>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`rounded-xl border-2 px-2 py-2 text-xs font-semibold transition ${
                  activeType === t
                    ? "border-[#3182f6] bg-[#e8f1fe] text-[#2272eb]"
                    : "border-[#eaecef] text-[#4e5968]"
                }`}
              >
                {FIELD_LABEL[t]}
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-[#8b95a1]">
            문서 위를 클릭하면 선택한 서명자의 <b>{FIELD_LABEL[activeType]}</b> 필드가 놓입니다. 드래그로
            이동, 우하단 모서리로 크기 조절, ✕ 로 삭제.
          </p>
        </div>

        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? "저장 중…" : saved ? "저장됨 ✓" : `필드 저장 (${fields.length})`}
        </button>
      </div>

      {/* 문서 */}
      <div>
        <PdfViewer
          url={fileUrl}
          onPageSizes={(s) => {
            sizes.current = { ...sizes.current, ...s };
          }}
          renderOverlay={(page, size) => (
            <div
              data-overlay
              className="absolute inset-0 cursor-crosshair"
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                addField(page, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
              }}
            >
              {fields
                .filter((f) => f.page === page)
                .map((f) => {
                  const r = recipientOf(f.recipient_id);
                  return (
                    <div
                      key={f.key}
                      onPointerDown={(e) => startDrag(e, f.key, "move")}
                      className="field-box absolute cursor-move"
                      style={{
                        left: f.x * size.width,
                        top: f.y * size.height,
                        width: f.w * size.width,
                        height: f.h * size.height,
                        borderColor: r?.color,
                        background: `${r?.color}1a`,
                        color: r?.color,
                      }}
                    >
                      <span className="pointer-events-none truncate px-1">{FIELD_LABEL[f.type]}</span>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(f.key);
                        }}
                        className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-red-500 shadow"
                      >
                        ✕
                      </button>
                      <span
                        onPointerDown={(e) => startDrag(e, f.key, "resize")}
                        className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm border border-white"
                        style={{ background: r?.color }}
                      />
                    </div>
                  );
                })}
            </div>
          )}
        />
      </div>
    </div>
  );
}
