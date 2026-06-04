# 배포 가이드 — Vercel(앱) + Supabase 클라우드(DB/Storage/Auth)

> 빌드 검증 완료(`npm run build`, 10 routes). 하드코딩된 URL/키 없음 — 전부 환경변수.

## 1단계 — Supabase 클라우드 프로젝트
1. https://supabase.com → **New project**
   - Name: `sign-sign` · Region: `Northeast Asia (Seoul)` 권장
   - **Database Password** 안전하게 보관
2. **Settings → API** 에서 확보: `Project URL`, `anon public` 키, `service_role` 키
3. **Settings → General** 의 `Reference ID` 확보

## 2단계 — 마이그레이션 + seed 푸시
```powershell
$env:Path = "$env:ProgramFiles\nodejs;" + $env:Path
npx supabase login
npx supabase link --project-ref <REFERENCE_ID>
npx supabase db push          # 0001_init, 0002_rls_storage 적용
```
seed(데모 API 키)는 클라우드에선 자동 적용되지 않습니다. 필요 시 SQL Editor에서 `supabase/seed.sql` 실행.

> `documents` private 버킷은 0002 마이그레이션이 생성합니다.

## 3단계 — Supabase Auth 설정
**Authentication → URL Configuration**
- Site URL: `https://<당신의-vercel-도메인>`
- Redirect URLs: `https://<당신의-vercel-도메인>/**`

**Authentication → Providers → Email**: MVP면 **"Confirm email" 끄기**(가입 즉시 로그인).

## 4단계 — Vercel 배포
방법 A) CLI:
```powershell
$env:Path = "$env:ProgramFiles\nodejs;" + $env:Path
npx vercel            # 최초 1회 로그인 + 프로젝트 연결
npx vercel --prod
```
방법 B) GitHub import: vercel.com → Add New → Project → 이 저장소 Import.

**Environment Variables** (Production):

| Key | Value | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public 키 | |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | **서버 전용** |
| `NEXT_PUBLIC_APP_URL` | `https://<vercel-도메인>` | 서명 링크/콜백 생성에 사용 |
| `SIGN_API_KEYS` | `fm_os:sk_live_...,momocare:sk_live_...` | 외부 앱 연동 키(선택) |
| `SIGN_KR_FONT_URL` | 한글 TTF/OTF URL | **선택** — 타이핑 한글 텍스트 합성용 |
| `RESEND_API_KEY` / `SIGN_FROM_EMAIL` | | **선택** — 이메일 발송(미설정 시 링크 수동 공유) |

배포 후 도메인을 `NEXT_PUBLIC_APP_URL` 과 3단계 Site URL/Redirect 에 반영 → 재배포.

## 5단계 — 동작 확인
1. `/login` 회원가입 → `/documents/new` 에서 PDF 업로드 + 서명자 추가
2. 에디터에서 필드 배치 → **서명 요청 발송** → 서명자 행의 **링크 복사**
3. 시크릿창에서 서명 링크 열기 → 그리기/타이핑 서명 → 완료
4. 문서 상세에서 **완료본 PDF / 인증서** 다운로드 + 감사 추적 확인

## 외부 앱(FM OS·MomoCare) 연동
- 생성: `POST /api/v1/documents` (Bearer API 키, PDF base64/URL + 서명자·필드)
- 상태: `GET /api/v1/documents/:id`
- 완료 콜백: 문서 생성 시 `webhook_url` 지정 → `document.completed` POST 수신
- 자세한 예시는 앱 내 **연동·API** 페이지(`/api-keys`) 참고.

## 보안 체크
- `service_role` 키는 **절대 `NEXT_PUBLIC_*`/클라이언트에 두지 말 것**.
- API 키는 코드/깃이 아니라 **환경변수 또는 `api_keys` 테이블**로만 관리.
- 서명 토큰은 추측 불가 난수(24바이트). 링크 유출 주의.
