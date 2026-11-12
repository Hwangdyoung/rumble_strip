-- 009: 역할별 접근 제한 (2026-11-12)
-- 상담원(의료인 아님)은 연락 업무에 필요한 정보만 본다. 플레이 원본(정확도·반응 속도·세션 시간), 위험 점수 기록,
-- 알림(문구에 정확도 등 수치가 들어감)은 DB에서 읽지 못하게 막는다.
-- 상담원 화면은 서버 함수(src/lib/counselor-view.server.ts)가 단계·접속 관련 이유·접속한 날짜만 골라서 보낸다.
-- 역할은 관리자만 바꾼다(본인이 바꾸면 차등이 의미 없음). 새로 가입한 사람은 '상담원'으로 시작한다.
-- 기존 데이터는 지우지 않는다.
--
-- 실행 순서: 이 SQL은 화면 코드(상담원 분기)를 배포한 뒤에 실행한다.
-- 실행 후 003_staff_rls_test.sql을 다시 돌려 확인한다.

-- 1) 판단 함수
-- 의료진 정보(점수·플레이 원본·알림)를 볼 수 있는 사람: 관리자, 의사, 간호사
create or replace function public.is_clinician()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and (is_admin or role in ('의사', '간호사')));
$$;

-- 내 역할 (자기 역할을 바꾸지 못하게 비교하는 데 씀)
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.staff where id = auth.uid();
$$;

revoke all on function public.is_clinician() from public;
revoke all on function public.my_role() from public;
grant execute on function public.is_clinician() to authenticated;
grant execute on function public.my_role() to authenticated;

-- 2) 의료진 정보: 담당 환자이면서 의료진(관리자·의사·간호사)일 때만
drop policy if exists "play_logs_select" on public.play_logs;
create policy "play_logs_select" on public.play_logs for select to authenticated
  using (public.can_see_patient(patient_id) and public.is_clinician());

drop policy if exists "risk_scores_select" on public.risk_scores;
drop policy if exists "risk_scores_insert" on public.risk_scores;
create policy "risk_scores_select" on public.risk_scores for select to authenticated
  using (public.can_see_patient(patient_id) and public.is_clinician());
create policy "risk_scores_insert" on public.risk_scores for insert to authenticated
  with check (public.can_see_patient(patient_id) and public.is_clinician());

drop policy if exists "alerts_select" on public.alerts;
drop policy if exists "alerts_insert" on public.alerts;
drop policy if exists "alerts_update" on public.alerts;
create policy "alerts_select" on public.alerts for select to authenticated
  using (public.can_see_patient(patient_id) and public.is_clinician());
create policy "alerts_insert" on public.alerts for insert to authenticated
  with check (public.can_see_patient(patient_id) and public.is_clinician());
create policy "alerts_update" on public.alerts for update to authenticated
  using (public.can_see_patient(patient_id) and public.is_clinician())
  with check (public.can_see_patient(patient_id) and public.is_clinician());

-- 3) 역할은 관리자만 바꾼다
--    본인 정보 만들기: 관리자 아님 + 역할은 '상담원'으로만 (관리자가 나중에 정함)
--    본인 정보 고치기: 관리자 여부·역할은 그대로여야 함 (이름만 고침)
drop policy if exists "staff_insert_self" on public.staff;
drop policy if exists "staff_update_self" on public.staff;
create policy "staff_insert_self" on public.staff for insert to authenticated
  with check (id = auth.uid() and is_admin = false and role = '상담원');
create policy "staff_update_self" on public.staff for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_admin = public.is_admin() and role = public.my_role());
-- (관리자 정책 staff_update_admin은 그대로: 관리자는 누구의 역할이든 바꿀 수 있다)

-- 4) 알림을 직접 읽지 못하는 상담원도 할 수 있어야 하는 일은 함수로 처리한다
--    (그 환자의 담당자인지 함수가 확인한다. 의료진도 같은 함수를 써도 된다)

-- 4-1) 연락 기록: 조치를 남기고, 처리 안 된 알림을 '조치완료'로 바꾼다. 연결한 알림 id를 돌려준다.
create or replace function public.record_contact(pid uuid, kind text, memo text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  latest uuid;
begin
  if me is null or not exists (select 1 from public.staff where id = me) then
    raise exception '의료진 정보가 없습니다.' using errcode = '42501';
  end if;
  if not public.can_see_patient(pid) then
    raise exception '볼 수 없는 환자입니다.' using errcode = '42501';
  end if;
  if kind not in ('전화 상담', '문자', '기타') then
    raise exception '연락 방법이 올바르지 않습니다.' using errcode = '22023';
  end if;
  select id into latest from public.alerts
  where patient_id = pid and status <> '조치완료' order by created_at desc limit 1;
  insert into public.actions (patient_id, action_type, memo, staff_id, alert_id)
  values (pid, kind, coalesce(memo, ''), me, latest);
  update public.alerts set status = '조치완료', resolved_at = now()
  where patient_id = pid and status <> '조치완료';
  return latest;
end $$;

-- 4-2) 알림을 봤음으로 표시 ('미확인' → '확인')
create or replace function public.mark_alert_seen(aid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select patient_id into pid from public.alerts where id = aid;
  if pid is null or not public.can_see_patient(pid) then
    raise exception '볼 수 없는 알림입니다.' using errcode = '42501';
  end if;
  update public.alerts set status = '확인' where id = aid and status = '미확인';
end $$;

-- 4-3) 알림 결과 중 '미정'·'연락 불가'만 기록 (회복·이탈 판정은 의료진이 한다)
--      이미 의료진이 회복·이탈로 기록한 알림은 바꾸지 않는다.
create or replace function public.set_contact_outcome(aid uuid, outcome text, note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  cur text;
begin
  select a.patient_id, a.outcome into pid, cur from public.alerts a where a.id = aid;
  if pid is null or not public.can_see_patient(pid) then
    raise exception '볼 수 없는 알림입니다.' using errcode = '42501';
  end if;
  if set_contact_outcome.outcome not in ('미정', '연락 불가') then
    raise exception '이 결과는 의료진만 기록할 수 있습니다.' using errcode = '42501';
  end if;
  if cur not in ('미정', '연락 불가') and not public.is_clinician() then
    raise exception '의료진이 기록한 결과는 바꿀 수 없습니다.' using errcode = '42501';
  end if;
  update public.alerts a set
    outcome = set_contact_outcome.outcome,
    outcome_at = case when set_contact_outcome.outcome = '미정' then null else now() end,
    outcome_note = case when note is null then a.outcome_note when btrim(note) = '' then null else left(btrim(note), 500) end
  where a.id = aid;
end $$;

revoke all on function public.record_contact(uuid, text, text) from public;
revoke all on function public.mark_alert_seen(uuid) from public;
revoke all on function public.set_contact_outcome(uuid, text, text) from public;
grant execute on function public.record_contact(uuid, text, text) to authenticated;
grant execute on function public.mark_alert_seen(uuid) to authenticated;
grant execute on function public.set_contact_outcome(uuid, text, text) to authenticated;

-- 확인: 함수 5개가 나오면 성공
select proname from pg_proc
where proname in ('is_clinician', 'my_role', 'record_contact', 'mark_alert_seen', 'set_contact_outcome')
order by proname;
