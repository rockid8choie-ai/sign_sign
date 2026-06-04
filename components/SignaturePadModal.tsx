"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";

export function SignaturePadModal({
  name,
  onClose,
  onSave,
}: {
  name: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState(name);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (tab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")!.scale(ratio, ratio);
    padRef.current = new SignaturePad(canvas, { penColor: "#191f28", minWidth: 0.8, maxWidth: 2.4 });
    return () => padRef.current?.off();
  }, [tab]);

  const save = () => {
    if (tab === "draw") {
      const pad = padRef.current;
      if (!pad || pad.isEmpty()) return;
      onSave(pad.toDataURL("image/png"));
    } else {
      const text = typed.trim();
      if (!text) return;
      const c = document.createElement("canvas");
      c.width = 600;
      c.height = 200;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#191f28";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "64px 'Segoe Script', 'Comic Sans MS', cursive";
      ctx.fillText(text, 300, 100);
      onSave(c.toDataURL("image/png"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[20px] bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-bold text-[#191f28]">서명 입력</h3>
        <div className="mb-3 flex gap-2">
          {(["draw", "type"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                tab === t ? "bg-[#3182f6] text-white" : "bg-[#f2f4f6] text-[#4e5968]"
              }`}
            >
              {t === "draw" ? "직접 그리기" : "타이핑"}
            </button>
          ))}
        </div>

        {tab === "draw" ? (
          <canvas
            ref={canvasRef}
            className="h-44 w-full rounded-xl border border-[#eaecef] bg-[#fbfbfc] touch-none"
          />
        ) : (
          <div className="rounded-xl border border-[#eaecef] bg-[#fbfbfc] p-4">
            <input
              className="input mb-2"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="이름 입력"
            />
            <div
              className="flex h-24 items-center justify-center text-4xl text-[#191f28]"
              style={{ fontFamily: "'Segoe Script','Comic Sans MS',cursive" }}
            >
              {typed || "서명 미리보기"}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {tab === "draw" && (
            <button onClick={() => padRef.current?.clear()} className="btn-ghost">
              지우기
            </button>
          )}
          <button onClick={onClose} className="btn-ghost ml-auto">
            취소
          </button>
          <button onClick={save} className="btn-primary">
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
