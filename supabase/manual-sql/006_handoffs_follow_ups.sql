-- 006: 알림 넘긴 기록, 다음 연락 일정 (2026-11-12)
-- Supabase SQL Editor에서 한 번 실행한다. 기존 데이터는 지우지 않는다.

-- 1) 알림 넘긴 기록 (인계, 의사 확인 요청). 기록 보존을 위해 수정·삭제 정책은 두지 않는다.
create table if not exists public.alert_handoffs (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  from_staff uuid references public.staff(id) on delete set null default auth.uid(),
  to_staff uuid not null references public.staff(id) on delete cascade,
  reason text not null check (reason in ('인계', '의사 확인 요청', '기타')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists alert_handoffs_alert_idx on public.alert_handoffs (alert_id, created_at);

-- 2) 다음 연락 일정
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  alert_id uuid references public.alerts(id) on delete set null,
  due_date date not null,
  assignee_id uuid references public.staff(id) on delete set null,
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists follow_ups_open_idx on public.follow_ups (due_date) where done_at is null;
create index if not exists follow_ups_patient_idx on public.follow_ups (patient_id);

-- 3) 권한
grant select, insert on public.alert_handoffs to authenticated;
grant select, insert, update, delete on public.follow_ups to authenticated;
grant all on public.alert_handoffs, public.follow_ups to service_role;
alter table public.alert_handoffs enable row level security;
alter table public.follow_ups enable row level security;

drop policy if exists "alert_handoffs_select" on public.alert_handoffs;
drop policy if exists "alert_handoffs_insert" on public.alert_handoffs;
drop policy if exists "follow_ups_select" on public.follow_ups;
drop policy if exists "follow_ups_insert" on public.follow_ups;
drop policy if exists "follow_ups_update" on public.follow_ups;
drop policy if exists "follow_ups_delete_admin" on public.follow_ups;

-- 넘긴 기록: 그 환자를 볼 수 있는 사람만 읽기. 자기 이름으로만, 그 환자의 알림에만 추가.
create policy "alert_handoffs_select" on public.alert_handoffs for select to authenticated
  using (public.can_see_patient(patient_id));
create policy "alert_handoffs_insert" on public.alert_handoffs for insert to authenticated
  with check (
    public.can_see_patient(patient_id)
    and from_staff = auth.uid()
    and exists (select 1 from public.alerts a where a.id = alert_id and a.patient_id = alert_handoffs.patient_id)
  );

-- 다음 연락 일정: 그 환자를 볼 수 있는 사람이 읽기·추가·완료 처리, 삭제는 관리자
create policy "follow_ups_select" on public.follow_ups for select to authenticated using (public.can_see_patient(patient_id));
create policy "follow_ups_insert" on public.follow_ups for insert to authenticated with check (public.can_see_patient(patient_id));
create policy "follow_ups_update" on public.follow_ups for update to authenticated
  using (public.can_see_patient(patient_id)) with check (public.can_see_patient(patient_id));
create policy "follow_ups_delete_admin" on public.follow_ups for delete to authenticated using (public.is_admin());

-- 확인: 두 테이블이 나오면 성공
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('alert_handoffs', 'follow_ups')
order by table_name;
