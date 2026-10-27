delete from public.play_logs where patient_id in ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006');
do $$
declare p record; d int; wk int; play boolean; mins int; st timestamptz; pat int[];
begin
  perform setseed(0.7);
  for p in select id, prescription_start_date, right(id::text,1)::int as n from public.patients where right(id::text,1) in ('5','6') loop
    pat := case when p.n = 5 then array[5,4,3,2] else array[5,5,4,3] end;
    for d in 0..(current_date - p.prescription_start_date) loop
      wk := d / 7;
      play := ((d + p.n) % 7) < pat[wk+1];
      mins := greatest(10, 32 - wk*5 - floor(random()*4)::int);
      if play then
        st := (p.prescription_start_date + d)::timestamp + interval '17 hours' + (floor(random()*120) || ' minutes')::interval;
        insert into public.play_logs (patient_id, session_start, session_end, play_minutes, tasks_completed, ended_early)
        values (p.id, st, st + (mins || ' minutes')::interval, mins, greatest(1, mins/6), mins < 20);
      end if;
    end loop;
  end loop;
end $$;