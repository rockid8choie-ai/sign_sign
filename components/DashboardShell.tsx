import Link from "next/link";
import { signOut } from "@/actions/auth";

export function DashboardShell({
  email,
  children,
}: {
  email: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[#eaecef] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1B64FF] text-xs font-bold text-white">
              S
            </span>
            <span className="text-sm font-bold text-[#191f28]">사인사인</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/api-keys" className="text-sm font-medium text-[#8b95a1] hover:text-[#4e5968]">
              연동·API
            </Link>
            <span className="hidden text-xs text-[#b0b8c1] sm:inline">{email}</span>
            <form action={signOut}>
              <button className="text-sm font-medium text-[#8b95a1] hover:text-[#4e5968]">로그아웃</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
