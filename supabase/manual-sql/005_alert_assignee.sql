-- 005: 알림 담당자, 처리 완료 시각, 환자별 연락 담당 (2026-11-12)
-- Supabase SQL Editor에서 한 번 실행한다. 기존 데이터는 지우지 않는다.

-- 알림 담당자, 배정 시각, 처리 완료 시각
alter table public.alerts
  add column if not exists assignee_id uuid references public.staff(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists resolved_at timestamptz;

-- 이미 조치완료인 알림은 처리 시각을 알 수 없어서 생성 시각으로 채운다
update public.alerts set resolved_at = created_at
where status = '조치완료' and resolved_at is null;

-- 환자별 연락 담당 (환자당 1명). 매일 점검이 만든 알림은 연락 담당에게 자동 배정된다.
alter table public.patient_staff
  add column if not exists is_contact boolean not null default false;
create unique index if not exists patient_staff_one_contact
  on public.patient_staff (patient_id) where is_contact;

-- 연락 담당 지정은 관리자만
grant update on public.patient_staff to authenticated;
drop policy if exists "patient_staff_update_admin" on public.patient_staff;
create policy "patient_staff_update_admin" on public.patient_staff for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 확인: 새 컬럼 4개가 나오면 성공
select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'alerts' and column_name in ('assignee_id', 'assigned_at', 'resolved_at'))
    or (table_name = 'patient_staff' and column_name = 'is_contact'))
order by table_name, column_name;
