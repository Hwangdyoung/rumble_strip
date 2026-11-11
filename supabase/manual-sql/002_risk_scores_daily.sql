-- 002: 매일 점검 (2026-11-11 사용자 Supabase에서 실행 완료. 기록용)
alter table public.risk_scores
  add column if not exists source     text not null default 'record',
  add column if not exists check_date date;

alter table public.risk_scores
  add constraint risk_scores_source_check check (source in ('record','daily'));

create unique index if not exists risk_scores_daily_once
  on public.risk_scores (patient_id, check_date) where source = 'daily';
