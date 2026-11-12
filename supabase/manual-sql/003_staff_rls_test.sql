-- 003 확인용: 담당 환자 접근 제한이 맞게 동작하는지 시험한다.
-- 시험 중 바꾼 것(관리자 권한 해제, 담당 연결)은 끝에서 모두 자동으로 되돌린다. 실제 데이터는 바뀌지 않는다.
-- 결과는 맨 아래 표의 result 칸에 줄마다 나온다.

do $$
declare
  res text := '';
  admin_id uuid;
  fake uuid := gen_random_uuid();
  p1 uuid; p2 uuid; p3 uuid; pa uuid; pa_alerts int; pa_alert uuid;
  n int; total int;
  claims text;
begin
  begin
    select id into admin_id from public.staff where is_admin order by created_at limit 1;
    if admin_id is null then raise exception 'RESULT:관리자가 없습니다. 003_staff_rls.sql 맨 아래 첫 관리자 지정을 먼저 실행하세요.'; end if;
    select count(*) into total from public.patients;
    select id into p1 from public.patients order by name limit 1;
    select id into p2 from public.patients order by name offset 1 limit 1;
    select id into p3 from public.patients order by name offset 2 limit 1;
    -- 8번 시험용: 알림이 있는 환자 중 p1·p2가 아닌 환자
    select patient_id into pa from public.alerts where patient_id not in (p1, p2) limit 1;
    select count(*) into pa_alerts from public.alerts where patient_id = pa;
    select id into pa_alert from public.alerts where patient_id = pa limit 1;

    -- 1) 관리자: 전체 환자
    perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.patients;
    res := res || format('1. 관리자 계정: 환자 %s/%s명 보임 (기대: 전체)', n, total) || E'\n';

    -- 2) 담당이 없는 계정: 아무것도 안 보임
    perform set_config('request.jwt.claims', json_build_object('sub', fake, 'role', 'authenticated')::text, true);
    select count(*) into n from public.patients;
    res := res || format('2. 담당 없는 계정: 환자 %s명 (기대: 0)', n) || E'\n';
    select count(*) into n from public.alerts;
    res := res || format('   알림 %s건 (기대: 0)', n) || E'\n';
    select count(*) into n from public.play_logs;
    res := res || format('   플레이 기록 %s건 (기대: 0)', n) || E'\n';

    -- 3) 환자 2명을 담당하는 일반 계정 (관리자 계정을 잠시 일반 계정으로 바꿔서 시험)
    execute 'reset role';
    update public.staff set is_admin = false where id = admin_id;
    delete from public.patient_staff where staff_id = admin_id;
    insert into public.patient_staff (patient_id, staff_id) values (p1, admin_id), (p2, admin_id);
    perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.patients;
    res := res || format('3. 2명 담당 계정: 환자 %s명 (기대: 2)', n) || E'\n';
    select count(*) into n from public.play_logs where patient_id not in (p1, p2);
    res := res || format('   담당 아닌 환자의 플레이 기록 %s건 (기대: 0)', n) || E'\n';
    select count(*) into n from public.alerts where patient_id not in (p1, p2);
    res := res || format('   담당 아닌 환자의 알림 %s건 (기대: 0)', n) || E'\n';

    -- 4) 일반 계정이 스스로 관리자 되기
    begin
      update public.staff set is_admin = true where id = admin_id;
      res := res || '4. 스스로 관리자 되기: 막히지 않음 (문제)' || E'\n';
    exception when others then
      res := res || format('4. 스스로 관리자 되기: 막힘 (기대대로, 코드 %s)', sqlstate) || E'\n';
    end;

    -- 5) 일반 계정이 환자 추가
    begin
      insert into public.patients (name, age, prescription_start_date) values ('권한시험', 9, current_date);
      res := res || '5. 일반 계정 환자 추가: 막히지 않음 (문제)' || E'\n';
    exception when others then
      res := res || format('5. 일반 계정 환자 추가: 막힘 (기대대로, 코드 %s)', sqlstate) || E'\n';
    end;

    -- 6) 일반 계정이 스스로 다른 환자 담당 추가
    begin
      insert into public.patient_staff (patient_id, staff_id) values (p3, admin_id);
      res := res || '6. 스스로 담당 추가: 막히지 않음 (문제)' || E'\n';
    exception when others then
      res := res || format('6. 스스로 담당 추가: 막힘 (기대대로, 코드 %s)', sqlstate) || E'\n';
    end;

    -- 7) 담당 아닌 환자에 조치 기록
    begin
      insert into public.actions (patient_id, staff_id, action_type, memo) values (p3, admin_id, '기타', '권한시험');
      res := res || '7. 담당 아닌 환자 조치 기록: 막히지 않음 (문제)' || E'\n';
    exception when others then
      res := res || format('7. 담당 아닌 환자 조치 기록: 막힘 (기대대로, 코드 %s)', sqlstate) || E'\n';
    end;

    -- 8) 담당 아닌 환자의 알림 담당자 바꾸기 (005 이후). 보이지 않는 행이라 0건이 바뀌어야 함
    if pa is null then
      res := res || '8. 담당 아닌 환자 알림의 담당자 바꾸기: 시험할 알림이 없음' || E'\n';
    else
      update public.alerts set assignee_id = admin_id where patient_id = pa;
      get diagnostics n = row_count;
      res := res || format('8. 담당 아닌 환자 알림(%s건)의 담당자 바꾸기: %s건 바뀜 (기대: 0)', pa_alerts, n) || E'\n';
    end if;

    -- 9) 일반 계정이 연락 담당 지정 (005 이후, 관리자만 가능). 0건이 바뀌어야 함
    update public.patient_staff set is_contact = true where patient_id = p1 and staff_id = admin_id;
    get diagnostics n = row_count;
    res := res || format('9. 일반 계정이 연락 담당 지정: %s건 바뀜 (기대: 0)', n) || E'\n';

    -- 10) 담당 아닌 환자의 알림에 넘긴 기록 추가 (006 이후)
    if pa is null then
      res := res || '10. 담당 아닌 환자 알림 넘기기: 시험할 알림이 없음' || E'\n';
    else
      begin
        insert into public.alert_handoffs (alert_id, patient_id, from_staff, to_staff, reason)
        values (pa_alert, pa, admin_id, admin_id, '인계');
        res := res || '10. 담당 아닌 환자 알림 넘기기: 막히지 않음 (문제)' || E'\n';
      exception when others then
        res := res || format('10. 담당 아닌 환자 알림 넘기기: 막힘 (기대대로, 코드 %s)', sqlstate) || E'\n';
      end;
    end if;

    -- 11) 담당 아닌 환자에 다음 연락 일정 추가 (006 이후)
    begin
      insert into public.follow_ups (patient_id, due_date, assignee_id) values (p3, current_date, admin_id);
      res := res || '11. 담당 아닌 환자 다음 연락 일정 추가: 막히지 않음 (문제)' || E'\n';
    exception when others then
      res := res || format('11. 담당 아닌 환자 다음 연락 일정 추가: 막힘 (기대대로, 코드 %s)', sqlstate) || E'\n';
    end;

    -- 12) 담당 아닌 환자를 '내가 맡기' (007 이후)
    begin
      perform public.take_patient(p3);
      res := res || '12. 담당 아닌 환자 내가 맡기: 막히지 않음 (문제)' || E'\n';
    exception when others then
      res := res || format('12. 담당 아닌 환자 내가 맡기: 막힘 (기대대로, 코드 %s)', sqlstate) || E'\n';
    end;

    -- 13) 담당 환자를 담당자가 아닌 사람에게 넘기기 (007 이후)
    begin
      perform public.handoff_patient(p1, fake, '인계', '');
      res := res || '13. 담당자가 아닌 사람에게 넘기기: 막히지 않음 (문제)' || E'\n';
    exception when others then
      res := res || format('13. 담당자가 아닌 사람에게 넘기기: 막힘 (기대대로, 코드 %s)', sqlstate) || E'\n';
    end;

    -- 14) 자기 담당 환자는 맡을 수 있어야 함 (007 이후)
    begin
      perform public.take_patient(p1);
      select count(*) into n from public.patient_staff where patient_id = p1 and staff_id = admin_id and is_contact;
      res := res || format('14. 자기 담당 환자 내가 맡기: 연락 담당 %s명 (기대: 1)', n) || E'\n';
    exception when others then
      res := res || format('14. 자기 담당 환자 내가 맡기: 실패 (문제, 코드 %s)', sqlstate) || E'\n';
    end;

    -- 여기까지의 변경을 모두 되돌리기 위해 일부러 예외를 낸다 (결과 문장을 함께 실어 보냄)
    raise exception 'RESULT:%', res;
  exception when others then
    if sqlerrm like 'RESULT:%' then res := substr(sqlerrm, 8);
    else res := res || '시험 중 예상하지 못한 오류: ' || sqlerrm || ' (코드 ' || sqlstate || ')';
    end if;
  end;
  perform set_config('rls_test.result', res, false);
end $$;

select line as result
from regexp_split_to_table(current_setting('rls_test.result'), E'\n') as line
where line <> '';
