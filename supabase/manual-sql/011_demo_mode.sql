-- 011: '로그인 없이 둘러보기'(전시회에서 방문자가 앱을 써 보는 용도) (2026-11-13)
-- 로그인 화면의 '의사로 / 간호사로 / 상담원으로 둘러보기'는 둘러보기 계정(staff.is_demo)으로 비밀번호 없이 들어간다
-- (서버 함수 src/lib/demo.server.ts, Vercel 환경 변수 DEMO_MODE=on일 때만).
-- 방문자가 남긴 기록은 관리자가 저장해 둔 '시연 기준'으로 통째로 되돌린다.
--
-- 되돌리는 것: 연락 기록(actions), 넘긴 기록(alert_handoffs), 다음 연락 일정(follow_ups), 담당 연결과 연락 담당(patient_staff),
--             알림의 상태·결과·담당(alerts의 status, outcome, outcome_at, outcome_note, assignee_id, assigned_at, resolved_at)
-- 그대로 두는 것: 환자, 플레이 기록, 위험 점수 기록, 의료진 계정, 알림 자체(기준 저장 뒤 새로 생긴 알림은 '미확인·미정'으로 되돌림)
-- 주의: 둘러보기 계정이 바꾼 것만이 아니라, 기준 저장 뒤에 바뀐 위 항목은 누가 바꿨든 모두 되돌아간다.
-- 실행 순서: 이 SQL을 먼저 실행한 뒤 코드를 배포한다(먼저 배포하면 둘러보기 계정 표시·되돌리기가 실패한다).

-- 1) 둘러보기 계정 표시 (관리자만 바꿈: 기존 정책 staff_update_admin)
alter table public.staff add column if not exists is_demo boolean not null default false;

-- 둘러보기 계정은 자기 정보를 고칠 수 없다(다음 방문자에게 바뀐 이름이 보이지 않게).
-- 일반 의료진은 지금처럼 이름만 고치고, is_demo는 스스로 켜거나 끌 수 없다.
create or replace function public.is_demo_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_demo from public.staff where id = auth.uid()), false)
$$;
revoke all on function public.is_demo_staff() from public;
grant execute on function public.is_demo_staff() to authenticated;

drop policy if exists "staff_update_self" on public.staff;
create policy "staff_update_self" on public.staff for update to authenticated
  using (id = auth.uid() and not public.is_demo_staff())
  with check (id = auth.uid() and is_admin = public.is_admin() and role = public.my_role() and is_demo = false);

-- 2) 시연 기준 (한 줄만 쓴다). 관리자만 읽는다. 쓰기는 아래 함수로만.
create table if not exists public.demo_baseline (
  id int primary key default 1 check (id = 1),
  saved_at timestamptz not null default now(),
  saved_by uuid references public.staff(id) on delete set null,
  data jsonb not null,
  reset_at timestamptz
);
alter table public.demo_baseline enable row level security;
revoke all on public.demo_baseline from anon, authenticated;
grant select (id, saved_at, saved_by, reset_at) on public.demo_baseline to authenticated;
drop policy if exists demo_baseline_admin_read on public.demo_baseline;
create policy demo_baseline_admin_read on public.demo_baseline for select to authenticated using (public.is_admin());

-- 같은 이름의 함수가 이미 있으면 반환 형식이 달라 바꿀 수 없으므로 먼저 지운다(2026-11-13, 처음 실행 때 42P13 오류).
-- 이 두 함수에 기대는 정책·다른 함수는 없어서 지워도 된다.
drop function if exists public.save_demo_baseline();
drop function if exists public.reset_demo_data();

-- 3) 지금 상태를 시연 기준으로 저장 (관리자)
create or replace function public.save_demo_baseline()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare t timestamptz := now();
begin
  if not public.is_admin() then
    raise exception '관리자만 시연 기준을 저장할 수 있습니다.' using errcode = '42501';
  end if;
  insert into public.demo_baseline (id, saved_at, saved_by, data, reset_at)
  values (1, t, auth.uid(), jsonb_build_object(
    'actions', coalesce((select jsonb_agg(to_jsonb(a)) from public.actions a), '[]'::jsonb),
    'alert_handoffs', coalesce((select jsonb_agg(to_jsonb(h)) from public.alert_handoffs h), '[]'::jsonb),
    'follow_ups', coalesce((select jsonb_agg(to_jsonb(f)) from public.follow_ups f), '[]'::jsonb),
    'patient_staff', coalesce((select jsonb_agg(to_jsonb(ps)) from public.patient_staff ps), '[]'::jsonb),
    'alerts', coalesce((select jsonb_agg(jsonb_build_object(
      'id', al.id, 'status', al.status, 'outcome', al.outcome, 'outcome_at', al.outcome_at, 'outcome_note', al.outcome_note,
      'assignee_id', al.assignee_id, 'assigned_at', al.assigned_at, 'resolved_at', al.resolved_at)) from public.alerts al), '[]'::jsonb)
  ), null)
  on conflict (id) do update set saved_at = excluded.saved_at, saved_by = excluded.saved_by, data = excluded.data, reset_at = null;
  return t;
end $$;

-- 4) 시연 기준으로 되돌리기 (관리자, 또는 서버의 service role: Vercel Cron)
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

  -- where true: Supabase의 '조건 없는 delete 막기'에 걸리지 않게
  delete from public.actions where true;
  delete from public.alert_handoffs where true;
  delete from public.follow_ups where true;
  delete from public.patient_staff where true;

  -- 담당 연결 (그사이 지워진 환자·의료진은 건너뜀)
  insert into public.patient_staff
  select r.* from jsonb_populate_recordset(null::public.patient_staff, d->'patient_staff') r
  where exists (select 1 from public.patients p where p.id = r.patient_id)
    and exists (select 1 from public.staff s where s.id = r.staff_id);

  -- 알림: 기준에 있던 알림은 그때 상태로, 기준 뒤에 생긴 알림은 '미확인·미정'으로, 담당은 지금 연락 담당
  update public.alerts al set
    status = b.status, outcome = b.outcome, outcome_at = b.outcome_at, outcome_note = b.outcome_note,
    assignee_id = case when exists (select 1 from public.staff s where s.id = b.assignee_id) then b.assignee_id end,
    assigned_at = b.assigned_at, resolved_at = b.resolved_at
  from jsonb_to_recordset(d->'alerts') as b(id uuid, status text, outcome text, outcome_at timestamptz, outcome_note text,
                                            assignee_id uuid, assigned_at timestamptz, resolved_at timestamptz)
  where al.id = b.id;
  update public.alerts al set
    status = '미확인', outcome = '미정', outcome_at = null, outcome_note = null, resolved_at = null,
    assignee_id = (select ps.staff_id from public.patient_staff ps where ps.patient_id = al.patient_id and ps.is_contact limit 1),
    assigned_at = now()
  where not exists (select 1 from jsonb_array_elements(d->'alerts') e where (e->>'id')::uuid = al.id);

  insert into public.actions
  select r.* from jsonb_populate_recordset(null::public.actions, d->'actions') r
  where exists (select 1 from public.patients p where p.id = r.patient_id)
    and exists (select 1 from public.staff s where s.id = r.staff_id);
  insert into public.alert_handoffs
  select r.* from jsonb_populate_recordset(null::public.alert_handoffs, d->'alert_handoffs') r
  where exists (select 1 from public.patients p where p.id = r.patient_id)
    and exists (select 1 from public.staff s where s.id = r.to_staff);
  insert into public.follow_ups
  select r.* from jsonb_populate_recordset(null::public.follow_ups, d->'follow_ups') r
  where exists (select 1 from public.patients p where p.id = r.patient_id);

  update public.demo_baseline set reset_at = now() where id = 1;
  return '되돌렸습니다.';
end $$;

revoke all on function public.save_demo_baseline() from public;
revoke all on function public.reset_demo_data() from public;
grant execute on function public.save_demo_baseline() to authenticated;
grant execute on function public.reset_demo_data() to authenticated, service_role;

-- 확인: 'is_demo' 한 줄과 함수 세 개가 나오면 됩니다.
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'staff' and column_name = 'is_demo';
select proname from pg_proc where proname in ('is_demo_staff', 'save_demo_baseline', 'reset_demo_data') order by proname;
