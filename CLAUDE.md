# 이탈방지턱 (rumble_strip)

게임형 디지털 치료제 '스타러커스'(ADHD 아동, 처방 4주·주 5회·하루 약 30분)를 처방받은 환자의
플레이 기록으로 치료 이탈 위험을 계산해 의료진에게 먼저 알려주는 웹 앱.
AI는 진단·처방을 바꾸지 않는 참고용 보조 도구다. 모든 UI 문구는 한국어.

현재 데이터는 전부 가상 환자(예시 데이터)다. 실제 환자 정보는 없다.

## 이력
- Lovable로 처음 만들었다(대학 수업 8-9주차 과제, 제출 완료). 원래 이름 Care Signal Compass.
- 이후 GitHub `Hwangdyoung/rumble_strip`으로 내보내 로컬(Antigravity IDE)에서 개발 중.
- DB를 Lovable Cloud에서 사용자 소유 Supabase 프로젝트(조직 `AI서비스와DB`, 프로젝트 `이탈방지턱`)로 옮겼다.
  `.env`가 새 Supabase를 가리킨다. Lovable 프로젝트와 Lovable DB는 아직 삭제하지 않았다.
- Lovable과 GitHub의 동기화 해제가 끝났는지는 확인되지 않았다. `AGENTS.md`의 LOVABLE 경고 블록은 그 시절 내용이다.

## 실행
```sh
npm install
npm run dev     # http://localhost:8080
npm run test    # vitest (한 번 실행), test:watch는 감시 모드
npm run build
npm run lint    # eslint
npm run format  # prettier
```
- 테스트 파일: `src/lib/risk.test.ts`, `src/lib/calendar.test.ts`, `src/test/app-routing.test.tsx`.
- 패키지 매니저는 npm으로 쓰고 있다. `package-lock.json`은 `.gitignore`에 있어서 올라가지 않는다(저장소에는 `bun.lock`이 있음).
- Node는 v25를 쓰고 있다.

## 구조
- 프레임워크: TanStack Start(React, 파일 기반 라우팅) + Vite + Tailwind v4 + shadcn/ui. 빌드 설정은
  `@lovable.dev/vite-tanstack-config`를 쓰고, Nitro 기본 타깃이 Cloudflare라 Vercel 배포 시 조정이 필요할 수 있다.
- `src/routes/_authenticated/`: 로그인 후 화면(dashboard, simulator). `route.tsx`가 로그인 여부를 확인해
  로그인 안 하면 `/auth`(`src/routes/auth.tsx`)로 보낸다. `patients.$id.tsx`는 상세 화면이 아니라
  예전 주소를 `/dashboard?patient=ID`로 넘겨주는 리다이렉트다.
- 대시보드: 환자를 누르면 목록이 줄어들고 상세가 옆에서 밀려 들어오는 분할 화면(`SplitPatientDetail.tsx`,
  `styles.css`의 `.dashboard-split`). `?patient=ID`로 상태 유지.
- `src/components/PatientDetail.tsx`: 환자 상세(AI 경과 요약, 위험 이유, 점수 추이 그래프, 플레이 캘린더, 조치 기록).
- `src/lib/risk.ts`: 위험 점수·단계 계산의 유일한 위치. 임계값은 `RISK_CONFIG`. 점수는 클라이언트에서 play_logs로 계산한다.
- `src/lib/calendar.ts`: 캘린더 표시용 집계. 위험 계산은 risk.ts에 맡긴다.
- `src/lib/queries.ts`: Supabase 조회·기록.
- `src/lib/ai-summary.ts`(클라이언트에서 써도 되는 함수·타입), `src/lib/ai-summary.server.ts`(Claude API 호출 서버 함수
  `fetchAiSummary`, `PatientDetail.tsx`가 import해서 호출한다).
- `src/integrations/supabase/`: 브라우저 클라이언트(`client.ts`), 서버용 service_role 클라이언트(`client.server.ts`),
  로그인 확인 미들웨어(`auth-middleware.ts`), Lovable 크론용 인증(`cron-auth.ts`).
- 환경 변수 이름: `.env`에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`와 각각의 `VITE_` 버전.
  서버 코드가 쓰는 비밀 변수는 `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`(선택), `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_CRON_SECRET`.
- DB 테이블: patients, play_logs, risk_scores, alerts, actions. 원래 스키마는 `drizzle/migrations/*.sql`.
  `play_logs`에는 `accuracy`(numeric), `reaction_ms`(integer) 컬럼이 필요하다(마이그레이션 파일에는 없음).
  타입은 `src/integrations/supabase/types.ts`.

## 위험 단계 (규칙 기반, 초기 가정치)
정상 0~29 / 주의 30~54 / 이탈 위험 55~79 (점수 구간, `RISK_CONFIG.bands`).
치료이탈은 점수가 아니라 사실로 판정한다: 처방 기간 중 7일 이상 연속 미접속(`dropoutGapDays`).
신호: 처방 대비 순응도, 연속 미접속일, 세션 시간 추세, 정확도 하락, 경과일.
반응 속도 변화는 이유에만 표시하고 점수에는 반영하지 않는다.
알림(`shouldAlert`): 이탈 위험·치료이탈로 올라가거나 점수가 `ALERT_SCORE_JUMP`(15점) 이상 오를 때.
공개된 이탈 임계값 표준이 없어서 처방 기준을 바탕으로 정한 가정치다. 수치를 근거 없이 "검증된 기준"처럼 표현하지 않는다.

## AI 경과 요약 (Claude API)
- 서버 함수에서만 `@anthropic-ai/sdk`로 호출한다. 키는 `process.env.ANTHROPIC_API_KEY`, 모델은 `ANTHROPIC_MODEL`로
  바꿀 수 있다(기본값 `claude-haiku-4-5`).
- 로그인한 사용자만 호출할 수 있다(`requireSupabaseAuth` 미들웨어). 3초 넘으면 중단, `max_tokens` 300.
- 같은 환자·점수·단계·날짜에는 다시 호출하지 않는다(`aiSummaryQueryKey`로 TanStack Query 캐시).
- Claude에 보내는 건 점수·단계·추정 원인·이유·지표 숫자·주별 요약(주, 접속일, 평균 세션 분)뿐(`riskToAiInput`).
  환자 이름, 나이, id는 보내지 않는다.
- 실패나 시간 초과 시 `risk.ts`의 규칙 기반 문장으로 폴백하고 '규칙 기반 요약' 표시를 붙인다.
- 현재 키는 정상 인식되지만 Anthropic 크레딧이 없어 항상 폴백된다. 코드 문제가 아니다.

## 반드시 지킬 것
- 비밀 값
  - `.env.local`(Anthropic 키)은 읽거나 출력하거나 수정하지 않는다. 변수 이름으로만 참조한다.
  - `.env`는 GitHub에 올라간다. 공개용 값(Supabase URL, publishable 키)만 둔다.
    Anthropic 키, Supabase secret/service_role 키는 절대 넣지 않는다.
  - 비밀 키를 `VITE_` 변수나 클라이언트 코드에 두지 않는다.
- 폴더 이름에 `server`를 쓰지 않는다(`src/server/` 등). `@lovable.dev/vite-tanstack-config`가 import-protection으로
  `**/server/**` 파일과 `server-only` 모듈을 클라이언트에서 막아서, import하면 화면 전체가 에러가 난다.
  (`src/server.ts`는 폴더가 아니라 SSR 진입 파일이라 해당 없음.)
- 서버 코드는 `*.server.ts` 파일에 `createServerFn`으로 둔다. 서버 함수 자체는 클라이언트에서 import해 호출해도 된다
  (`PatientDetail.tsx` → `fetchAiSummary`). 대신 SDK import, `process.env`, 비밀 키는 반드시 핸들러 안에만 둔다.
- 위험 점수 로직은 `risk.ts`에만 둔다. 다른 곳에서 따로 계산하지 않는다.
- 이미 push한 기록을 force push, rebase, amend하지 않는다.
- DB 스키마를 바꾸면 사용자 Supabase(SQL Editor)에서 실행할 SQL을 함께 제시하고, `types.ts`도 맞춘다.
- 진단, 처방 변경, 약물 조언을 하는 문구를 만들지 않는다. "참고용 보조 정보" 안내 문구는 유지한다.

## 사용자와 일하는 방식
- 사용자는 비전공자에 가까운 학생이다. 터미널 명령은 그대로 붙여넣을 수 있게 주고, 결과를 어떻게 읽는지 함께 알려준다.
- 돌려 말하지 않고 사실만 말한다. 확실하지 않으면 추측이라고 밝힌다.
- 요청한 것만 한다. 범위를 넘는 변경은 먼저 묻는다.
- 답변은 한국어로 한다.

## 남은 일
- Anthropic 크레딧 충전 여부 결정
- Lovable 쪽 GitHub 연결 해제 확인, 새 Supabase에서 안정 확인 후 Lovable DB 정리
  (Lovable 미리보기 링크가 과제 노션에 걸려 있으니 채점 후)
- Vercel 배포(빌드 타깃 조정, 환경 변수 등록. `VITE_` 없이 `ANTHROPIC_API_KEY`)
- 실제 운영 전 RLS 강화: 현재는 로그인한 누구나 모든 데이터를 읽고 쓸 수 있고 회원가입도 열려 있다
- Lovable 전용 코드 정리(`lovable-error-reporting.ts`, `previewAuthStorage.ts`, `cron-auth.ts`, `@lovable.dev/vite-tanstack-config`)
- 예전 상태가 남은 문서·설정 확인: `supabase/config.toml`의 `project_id`가 `.env`의 새 프로젝트와 다름,
  `README.md`는 Lovable 템플릿 그대로, `AGENTS.md` 본문은 "staff-only RLS"라고 적혀 있어 위 RLS 설명과 다름(실제 정책 미확인)
