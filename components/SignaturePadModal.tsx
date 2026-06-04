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
  const [empty, setEmpty] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  // 캔버스를 컨테이너 크기에 맞게 DPR 보정해 리사이즈
  const fitCanvas = () => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const data = pad.toData();
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")!.scale(ratio, ratio);
    pad.clear();
    if (data.length) pad.fromData(data);
    setEmpty(pad.isEmpty());
  };

  useEffect(() => {
    if (tab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePad(canvas, { penColor: "#16181d", minWidth: 1, maxWidth: 2.6 });
    pad.addEventListener("endStroke", () => setEmpty(pad.isEmpty()));
    padRef.current = pad;
    // 레이아웃 확정 후 핏
    requestAnimationFrame(fitCanvas);
    window.addEventListener("resize", fitCanvas);
    return () => {
      window.removeEventListener("resize", fitCanvas);
      pad.off();
    };
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
      ctx.fillStyle = "#16181d";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "72px 'Nanum Pen Script','Segoe Script','Comic Sans MS',cursive";
      ctx.fillText(text, 300, 100);
      onSave(c.toDataURL("image/png"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-[20px] bg-white p-5 sm:rounded-[20px]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base font-bold text-[#16181d]">서명 입력</h3>
        <div className="mb-3 flex gap-2">
          {(["draw", "type"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-[10px] py-2.5 text-sm font-bold transition ${
                tab === t ? "bg-[#1B64FF] text-white" : "bg-[#eef1f5] text-[#4b5563]"
              }`}
            >
              {t === "draw" ? "✍️ 직접 그리기" : "⌨️ 타이핑"}
            </button>
          ))}
        </div>

        {tab === "draw" ? (
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="h-52 w-full touch-none rounded-xl border border-[#e5e8eb] bg-[#fbfcfd]"
            />
            {empty && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-[#aab2bd]">여기에 손가락이나 마우스로 서명하세요</span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-6 bottom-7 border-b border-dashed border-[#d1d6db]" />
          </div>
        ) : (
          <div className="rounded-xl border border-[#e5e8eb] bg-[#fbfcfd] p-4">
            <input
              className="input mb-2"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="이름 입력"
            />
            <div
              className="flex h-28 items-center justify-center text-4xl text-[#16181d]"
              style={{ fontFamily: "'Nanum Pen Script','Segoe Script','Comic Sans MS',cursive" }}
            >
              {typed || "서명 미리보기"}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {tab === "draw" && (
            <button
              onClick={() => {
                padRef.current?.clear();
                setEmpty(true);
              }}
              className="btn-ghost"
            >
              다시
            </button>
          )}
          <button onClick={onClose} className="btn-ghost ml-auto">
            취소
          </button>
          <button onClick={save} disabled={tab === "draw" && empty} className="btn-primary">
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
