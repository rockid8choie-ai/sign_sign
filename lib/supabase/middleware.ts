import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** 세션 쿠키 갱신 + 대시보드 보호. 서명/공개/API 경로는 통과시킨다. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // 공개 경로: 서명 페이지, 로그인, 인증 콜백, API, 정적 파일
  const isPublic =
    path.startsWith("/sign") ||
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/api") ||
    path.startsWith("/icon") ||
    path.startsWith("/apple-icon") ||
    path.startsWith("/manifest");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
