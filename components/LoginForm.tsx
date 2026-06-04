"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

// 클라이언트 인증: 세션 쿠키를 브라우저가 직접 기록하므로 설치형 PWA(standalone)
// 에서도 세션이 유실되지 않는다. (서버액션 리다이렉트의 Set-Cookie 유실 회피)
export function LoginForm({ initialSignup }: { initialSignup: boolean }) {
  const [isSignup, setIsSignup] = useState(initialSignup);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const supabase = createClient();
    try {
      const { error } = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErr(translate(error.message));
        setBusy(false);
        return;
      }
      // 세션 확인 후 이동 (autoconfirm 이므로 가입 즉시 세션 발급)
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setErr(isSignup ? "이미 가입된 이메일일 수 있어요. 로그인해 주세요." : "로그인에 실패했어요.");
        setBusy(false);
        return;
      }
      router.refresh();
      router.replace("/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류가 발생했어요");
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[380px]">
      <div className="mb-8 lg:hidden">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1B64FF] text-base font-extrabold text-white">
            S
          </span>
          <span className="text-lg font-bold text-[#16181d]">사인사인</span>
        </div>
      </div>

      <h2 className="text-2xl font-extrabold tracking-tight text-[#16181d]">
        {isSignup ? "지금 시작하기" : "다시 오신 걸 환영해요"}
      </h2>
      <p className="mt-2 text-sm text-[#8a94a6]">
        {isSignup ? "이메일로 30초 만에 가입할 수 있어요." : "전자서명 워크스페이스에 로그인하세요."}
      </p>

      <form onSubmit={submit} className="mt-7 space-y-3">
        {err && (
          <div className="rounded-[10px] bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">{err}</div>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#4b5563]">이메일</label>
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#4b5563]">비밀번호</label>
          <input
            className="input"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder="6자 이상"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary mt-1 w-full py-3 text-[15px]" type="submit" disabled={busy}>
          {busy ? "처리 중…" : isSignup ? "무료로 시작하기" : "로그인"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#8a94a6]">
        {isSignup ? (
          <>
            이미 계정이 있으신가요?{" "}
            <button onClick={() => { setIsSignup(false); setErr(null); }} className="font-bold text-[#1B64FF]">
              로그인
            </button>
          </>
        ) : (
          <>
            처음이신가요?{" "}
            <button onClick={() => { setIsSignup(true); setErr(null); }} className="font-bold text-[#1B64FF]">
              무료 회원가입
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function translate(msg: string): string {
  if (/Invalid login credentials/i.test(msg)) return "이메일 또는 비밀번호가 올바르지 않아요.";
  if (/already registered|already been registered/i.test(msg)) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (/Password should be at least/i.test(msg)) return "비밀번호는 6자 이상이어야 해요.";
  return msg;
}
