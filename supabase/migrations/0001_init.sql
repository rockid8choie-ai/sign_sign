-- =============================================================================
-- 사인사인 (sign-sign) — 0001 전자서명 핵심 스키마
-- FM OS·MomoCare 공용 독립 전자서명 서비스
-- =============================================================================

create extension if not exists pgcrypto;

-- 앱 전용 private 스키마 (SECURITY DEFINER 헬퍼용)
create schema if not exists app;

-- ── enums ────────────────────────────────────────────────────────────────────
create type sign_status as enum (
  'draft',        -- 작성 중
  'sent',         -- 발송됨 (아직 아무도 서명 안 함)
  'in_progress',  -- 일부 서명 완료
  'completed',    -- 전원 서명 완료
  'declined',     -- 거절됨
  'voided',       -- 발신자가 취소
  'expired'       -- 기한 만료
);

create type recipient_status as enum (
  'pending',  -- 차례 대기 (순차 서명에서 앞사람 미완)
  'sent',     -- 서명 요청 발송됨
  'viewed',   -- 문서 열람함
  'signed',   -- 서명 완료
  'declined'  -- 거절
);

create type field_type as enum (
  'signature', -- 서명
  'initial',   -- 이니셜/도장
  'text',      -- 자유 텍스트
  'date',      -- 날짜
  'checkbox',  -- 체크박스
  'name'       -- 이름 (자동 채움)
);

create type recipient_role as enum ('signer', 'viewer');

-- ── documents (봉투/Envelope) ─────────────────────────────────────────────────
create table documents (
  id          uuid primary key default gen_random_uuid(),
  source_app  text not null default 'manual',  -- 'fm_os' | 'momocare' | 'manual'
  external_ref text,                            -- 호출 앱의 자체 식별자 (예: 작업지시 id)
  org_ref     text,                             -- 호출 앱의 테넌트(org) id
  title       text not null,
  message     text,                             -- 서명자에게 보내는 안내문
  status      sign_status not null default 'draft',
  file_path   text,                             -- 원본 PDF (storage)
  signed_file_path text,                        -- 서명 합성된 완료본 PDF
  cert_path   text,                             -- 감사 인증서 PDF
  page_count  int not null default 0,
  ordered     boolean not null default true,    -- true=순차서명, false=동시서명
  created_by  uuid references auth.users(id) on delete set null,  -- 대시보드 발신자
  api_key_id  uuid,                             -- API로 생성됐다면 어떤 키인지
  webhook_url text,                             -- 완료 시 콜백 URL (문서별)
  expires_at  timestamptz,
  sent_at     timestamptz,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index documents_created_by_idx on documents(created_by);
create index documents_status_idx on documents(status);
create index documents_source_idx on documents(source_app, org_ref);

-- ── recipients (서명자) ───────────────────────────────────────────────────────
create table recipients (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  name         text not null,
  email        text not null,
  role         recipient_role not null default 'signer',
  order_index  int not null default 1,          -- 서명 순서 (1부터)
  status       recipient_status not null default 'pending',
  access_token text unique,                     -- 무로그인 서명 링크 토큰 (비밀)
  color        text not null default '#3182f6', -- 에디터에서 이 서명자 필드 색
  viewed_at    timestamptz,
  signed_at    timestamptz,
  declined_reason text,
  sign_ip      text,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index recipients_document_idx on recipients(document_id);
create index recipients_token_idx on recipients(access_token);

-- ── fields (서명/입력 필드) ─────────────────────────────────────────────────────
-- 좌표는 페이지 기준 0..1 정규화 (좌상단 원점). 렌더 배율과 무관하게 합성 가능.
create table fields (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  recipient_id uuid references recipients(id) on delete cascade,
  type         field_type not null,
  page         int not null default 1,
  x            double precision not null,
  y            double precision not null,
  w            double precision not null,
  h            double precision not null,
  required     boolean not null default true,
  label        text,
  value        text,           -- 입력된 값 (text/date/checkbox)
  asset_path   text,           -- 서명 이미지 (storage, signature/initial)
  created_at   timestamptz not null default now()
);
create index fields_document_idx on fields(document_id);
create index fields_recipient_idx on fields(recipient_id);

-- ── events (감사 추적) ───────────────────────────────────────────────────────────
create table events (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  recipient_id uuid references recipients(id) on delete set null,
  type         text not null,   -- created/sent/viewed/signed/completed/declined/voided/downloaded
  actor        text,            -- 이름/이메일/'system'
  ip           text,
  user_agent   text,
  meta         jsonb,
  created_at   timestamptz not null default now()
);
create index events_document_idx on events(document_id, created_at);

-- ── api_keys (외부 앱 연동 키) ──────────────────────────────────────────────────
create table api_keys (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  source_app text not null,           -- 'fm_os' | 'momocare'
  key_hash   text not null unique,    -- sha256(key)
  prefix     text not null,           -- 화면 표시용 앞자리 (예: sk_live_ab12…)
  revoked    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── updated_at 자동 갱신 ─────────────────────────────────────────────────────────
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger documents_touch before update on documents
  for each row execute function app.touch_updated_at();
