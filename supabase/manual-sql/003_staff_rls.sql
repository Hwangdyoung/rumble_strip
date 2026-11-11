-- 003: 의료진 계정과 담당 환자 접근 제한 (2026-11-11)
-- Supabase SQL Editor에서 한 번 실행한다. 기존 데이터는 지우지 않는다.
-- 되돌리기: 003_staff_rls_rollback.sql

-- 1) 의료진 정보 (로그인 계정 1개당 1줄)
create table if not exists public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  role text not null check (role in ('의사', '간호사', '상담원')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2) 환자-담당자 연결 (한 환자에 여러 명)
create table if not exists public.patient_staff (
  patient_id uuid not null references public.patients(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patient_id, staff_id)
);
create index if not exists patient_staff_staff_idx on public.patient_staff (staff_id);

-- 3) 판단 함수 (정책 안에서 같은 테이블을 다시 읽어 생기는 무한 반복을 피하려고 security definer로 둔다)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and is_admin);
$$;

create or replace function public.can_see_patient(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.patient_staff where patient_id = pid and staff_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.can_see_patient(uuid) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_see_patient(uuid) to authenticated;

-- 4) 권한
grant select, insert, update on public.staff to authenticated;
grant select, insert, delete on public.patient_staff to authenticated;
grant all on public.staff, public.patient_staff to service_role;
alter table public.staff enable row level security;
alter table public.patient_staff enable row level security;

-- 5) 기존 정책 모두 삭제 (원래는 '로그인하면 전부 허용')
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('patients', 'play_logs', 'risk_scores', 'alerts', 'actions', 'staff', 'patient_staff')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 6) 새 정책
-- 의료진: 모두 읽기(담당자 이름 표시용). 자기 정보만 만들고 고침. 관리자 권한은 스스로 켤 수 없음.
create policy "staff_select" on public.staff for select to authenticated using (true);
create policy "staff_insert_self" on public.staff for insert to authenticated
  with check (id = auth.uid() and is_admin = false);
create policy "staff_update_self" on public.staff for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and is_admin = public.is_admin());
create policy "staff_update_admin" on public.staff for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 담당 연결: 관리자 또는 같은 환자 담당자가 읽기, 관리자만 추가·삭제
create policy "patient_staff_select" on public.patient_staff for select to authenticated
  using (public.can_see_patient(patient_id));
create policy "patient_staff_insert_admin" on public.patient_staff for insert to authenticated
  with check (public.is_admin());
create policy "patient_staff_delete_admin" on public.patient_staff for delete to authenticated
  using (public.is_admin());

-- 환자: 관리자·담당자 읽기, 관리자만 쓰기
create policy "patients_select" on public.patients for select to authenticated using (public.can_see_patient(id));
create policy "patients_insert_admin" on public.patients for insert to authenticated with check (public.is_admin());
create policy "patients_update_admin" on public.patients for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "patients_delete_admin" on public.patients for delete to authenticated using (public.is_admin());

-- 플레이 기록: 관리자·담당자 읽기, 관리자만 쓰기 (게임 연동 시에는 서버 관리자 키로 씀)
create policy "play_logs_select" on public.play_logs for select to authenticated using (public.can_see_patient(patient_id));
create policy "play_logs_insert_admin" on public.play_logs for insert to authenticated with check (public.is_admin());
create policy "play_logs_update_admin" on public.play_logs for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "play_logs_delete_admin" on public.play_logs for delete to authenticated using (public.is_admin());

-- 위험 점수: 담당자도 추가 가능(대시보드 매일 점검), 수정·삭제는 관리자
create policy "risk_scores_select" on public.risk_scores for select to authenticated using (public.can_see_patient(patient_id));
create policy "risk_scores_insert" on public.risk_scores for insert to authenticated with check (public.can_see_patient(patient_id));
create policy "risk_scores_update_admin" on public.risk_scores for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "risk_scores_delete_admin" on public.risk_scores for delete to authenticated using (public.is_admin());

-- 알림: 담당자가 읽기·추가·상태와 결과 기록, 삭제는 관리자
create policy "alerts_select" on public.alerts for select to authenticated using (public.can_see_patient(patient_id));
create policy "alerts_insert" on public.alerts for insert to authenticated with check (public.can_see_patient(patient_id));
create policy "alerts_update" on public.alerts for update to authenticated
  using (public.can_see_patient(patient_id)) with check (public.can_see_patient(patient_id));
create policy "alerts_delete_admin" on public.alerts for delete to authenticated using (public.is_admin());

-- 조치: 담당자가 읽기, 자기 이름으로만 기록, 수정·삭제는 본인 또는 관리자
create policy "actions_select" on public.actions for select to authenticated using (public.can_see_patient(patient_id));
create policy "actions_insert_self" on public.actions for insert to authenticated
  with check (public.can_see_patient(patient_id) and staff_id = auth.uid());
create policy "actions_update_own" on public.actions for update to authenticated
  using (staff_id = auth.uid() or public.is_admin()) with check (public.can_see_patient(patient_id));
create policy "actions_delete_own" on public.actions for delete to authenticated
  using (staff_id = auth.uid() or public.is_admin());

-- 7) 첫 관리자 지정: 아래 이메일을 지금 쓰는 계정으로 바꿔서 실행
insert into public.staff (id, name, role, is_admin)
select id, '관리자', '의사', true from auth.users where email = 'asd@asd.com'
on conflict (id) do update set is_admin = true;

-- 확인: 관리자 1명이 나오면 성공
select s.name, s.role, s.is_admin, u.email
from public.staff s join auth.users u on u.id = s.id;
