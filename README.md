# 사인사인 (sign-sign)

FM OS·MomoCare 공용 **독립 전자서명 서비스**. 모두의싸인 방식의 무로그인 서명 흐름을
제공하고, 두 앱은 REST API + 웹훅으로 연동합니다.

## 핵심 기능
- PDF 업로드 → **드래그로 서명/텍스트/날짜/체크/이름 필드 배치**
- **다중 서명자 + 순차/동시 서명** 순서
- **무로그인 서명 링크** (토큰) — 받는 사람은 계정 없이 그리기/타이핑으로 서명
- **상태 추적 + 감사 로그** (열람·서명 시각, IP, UA)
- 전원 완료 시 **서명 합성 완료본 PDF + 감사 인증서** 자동 생성
- **REST API**(`/api/v1/documents`) + **완료 웹훅**(`document.completed`)

## 스택
Next.js 15 (App Router) · React 19 · Supabase(Postgres/Storage/Auth + RLS) · Tailwind 4 ·
pdfjs-dist(렌더) · pdf-lib(합성) · signature_pad(서명).

## 아키텍처 요약
- **발신자 대시보드**: Supabase Auth 로그인, RLS 로 본인 문서만 접근.
- **익명 서명자 / 외부 API**: 토큰·API키 검증 후 **service-role**(admin) 클라이언트로 처리(RLS 우회).
- 좌표는 페이지 기준 **0~1 정규화(좌상단 원점)** — 렌더 배율과 무관하게 합성.
- 원본/완료본/인증서/서명이미지는 **private 스토리지**, 서버 경유로만 전달.

## 로컬 실행
```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev
```
로컬 Supabase를 쓰면: `npx supabase start` → `npm run db:reset`(마이그레이션+seed) → 위 dev.

## 폴더
- `app/` 라우트(대시보드 `/`, 업로드 `/documents/new`, 에디터·상세 `/documents/[id]`, 서명 `/sign/[token]`, API `/api/v1/*`, 파일 `/api/files/*`)
- `actions/` Server Actions (auth·documents·sign)
- `lib/` supabase 클라이언트·상태전이·PDF 합성·토큰·웹훅·스토리지
- `components/` UI·PDF 뷰어·필드 에디터·서명 패드
- `supabase/migrations` 스키마·RLS

배포는 [DEPLOY.md](./DEPLOY.md) 참고.
