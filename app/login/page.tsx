import { signIn, signUp } from "@/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const { error, mode } = await searchParams;
  const isSignup = mode === "signup";

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3182f6] text-lg font-bold text-white">
            S
          </div>
          <h1 className="text-xl font-bold text-[#191f28]">사인사인</h1>
          <p className="mt-1 text-sm text-[#8b95a1]">전자서명 워크스페이스</p>
        </div>

        <form action={isSignup ? signUp : signIn} className="card space-y-3">
          {error && (
            <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
              {error}
            </div>
          )}
          <input className="input" name="email" type="email" placeholder="이메일" required />
          <input
            className="input"
            name="password"
            type="password"
            placeholder="비밀번호"
            minLength={6}
            required
          />
          <button className="btn-primary w-full" type="submit">
            {isSignup ? "회원가입" : "로그인"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[#8b95a1]">
          {isSignup ? (
            <a href="/login" className="font-semibold text-[#3182f6]">
              이미 계정이 있어요 · 로그인
            </a>
          ) : (
            <a href="/login?mode=signup" className="font-semibold text-[#3182f6]">
              처음이신가요? · 회원가입
            </a>
          )}
        </p>
      </div>
    </div>
  );
}
