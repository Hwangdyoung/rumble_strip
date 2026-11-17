-- 013: 게임 플레이 기록에 부딪힘·코인 칸 추가 (2026-11-17)
-- 환자용 게임(/play)의 달리기에서 장애물에 부딪힌 횟수(crashes)와 길에서 주운 코인 수(coins)를 저장한다.
-- 위험 점수: 부딪힘 증가(처음 5판 평균 대비 최근 5판 평균이 늘어난 만큼) 1회당 5점, 최대 20점(src/lib/risk.ts).
-- 코인은 점수에 넣지 않고 크게 줄었을 때 위험 이유에만 표시한다(부딪힘과 같은 일을 두 번 세지 않게).
-- 게임이 아닌 기록(기존 가상 환자 8명)은 두 칸이 비어 있고(null) 점수에 영향이 없다.
-- 실행 순서: 이 SQL을 먼저 실행한 뒤 코드를 배포한다(먼저 배포하면 게임 기록 저장이 실패한다).

alter table public.play_logs add column if not exists crashes integer;
alter table public.play_logs add column if not exists coins integer;
alter table public.play_logs drop constraint if exists play_logs_crashes_check;
alter table public.play_logs add constraint play_logs_crashes_check check (crashes is null or crashes between 0 and 500);
alter table public.play_logs drop constraint if exists play_logs_coins_check;
alter table public.play_logs add constraint play_logs_coins_check check (coins is null or coins between 0 and 1000);

-- 확인: crashes, coins 두 줄이 나오면 됩니다.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'play_logs' and column_name in ('crashes', 'coins') order by column_name;
