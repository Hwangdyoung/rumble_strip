-- 007: 환자 단위 '내가 맡기'와 '넘기기' (2026-11-12)
-- 화면 재배치에서 담당을 '환자의 연락 담당' 하나로 합쳤다. 일반 의료진은 patient_staff를 직접 고칠 수 없으므로
-- 규칙을 확인한 뒤 바꾸는 함수 두 개를 둔다. 기존 데이터는 지우지 않는다.

-- 넘긴 기록은 알림이 없는 환자에도 남길 수 있게 한다
alter table public.alert_handoffs alter column alert_id drop not null;

-- 1) 내가 맡기: 이 환자의 연락 담당을 나로 바꾸고, 처리 안 된 알림도 나에게 배정
--    볼 수 있는 환자만 가능. 관리자가 아직 담당자가 아니면 담당자로 추가한다.
create or replace function public.take_patient(pid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from public.staff where id = me) then
    raise exception '의료진 정보가 없습니다.' using errcode = '42501';
  end if;
  if not public.can_see_patient(pid) then
    raise exception '볼 수 없는 환자입니다.' using errcode = '42501';
  end if;
  insert into public.patient_staff (patient_id, staff_id) values (pid, me) on conflict do nothing;
  update public.patient_staff set is_contact = false where patient_id = pid and is_contact and staff_id <> me;
  update public.patient_staff set is_contact = true where patient_id = pid and staff_id = me;
  update public.alerts set assignee_id = me, assigned_at = now() where patient_id = pid and status <> '조치완료';
end $$;

-- 2) 넘기기: 이 환자의 연락 담당을 다른 담당자에게 넘기고 기록을 남긴다
--    받는 사람은 그 환자의 담당자여야 한다.
create or replace function public.handoff_patient(pid uuid, to_staff uuid, reason text, note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  latest_alert uuid;
begin
  if me is null or not exists (select 1 from public.staff where id = me) then
    raise exception '의료진 정보가 없습니다.' using errcode = '42501';
  end if;
  if not public.can_see_patient(pid) then
    raise exception '볼 수 없는 환자입니다.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.patient_staff where patient_id = pid and staff_id = to_staff) then
    raise exception '받는 사람이 이 환자의 담당자가 아닙니다.' using errcode = '22023';
  end if;
  if reason not in ('인계', '의사 확인 요청', '기타') then
    raise exception '이유가 올바르지 않습니다.' using errcode = '22023';
  end if;

  update public.patient_staff set is_contact = false where patient_id = pid and is_contact;
  update public.patient_staff set is_contact = true where patient_id = pid and staff_id = to_staff;
  update public.alerts set assignee_id = to_staff, assigned_at = now() where patient_id = pid and status <> '조치완료';

  select id into latest_alert from public.alerts
  where patient_id = pid and status <> '조치완료' order by created_at desc limit 1;
  insert into public.alert_handoffs (alert_id, patient_id, from_staff, to_staff, reason, note)
  values (latest_alert, pid, me, to_staff, reason, left(coalesce(note, ''), 500));
end $$;

revoke all on function public.take_patient(uuid) from public;
revoke all on function public.handoff_patient(uuid, uuid, text, text) from public;
grant execute on function public.take_patient(uuid) to authenticated;
grant execute on function public.handoff_patient(uuid, uuid, text, text) to authenticated;

-- 확인: 함수 두 개가 나오면 성공
select proname from pg_proc where proname in ('take_patient', 'handoff_patient') order by proname;
