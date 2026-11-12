-- 008: 담당자별 업무량 (2026-11-12)
-- 4차 페르소나 평가에서 "누구에게 넘길지 판단할 수 없다"(재배치 때 담당자별 남은 건수가 빠짐)는 의견에 따라 추가.
-- 일반 의료진은 RLS 때문에 자기 담당 환자만 보이므로, 화면에서 세면 동료의 숫자가 적게 나온다.
-- 그래서 사람별 '건수만' 돌려주는 함수를 둔다. 환자 이름·id 등 환자 정보는 돌려주지 않는다.
-- 테이블·데이터는 바꾸지 않는다.
--
-- 숫자는 모두 '연락 담당'(patient_staff.is_contact) 기준이며, 환자 수로 센다.
--   patients     : 연락 담당인 환자 수
--   new_worse    : 그중 처리 안 된 알림(status <> '조치완료')이 있는 환자 수 (화면의 '새로 나빠짐'과 같은 기준)
--   follow_due   : 그중 오늘(한국 날짜)까지인 열린 다음 연락이 있는 환자 수 (지난 것 포함)
--   todo         : new_worse 또는 follow_due에 해당하는 환자 수 (겹치면 한 번)
-- 위험 점수 기준의 '오늘 연락' 수는 점수를 화면(risk.ts)에서만 계산하므로 여기서 세지 않는다.

create or replace function public.staff_workload()
returns table (staff_id uuid, staff_name text, staff_role text, patients int, new_worse int, follow_due int, todo int)
language sql stable security definer set search_path = public as $$
  with mine as (
    select ps.staff_id, ps.patient_id,
      exists (select 1 from public.alerts a where a.patient_id = ps.patient_id and a.status <> '조치완료') as is_new,
      exists (
        select 1 from public.follow_ups f
        where f.patient_id = ps.patient_id and f.done_at is null
          and f.due_date <= (now() at time zone 'Asia/Seoul')::date
      ) as is_due
    from public.patient_staff ps
    where ps.is_contact
  )
  select s.id, s.name, s.role,
    count(m.patient_id)::int,
    count(m.patient_id) filter (where m.is_new)::int,
    count(m.patient_id) filter (where m.is_due)::int,
    count(m.patient_id) filter (where m.is_new or m.is_due)::int
  from public.staff s
  left join mine m on m.staff_id = s.id
  -- 의료진으로 등록된 사람만 결과를 받는다 (등록 안 된 계정은 빈 결과)
  where exists (select 1 from public.staff me where me.id = auth.uid())
  group by s.id, s.name, s.role
  order by s.name;
$$;

revoke all on function public.staff_workload() from public;
grant execute on function public.staff_workload() to authenticated;

-- 확인: 의료진마다 한 줄씩 숫자가 나오면 성공 (SQL Editor는 로그인 사용자가 아니라서 여기서는 빈 결과가 정상)
select proname from pg_proc where proname = 'staff_workload';
