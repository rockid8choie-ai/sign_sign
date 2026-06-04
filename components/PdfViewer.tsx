"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type PageSize = { width: number; height: number };

// pdfjs 문서 프록시 타입을 느슨하게 사용 (동적 import로 SSR 회피)
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<unknown> };

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      // 워커는 버전 일치 CDN에서 로드 (번들 워커 이슈 회피)
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export function PdfViewer({
  url,
  renderOverlay,
  onPageSizes,
}: {
  url: string;
  renderOverlay?: (page: number, size: PageSize) => React.ReactNode;
  onPageSizes?: (sizes: Record<number, PageSize>) => void;
}) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const loadingTask = pdfjs.getDocument(url);
        const loaded = (await loadingTask.promise) as unknown as PdfDoc;
        if (!cancelled) setDoc(loaded);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error)
    return <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">PDF 로드 실패: {error}</div>;
  if (!doc) return <div className="p-10 text-center text-sm text-[#8b95a1]">문서 불러오는 중…</div>;

  return (
    <div className="space-y-4">
      {Array.from({ length: doc.numPages }, (_, i) => (
        <PdfPageView
          key={i + 1}
          doc={doc}
          pageNumber={i + 1}
          renderOverlay={renderOverlay}
          onSize={onPageSizes}
        />
      ))}
    </div>
  );
}

function PdfPageView({
  doc,
  pageNumber,
  renderOverlay,
  onSize,
}: {
  doc: PdfDoc;
  pageNumber: number;
  renderOverlay?: (page: number, size: PageSize) => React.ReactNode;
  onSize?: (sizes: Record<number, PageSize>) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<PageSize | null>(null);

  const render = useCallback(async () => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const cssWidth = wrap.clientWidth;
    if (cssWidth === 0) return;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const page: any = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = cssWidth / base.width;
    const viewport = page.getViewport({ scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    await page.render({ canvasContext: ctx, viewport }).promise;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const s = { width: viewport.width, height: viewport.height };
    setSize(s);
    onSize?.({ [pageNumber]: s });
  }, [doc, pageNumber, onSize]);

  useEffect(() => {
    render();
    const ro = new ResizeObserver(() => render());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [render]);

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto w-full overflow-hidden rounded-xl border border-[#eaecef] bg-white shadow-sm"
      style={{ height: size ? size.height : undefined }}
    >
      <canvas ref={canvasRef} className="block" />
      {size && renderOverlay && (
        <div className="absolute inset-0" style={{ width: size.width, height: size.height }}>
          {renderOverlay(pageNumber, size)}
        </div>
      )}
    </div>
  );
}
