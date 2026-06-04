-- =============================================================================
-- 사인사인 — 데모 시드
-- 외부 앱 연동 데모용 API 키 2개. 해시는 pgcrypto digest(sha256)로 계산하므로
-- 앱의 sha256(hex) 해싱과 동일하게 매칭된다.
-- =============================================================================

insert into api_keys (label, source_app, key_hash, prefix)
values
  ('FM OS (demo)',   'fm_os',
   encode(digest('sk_demo_fmos_000000000000000000000000', 'sha256'), 'hex'),
   'sk_demo_fmos_'),
  ('MomoCare (demo)','momocare',
   encode(digest('sk_demo_momo_000000000000000000000000', 'sha256'), 'hex'),
   'sk_demo_momo_')
on conflict (key_hash) do nothing;
