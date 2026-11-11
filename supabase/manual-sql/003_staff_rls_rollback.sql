-- 003 되돌리기: 다섯 테이블의 정책을 원래대로('로그인하면 전부 허용') 돌린다.
-- staff, patient_staff 테이블과 그 안의 데이터는 지우지 않는다(다시 적용할 때 그대로 쓸 수 있음).

do $$
declare r record; t text;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('patients', 'play_logs', 'risk_scores', 'alerts', 'actions')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  foreach t in array array['patients', 'play_logs', 'risk_scores', 'alerts', 'actions'] loop
    execute format('create policy "staff read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "staff insert %1$s" on public.%1$I for insert to authenticated with check (true)', t);
    execute format('create policy "staff update %1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "staff delete %1$s" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end $$;
