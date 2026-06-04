import { signIn, signUp } from "@/actions/auth";

const STEPS = [
  { n: "01", t: "문서 업로드", d: "PDF를 올리고 서명 위치를 지정" },
  { n: "02", t: "서명 요청 발송", d: "받는 사람에게 무로그인 링크 전송" },
  { n: "03", t: "서명 완료", d: "어디서든 클릭 몇 번으로 서명" },
  { n: "04", t: "자동 보관", d: "완료본·인증서 자동 생성·보관" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const { error, mode } = await searchParams;
  const isSignup = mode === "signup";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* 좌측 브랜드 히어로 */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[52%] lg:flex-col lg:justify-between"
        style={{ background: "linear-gradient(150deg,#1B64FF 0%,#1450D6 60%,#0e3aa8 100%)" }}>
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />

        <div className="relative px-14 pt-12">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-base font-extrabold text-[#1B64FF]">
              S
            </span>
            <span className="text-lg font-bold text-white">사인사인</span>
          </div>
        </div>

        <div className="relative px-14">
          <h1 className="text-[2.7rem] font-extrabold leading-[1.18] tracking-tight text-white">
            서명이 필요한<br />모든 곳에
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/85">
            계약서·동의서·확인서를 종이 없이. 업로드부터 서명, 보관까지 한 번에 끝내는
            전자서명 워크스페이스.
          </p>
        </div>

        <div className="relative grid grid-cols-2 gap-px bg-white/15 px-px pb-px">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-[#1B64FF]/0 px-14 py-5 backdrop-blur-sm"
              style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="text-xs font-bold text-white/60">{s.n}</div>
              <div className="mt-1 text-sm font-bold text-white">{s.t}</div>
              <div className="mt-0.5 text-xs text-white/70">{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 우측 폼 */}
      <div className="flex flex-1 items-center justify-center bg-white px-5 py-12">
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

          <form action={isSignup ? signUp : signIn} className="mt-7 space-y-3">
            {error && (
              <div className="rounded-[10px] bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
                {error}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4b5563]">이메일</label>
              <input className="input" name="email" type="email" placeholder="you@company.com" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#4b5563]">비밀번호</label>
              <input className="input" name="password" type="password" placeholder="6자 이상" minLength={6} required />
            </div>
            <button className="btn-primary mt-1 w-full py-3 text-[15px]" type="submit">
              {isSignup ? "무료로 시작하기" : "로그인"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#8a94a6]">
            {isSignup ? (
              <>
                이미 계정이 있으신가요?{" "}
                <a href="/login" className="font-bold text-[#1B64FF]">로그인</a>
              </>
            ) : (
              <>
                처음이신가요?{" "}
                <a href="/login?mode=signup" className="font-bold text-[#1B64FF]">무료 회원가입</a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
