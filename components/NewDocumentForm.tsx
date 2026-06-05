"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDraftDocument, finalizeUpload } from "@/actions/documents";
import { createClient } from "@/lib/supabase/browser";

type Row = { name: string; email: string; role: "signer" | "viewer" };

export function NewDocumentForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([{ name: "", email: "", role: "signer" }]);
  const [ordered, setOrdered] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => setRows((rs) => [...rs, { name: "", email: "", role: "signer" }]);
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const valid =
    !!file &&
    !!title.trim() &&
    rows.length > 0 &&
    rows.every((r) => r.name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !file) return;
    setErr(null);
    setBusy(true);
    try {
      setStatus("문서 준비 중…");
      const { documentId, path, token } = await createDraftDocument({
        title: title.trim(),
        message: message.trim() || null,
        ordered,
        recipients: rows,
      });

      setStatus("파일 업로드 중…");
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(path, token, file, { contentType: "application/pdf" });
      if (upErr) throw new Error(upErr.message);

      setStatus("마무리 중…");
      await finalizeUpload(documentId);

      router.push(`/documents/${documentId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드에 실패했어요");
      setStatus(null);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="card space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#4b5563]">문서 제목</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 시설 이용 계약서"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#4b5563]">안내 메시지 (선택)</label>
          <textarea
            className="input"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="서명자에게 보낼 안내문"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#4b5563]">PDF 파일</label>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="input"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
          {file && (
            <p className="mt-1.5 text-xs text-[#8a94a6]">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
            </p>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#16181d]">서명자</h3>
          <label className="flex items-center gap-2 text-xs font-medium text-[#4b5563]">
            <input type="checkbox" checked={ordered} onChange={(e) => setOrdered(e.target.checked)} />
            순차 서명 (순서대로)
          </label>
        </div>

        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef1f5] text-xs font-bold text-[#4b5563]">
              {i + 1}
            </span>
            <input
              className="input min-w-[120px] flex-1"
              placeholder="이름"
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              className="input min-w-[160px] flex-1"
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
                className="rounded-lg px-2 py-1 text-sm text-[#aab2bd] hover:text-red-500"
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

      {err && (
        <div className="rounded-[10px] bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600">{err}</div>
      )}

      <button className="btn-primary w-full py-3.5 text-base" disabled={!valid || busy}>
        {busy ? status ?? "처리 중…" : "다음 · 서명 위치 지정"}
      </button>
    </form>
  );
}
