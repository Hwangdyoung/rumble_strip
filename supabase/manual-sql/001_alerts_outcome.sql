-- 001: 알림 결과 기록 (2026-11-11 사용자 Supabase에서 실행 완료. 기록용)
alter table public.alerts
  add column if not exists outcome      text not null default '미정',
  add column if not exists outcome_at   timestamptz,
  add column if not exists outcome_note text,
  add column if not exists alert_score  int,
  add column if not exists alert_level  text;

alter table public.alerts
  add constraint alerts_outcome_check
    check (outcome in ('미정','회복','이탈','연락 불가')),
  add constraint alerts_alert_score_check
    check (alert_score is null or alert_score between 0 and 100),
  add constraint alerts_alert_level_check
    check (alert_level is null or alert_level in ('정상','주의','이탈 위험','치료이탈'));

update public.alerts a
set alert_score = r.score, alert_level = r.level
from public.risk_scores r
where a.risk_score_id = r.id and a.alert_score is null;
