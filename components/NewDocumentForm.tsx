"use client";

import { useState } from "react";
import { createDocument } from "@/actions/documents";

type Row = { name: string; email: string; role: "signer" | "viewer" };

export function NewDocumentForm() {
  const [rows, setRows] = useState<Row[]>([{ name: "", email: "", role: "signer" }]);
  const [ordered, setOrdered] = useState(true);
  const [pending, setPending] = useState(false);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => setRows((rs) => [...rs, { name: "", email: "", role: "signer" }]);
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const valid =
    rows.length > 0 &&
    rows.every((r) => r.name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email));

  return (
    <form
      action={async (fd) => {
        setPending(true);
        fd.set("recipients", JSON.stringify(rows));
        fd.set("ordered", ordered ? "true" : "false");
        try {
          await createDocument(fd);
        } finally {
          setPending(false);
        }
      }}
      className="space-y-5"
    >
      <div className="card space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#4e5968]">문서 제목</label>
          <input name="title" className="input" placeholder="예: 시설 이용 계약서" required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#4e5968]">안내 메시지 (선택)</label>
          <textarea name="message" className="input" rows={2} placeholder="서명자에게 보낼 안내문" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#4e5968]">PDF 파일</label>
          <input name="file" type="file" accept="application/pdf,.pdf" className="input" required />
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#191f28]">서명자</h3>
          <label className="flex items-center gap-2 text-xs font-medium text-[#4e5968]">
            <input
              type="checkbox"
              checked={ordered}
              onChange={(e) => setOrdered(e.target.checked)}
            />
            순차 서명 (순서대로)
          </label>
        </div>

        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f2f4f6] text-xs font-bold text-[#4e5968]">
              {i + 1}
            </span>
            <input
              className="input flex-1 min-w-[120px]"
              placeholder="이름"
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              className="input flex-1 min-w-[160px]"
              placeholder="이메일"
              type="email"
              value={r.email}
              onChange={(e) => update(i, { email: e.target.value })}
            />
            <select
              className="input w-28"
              value={r.role}
              onChange={(e) => update(i, { role: e.target.value as Row["role"] })}
            >
              <option value="signer">서명</option>
              <option value="viewer">참조</option>
            </select>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-lg px-2 py-1 text-sm text-[#b0b8c1] hover:text-red-500"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={add} className="btn-ghost w-full">
          + 서명자 추가
        </button>
      </div>

      <button className="btn-primary w-full py-3.5 text-base" disabled={!valid || pending}>
        {pending ? "업로드 중…" : "다음 · 서명 위치 지정"}
      </button>
    </form>
  );
}
