-- 012: 환자용 게임(/play)에서 만든 환자와 플레이 기록 저장 (2026-11-17)
-- 조원이 만든 게임 화면을 가져와, 방문자가 별명·나이·아이디·숫자 4자리로 환자를 만들고 플레이 기록을 play_logs에 저장한다.
-- 저장은 서버 함수(src/lib/game-account.server.ts, service role)만 한다. 로그인 안 한 사람(anon)에게 권한을 열지 않는다.
-- 게임으로 만든 환자는 관리자에게만 보이고(담당 미배정), 관리자가 담당 관리에서 배정한다(기존 RLS 그대로).
-- '로그인 없이 둘러보기'의 되돌리기(reset_demo_data)는 게임 환자를 건드리지 않게 바꾼다.
-- 실행 순서: 이 SQL을 먼저 실행한 뒤 코드를 배포한다.

-- 1) 환자 출처: 기존 환자 'staff', 게임에서 만든 환자 'game'
alter table public.patients add column if not exists source text not null default 'staff';
alter table public.patients drop constraint if exists patients_source_check;
alter table public.patients add constraint patients_source_check check (source in ('staff', 'game'));

-- 2) 게임 계정: 아이디·숫자 4자리(해시)·접속 표시(해시). 화면(anon·authenticated)은 아무도 읽거나 쓰지 못한다.
create table if not exists public.game_accounts (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  login_id text not null unique,
  pin_hash text not null,
  attempts int not null default 0,
  session_hash text,
  session_expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.game_accounts enable row level security;
revoke all on public.game_accounts from anon, authenticated;

-- 3) 되돌리기: 게임 환자의 담당 연결·연락 기록·넘긴 기록·다음 연락·알림은 그대로 두고, 나머지 환자만 시연 기준으로 돌린다
create or replace function public.reset_demo_data()
returns text language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception '관리자만 시연 데이터를 되돌릴 수 있습니다.' using errcode = '42501';
  end if;
  select data into d from public.demo_baseline where id = 1;
  if d is null then
    return '저장된 시연 기준이 없습니다.';
  end if;

  -- 되돌릴 환자 = 게임 환자가 아닌 환자 (source <> 'game')
  delete from public.actions where patient_id in (select id from public.patients where source <> 'game');
  delete from public.alert_handoffs where patient_id in (select id from public.patients where source <> 'game');
  delete from public.follow_ups where patient_id in (select id from public.patients where source <> 'game');
  delete from public.patient_staff where patient_id in (select id from public.patients where source <> 'game');

  insert into public.patient_staff
  select r.* from jsonb_populate_recordset(null::public.patient_staff, d->'patient_staff') r
  where r.patient_id in (select id from public.patients where source <> 'game')
    and exists (select 1 from public.staff s where s.id = r.staff_id);

  update public.alerts al set
    status = b.status, outcome = b.outcome, outcome_at = b.outcome_at, outcome_note = b.outcome_note,
    assignee_id = case when exists (select 1 from public.staff s where s.id = b.assignee_id) then b.assignee_id end,
    assigned_at = b.assigned_at, resolved_at = b.resolved_at
  from jsonb_to_recordset(d->'alerts') as b(id uuid, status text, outcome text, outcome_at timestamptz, outcome_note text,
                                            assignee_id uuid, assigned_at timestamptz, resolved_at timestamptz)
  where al.id = b.id and al.patient_id in (select id from public.patients where source <> 'game');
  update public.alerts al set
    status = '미확인', outcome = '미정', outcome_at = null, outcome_note = null, resolved_at = null,
    assignee_id = (select ps.staff_id from public.patient_staff ps where ps.patient_id = al.patient_id and ps.is_contact limit 1),
    assigned_at = now()
  where al.patient_id in (select id from public.patients where source <> 'game')
    and not exists (select 1 from jsonb_array_elements(d->'alerts') e where (e->>'id')::uuid = al.id);

  insert into public.actions
  select r.* from jsonb_populate_recordset(null::public.actions, d->'actions') r
  where r.patient_id in (select id from public.patients where source <> 'game')
    and exists (select 1 from public.staff s where s.id = r.staff_id);
  insert into public.alert_handoffs
  select r.* from jsonb_populate_recordset(null::public.alert_handoffs, d->'alert_handoffs') r
  where r.patient_id in (select id from public.patients where source <> 'game')
    and exists (select 1 from public.staff s where s.id = r.to_staff);
  insert into public.follow_ups
  select r.* from jsonb_populate_recordset(null::public.follow_ups, d->'follow_ups') r
  where r.patient_id in (select id from public.patients where source <> 'game');

  update public.demo_baseline set reset_at = now() where id = 1;
  return '되돌렸습니다.';
end $$;
revoke all on function public.reset_demo_data() from public;
grant execute on function public.reset_demo_data() to authenticated, service_role;

-- 확인: 첫 표에 source 한 줄, 둘째 표에 game_accounts 열 7개가 나오면 됩니다.
select column_name, column_default from information_schema.columns
where table_schema = 'public' and table_name = 'patients' and column_name = 'source';
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'game_accounts' order by ordinal_position;
