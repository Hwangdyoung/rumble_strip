create table public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int not null,
  prescription_start_date date not null,
  prescription_weeks int not null default 4,
  weekly_target_days int not null default 5,
  session_target_minutes int not null default 30,
  created_at timestamptz not null default now()
);
create table public.play_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  session_start timestamptz not null,
  session_end timestamptz not null,
  play_minutes int not null,
  tasks_completed int not null default 0,
  ended_early boolean not null default false
);
create index on public.play_logs(patient_id, session_start);
create table public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  score int not null check (score between 0 and 100),
  level text not null check (level in ('정상','주의','이탈 위험','치료이탈')),
  reasons jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now()
);
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  risk_score_id uuid references public.risk_scores(id) on delete set null,
  message text not null,
  status text not null default '미확인' check (status in ('미확인','확인','조치완료')),
  created_at timestamptz not null default now()
);
create table public.actions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  alert_id uuid references public.alerts(id) on delete set null,
  staff_id uuid not null default auth.uid(),
  action_type text not null check (action_type in ('전화 상담','문자','기타')),
  memo text not null default '',
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['patients','play_logs','risk_scores','alerts','actions'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "staff read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "staff insert %1$s" on public.%1$I for insert to authenticated with check (true)', t);
    execute format('create policy "staff update %1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "staff delete %1$s" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- 예시 데이터: 8명, 처방 시작 27일 전
insert into public.patients (id, name, age, prescription_start_date) values
 ('00000000-0000-0000-0000-000000000001','김하늘',9,  current_date - 27),
 ('00000000-0000-0000-0000-000000000002','이도윤',11, current_date - 27),
 ('00000000-0000-0000-0000-000000000003','박서연',8,  current_date - 26),
 ('00000000-0000-0000-0000-000000000004','최지호',10, current_date - 27),
 ('00000000-0000-0000-0000-000000000005','정유나',12, current_date - 27),
 ('00000000-0000-0000-0000-000000000006','강민준',9,  current_date - 26),
 ('00000000-0000-0000-0000-000000000007','윤채원',10, current_date - 27),
 ('00000000-0000-0000-0000-000000000008','한시우',11, current_date - 27);

do $$
declare
  p record; d int; wk int; play boolean; mins int; st timestamptz; kind text; off int;
begin
  perform setseed(0.42);
  for p in select id, prescription_start_date, right(id::text,1)::int as n from public.patients loop
    kind := case when p.n <= 3 then 'steady' when p.n <= 6 then 'decline' else 'dropout' end;
    off := p.n;
    for d in 0..(current_date - p.prescription_start_date) loop
      wk := d / 7;
      if kind = 'steady' then
        play := ((d + off) % 7) < 5;
        mins := 27 + floor(random()*6)::int;
      elsif kind = 'decline' then
        play := ((d + off) % 7) < (array[5,4,2,1])[wk+1];
        if wk = 3 and p.n = 5 then play := false; end if;
        mins := greatest(8, 32 - wk*6 - floor(random()*4)::int);
      else
        play := d < (case when p.n = 7 then 12 else 9 end) and ((d + off) % 7) < 4;
        mins := 22 - floor(random()*6)::int;
      end if;
      if play then
        st := (p.prescription_start_date + d)::timestamp + interval '17 hours' + (floor(random()*120) || ' minutes')::interval;
        insert into public.play_logs (patient_id, session_start, session_end, play_minutes, tasks_completed, ended_early)
        values (p.id, st, st + (mins || ' minutes')::interval, mins, greatest(1, mins/6), mins < 20);
      end if;
    end loop;
  end loop;
end $$;