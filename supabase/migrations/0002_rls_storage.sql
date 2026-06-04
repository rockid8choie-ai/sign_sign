-- =============================================================================
-- 사인사인 — 0002 RLS + Storage
-- 모델: 대시보드 발신자는 본인이 만든 문서만 RLS로 접근.
--       익명 서명자 흐름과 외부 REST API는 전부 service-role(admin) 클라이언트로
--       토큰/API키를 검증한 뒤 처리하므로 RLS를 우회한다(익명은 RLS 신원이 없음).
-- =============================================================================

-- 헬퍼: 이 문서가 현재 로그인 사용자의 것인가
create or replace function app.owns_document(doc uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documents d
    where d.id = doc and d.created_by = auth.uid()
  );
$$;

-- ── documents ────────────────────────────────────────────────────────────────
alter table documents enable row level security;
create policy doc_select on documents for select
  using (created_by = auth.uid());
create policy doc_insert on documents for insert
  with check (created_by = auth.uid());
create policy doc_update on documents for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy doc_delete on documents for delete
  using (created_by = auth.uid());

-- ── recipients / fields / events : 부모 문서 소유자만 ─────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['recipients','fields','events'] loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$create policy %1$s_select on %1$I for select
        using (app.owns_document(document_id));$f$, t);
    execute format($f$create policy %1$s_insert on %1$I for insert
        with check (app.owns_document(document_id));$f$, t);
    execute format($f$create policy %1$s_update on %1$I for update
        using (app.owns_document(document_id)) with check (app.owns_document(document_id));$f$, t);
    execute format($f$create policy %1$s_delete on %1$I for delete
        using (app.owns_document(document_id));$f$, t);
  end loop;
end $$;

-- ── api_keys : 서비스 롤 전용 (정책 없음 → 클라이언트 접근 차단) ────────────────────
alter table api_keys enable row level security;

-- ── Storage : private 버킷. 서버(admin)에서만 접근하므로 정책 없음. ─────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
