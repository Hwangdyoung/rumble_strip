-- 010: 처음 설정 코드 (2026-11-12)
-- 관리자가 계정을 만들 때 비밀번호 대신 '처음 설정 코드'를 건네고, 본인이 그 코드로 직접 비밀번호를 만든다.
-- 관리자는 남의 비밀번호를 알 수 없다. 코드를 다시 만들면 비밀번호 재설정에도 쓴다.
--
-- - 코드는 원문이 아니라 해시(code_hash)만 저장한다. 원문은 만들 때 관리자 화면에 한 번만 보인다.
-- - 코드 확인·비밀번호 설정·줄 추가/수정은 서버 함수(service role)만 한다. 화면(로그인 사용자)은 쓰기 권한이 없다.
-- - 관리자는 '설정 대기' 표시를 위해 code_hash를 뺀 열만 읽는다(열 단위 권한 + RLS).
-- - 줄이 없거나 used_at이 있으면 설정을 마친 계정이다(010 이전에 만든 계정은 줄이 없다).
-- 실행 순서: 이 SQL을 먼저 실행한 뒤 코드를 배포한다(먼저 배포하면 그사이 계정 만들기가 실패한다).

create table if not exists public.staff_invites (
  staff_id uuid primary key references public.staff(id) on delete cascade,
  login_id text not null unique,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts int not null default 0,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.staff_invites enable row level security;

revoke all on public.staff_invites from anon, authenticated;
grant select (staff_id, login_id, expires_at, used_at, attempts, created_at) on public.staff_invites to authenticated;

drop policy if exists staff_invites_admin_read on public.staff_invites;
create policy staff_invites_admin_read on public.staff_invites
  for select to authenticated using (public.is_admin());

-- 확인: 아래가 표 하나(열 8개)로 나오면 됩니다.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'staff_invites' order by ordinal_position;
