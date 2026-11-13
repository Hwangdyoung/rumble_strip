# 이탈방지턱 (rumble_strip)

게임형 디지털 치료제 '스타러커스'(ADHD 아동, 처방 4주·주 5회·하루 약 30분)를 처방받은 환자의
플레이 기록으로 치료 이탈 위험을 계산해 의료진에게 먼저 알려주는 웹 앱.
AI는 진단·처방을 바꾸지 않는 참고용 보조 도구다. 모든 UI 문구는 한국어.

현재 데이터는 전부 가상 환자(예시 데이터 8명)다. 실제 환자 정보는 없다.

## 이력
- Lovable로 처음 만들었다(대학 수업 8-9주차 과제, 제출 완료). 원래 이름 Care Signal Compass.
- 이후 GitHub `Hwangdyoung/rumble_strip`으로 내보내 로컬(Antigravity IDE)에서 개발 중.
- DB를 Lovable Cloud에서 사용자 소유 Supabase 프로젝트(조직 `AI서비스와DB`, 프로젝트 `이탈방지턱`)로 옮겼다.
  `.env`가 새 Supabase를 가리킨다. Lovable 프로젝트와 Lovable DB는 아직 삭제하지 않았다.
- Lovable과 GitHub의 동기화 해제가 끝났는지는 확인되지 않았다. `AGENTS.md`의 LOVABLE 경고 블록은 그 시절 내용이다.
- 2026-11-11: 점수 구성 카드·요약 근거 칩, 알림 결과 기록, 매일 점검 알림, 시뮬레이터 미리보기 전용화를 추가했다.
  관련 DB 변경 SQL은 사용자 Supabase에서 실행했고 컬럼이 생긴 것을 확인했다.
- 2026-11-11: 사용자가 Vercel에 배포했다(`https://rumble-strip.vercel.app`, 로그인·대시보드·매일 점검 동작을 화면으로 확인).
  GitHub `main`에 push하면 Vercel이 자동 배포한다(확인함). 빌드가 실패하면 직전 정상 배포가 계속 서비스된다.
  Vercel 환경 변수(Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`(Secret), `CRON_SECRET`(Secret), `SUPABASE_PUBLISHABLE_KEY`(2026-11-12 추가, 서버 함수 로그인 확인용).
  `ANTHROPIC_API_KEY`는 없어서 배포 사이트의 AI 요약은 규칙 기반으로 나온다.
  주의: `VITE_` 변수는 화면용이고, 서버 함수(`auth-middleware.ts`)는 `VITE_` 없는 이름을 읽는다. 둘 다 있어야 한다.
  `CRON_SECRET` 값 끝에 줄바꿈이 있으면 Vercel 빌드가 실패한다(`openssl rand -hex 24 | tr -d '\n' | pbcopy`로 만들 것).
- 저장소는 비공개였고, 조원에게 보여주려고 공개 또는 Collaborator 초대를 검토했다(실제 설정은 사용자가 GitHub에서 함).
- 2026-11-12: 의료진 계정별 담당 환자 접근 제한(RLS), 관리자 '담당 관리' 화면, 아이디 로그인(admin)을 추가했다.
  DB 시험 SQL(003_staff_rls_test.sql)로 7가지 접근 규칙이 기대대로인 것을 확인했다.
  이후 시험을 14가지로 늘렸고(넘기기·다음 연락·맡기 포함) 모두 기대대로였다.
- 페르소나 평가 3회: 같은 가상 인물 60명(`/Users/hwangdoyoung/Desktop/personas.csv`, NVIDIA Nemotron 한국인 페르소나 중
  ADHD 디지털 치료제를 쓰는 의사·간호사 등 관련 직무)으로 평가했다. 그 결과로 알림 담당·업무 흐름(넘기기·다음 연락 일정)·
  화면 재배치를 했다. 다시 평가할 때도 같은 60명을 쓴다.
- 2026-11-12: 4차 페르소나 평가(넘기기·다음 연락·인쇄·화면 재배치 반영). 평균 3.42→3.47→3.82→3.90, 4점 이상 40명 그대로,
  새 화면 '쉬움' 44명. 남은 요청 1위는 점수 기준 검증·조정(12명). 재배치로 빠진 담당자별 업무량을 다시 달라는 의견(8·55번).
  평가 자료(1차 PDF 텍스트, eval2~4.py/json, 보고서 HTML)는 저장소 밖 `../페르소나 평가/`에 있다.
  점수 규칙: 이전 차수에서 바란 점이 해결되면 +1(최대 5), 내려가지 않음 → 5점 천장 문제가 있다.
- 2026-11-12: 담당자별 업무량(SQL 008, 넘기기 창 카드·대시보드 '팀 업무량')을 추가했다. 처음엔 008이 실제로 실행되지 않았고
  (시험 15·16번 42883으로 발견) 다시 실행해 시험 통과를 확인했다. 화면은 함수가 없으면 업무량만 숨기므로 시험 SQL로 확인할 것.
  결과 파일은 저장소 밖 `../페르소나 평가/`에 있다(`eval2.json`·`eval3.json`: 60명별 점수·유용한 점·불편한 점·
  더 필요한 것, 평가·보고서 스크립트, 2·3차 보고서 HTML, `1차_PDF_텍스트.txt`). 1차 원본은 `../이탈방지턱 가상 페르소나 평가.pdf`.
- 2026-11-12: 화면 재배치(대시보드 한 목록·요약 숫자·탭, 환자 상세 탭 넘김, 환자 단위 연락 담당)를 `main`에 올렸고
  배포 사이트에서 동작을 확인했다(사용자 확인).
- 2026-11-12: 역할별 접근 제한(SQL 009, 상담원은 연락 업무 정보만, 아래 '역할별 접근 제한' 절)과 담당 관리 화면 개선
  (환자별·의료진별 탭)을 `main`에 올렸고 배포 사이트에서 확인했다. 시험 상담원 계정 '황도영'(강민준·김하늘 담당).
- 2026-11-12: 회원가입 막기(코드). 로그인 화면에서 가입을 뺐고, 관리자가 담당 관리 '의료진별' 탭 '의료진 계정 만들기'로
  계정(아이디@rumble-strip.test, 처음 비밀번호, 이름·역할)을 만든다. DB 변경 없음. `main` 반영(8052d85), 배포 사이트에서 계정 만들기 성공 확인(사용자).
  로컬에서는 service role 키가 없어 계정 만들기가 실패한다(정상). Supabase에서 'Allow new users to sign up'도 껐다(사용자, 2026-11-12).
- 2026-11-12: 처음 설정 코드(SQL 010). 관리자가 비밀번호 대신 일회용 코드(8글자, 72시간, 5번 틀리면 잠김)를 건네고
  본인이 `/activate`에서 비밀번호를 직접 만든다. 관리자는 남의 비밀번호를 모른다. '코드 다시 만들기'가 비밀번호 재설정을 겸한다.
  SQL 010 실행, `main` 반영(75154dd), 배포 사이트에서 계정 만들기·활성화·재발급 모두 확인(사용자, 2026-11-13).
  2026-11-13: 화면 문구를 서비스 앱 말투로 바꿨다(화면 이름은 '초대 코드'·'계정 활성화'·'초대 코드 재발급'), `main` 반영(7a87f16), 배포 사이트 확인(사용자).
- 2026-11-13: 여러 환자 한 번에 넘기기(대시보드 '내 담당' → '여러 명 넘기기'). DB 변경 없음. `main` 반영(74bac96, 97203ca).
  배포 사이트에서 창이 열리는 것은 확인(사용자 캡처, 97203ca 이전). 97203ca의 '받을 사람 없음' 안내와 실제로 넘기는 것은 확인 못 받음.
- 2026-11-13 밤(사용자 요청, 커밋까지만, push 안 함): 화면 문구 전체 점검(a7a12ed), 문서 정리(2ca4f92: README 새로 씀,
  AGENTS.md RLS·계정 설명, prompts.md 맨 위에 '이후 바뀐 점' 안내(본문은 과제 기록이라 보존), config.toml project_id를 새 프로젝트로),
  점수 기준 검증·조정 계획 초안(d84c9cc, `docs/score-validation-plan.md`).
- 2026-11-13: 전시회용 '로그인 없이 둘러보기'(SQL 011, 아래 '전시회 둘러보기' 절). 커밋까지, SQL 실행·push·배포 확인 전.
- 2026-11-12: 5차 페르소나 평가(업무량·역할별 접근·담당 관리 탭·가입 막기 반영). 점수 규칙을 바꿨다:
  해결 +1, 이번 변경으로 4차보다 나빠진 점(새 불편)이 있으면 -1(1~5점), 과제 판단 3개(성공/어려움/실패)를 따로 본다.
  비교용으로 4차 규칙 점수(`s5_old`)도 함께 계산한다. 결과: 새 규칙 3.90→3.87(4점 이상 39명), 4차 규칙이면 3.90 그대로.
  해결 2명(53·55, 이미 5점), 일부 4명(8·20·34·35), 새 불편 2명(57·59 상담원: 점수 구성·알림 CSV가 상담원 화면에서 빠짐).
  과제 180건 중 성공 171, 실패 0. 상담원은 alerts를 못 읽어 설정 화면 CSV가 빈 파일·통계가 0건일 것(코드로 추정)이라는 지적은
  아래 상담원 설정 화면 정리로 반영했다.
  자료: `../페르소나 평가/eval5.py`·`eval5.json`·`build_report5.py`·`persona-eval-5.html`.
- 페르소나 평가 보고서(비공개 claude.ai 페이지): 2차 https://claude.ai/artifact/5aLLtQXDapyRmd48AN5cxe ,
  3차 https://claude.ai/artifact/RLd98tWuejUSiEuTUnjGeu , 4차 https://claude.ai/artifact/FHF6qGMnUTewRpvwhmf4WL ,
  5차 https://claude.ai/artifact/Jh11Kkfsh2v2v99QU35syT

## 실행
```sh
npm install
npm run dev     # http://localhost:8080 (8080을 이미 쓰고 있으면 8081 등 다음 포트로 열림)
npm run test    # vitest (한 번 실행), test:watch는 감시 모드
npm run build
npm run lint    # eslint
npm run format  # prettier
```
- 테스트 파일: `src/lib/risk.test.ts`, `src/lib/calendar.test.ts`, `src/lib/alert-outcome.test.ts`,
  `src/lib/daily-check.test.ts`, `src/test/app-routing.test.tsx`.
- `npm run lint`는 기존 파일들의 prettier 형식 문제로 에러가 많이 나온다(형식만의 문제, 동작과 무관).
  변경을 확인할 때는 `npm run test`, `npm run build`, `npx tsc --noEmit -p .`를 쓴다.
- 패키지 매니저는 npm으로 쓰고 있다. `package-lock.json`은 `.gitignore`에 있어서 올라가지 않는다(저장소에는 `bun.lock`이 있음).
- Node는 v25를 쓰고 있다.

## 구조
- 프레임워크: TanStack Start(React, 파일 기반 라우팅) + Vite + Tailwind v4 + shadcn/ui. 빌드 설정은
  `@lovable.dev/vite-tanstack-config`를 쓰고, Nitro 기본 타깃이 Cloudflare라 Vercel 배포 시 조정이 필요할 수 있다.
- `src/routes/_authenticated/`: 로그인 후 화면. `route.tsx`가 로그인 여부를 확인해 로그인 안 하면
  `/auth`(`src/routes/auth.tsx`)로 보낸다. `patients.$id.tsx`는 예전 주소를 `/dashboard?patient=ID`로 넘기는 리다이렉트다.
- 대시보드(`dashboard.tsx`, 2026-11-12 재배치·시안 A): 환자 한 줄 = 할 일 하나, 목록은 하나만.
  - 위: 요약 숫자 4칸(새로 나빠짐·연락 전·오늘 다시 연락·담당 미지정). 누르면 그 환자만 걸러 보기.
  - 목록(`ContactList.tsx`, 계산은 `src/lib/contact-list.ts`) 탭: 오늘 연락 / 전체(정상은 '경과 관찰') / 내 담당. 인쇄(`work-sheet.ts`).
  - 여러 명 넘기기(2026-11-13, 의사·간호사·관리자): '내 담당' 탭 '여러 명 넘기기' → 체크칸(내가 연락 담당인 환자만) → 'N명 넘기기'
    → `BulkHandoffDialog.tsx`. 받는 사람 후보는 고른 환자 중 한 명이라도 담당하는 사람(카드에 'N명 중 M명 받을 수 있음'),
    담당이 아닌 환자는 미리 알리고 건너뜀. 환자마다 `handoff_patient`를 차례로 부른다(전부 되거나 전부 안 되는 처리 아님, 실패한 환자는 결과에 표시).
    계산은 `src/lib/bulk-handoff.ts`(테스트 있음), 받는 사람 카드·이유·메모는 한 명 넘기기와 같이 `HandoffFields.tsx`를 쓴다.
    상담원 목록에는 아직 없음.
    오늘 연락 = 정상이 아니고 기준 점수 이상 + 새로 나빠짐(처리 안 된 알림) + 오늘까지 다시 연락할 환자.
    줄마다 '새로 나빠짐'·'오늘 다시 연락' 표시, 상태(다시 연락·연락 전·연락 불가·연락 예정·연락함), 연락 담당. 손이 가야 하는 줄이 먼저.
  - 환자를 누르면 목록이 줄어들고(왼쪽 약 40%) 상세가 옆에서 밀려 들어오는 분할 화면
    (`SplitPatientDetail.tsx`, `styles.css`의 `.dashboard-split`). `?patient=ID`로 상태 유지.
    오른쪽 상세는 헤더 아래에 고정(sticky)되고 안에서만 스크롤된다. 모바일은 상세가 전체 화면.
- 환자 상세(`PatientDetail.tsx`): 맨 위(이름·단계·점수·이유·다음 연락일, 연락 담당 + '내가 맡기'·'넘기기'(`PatientContact.tsx`),
  '연락 기록하기')는 늘 보이고, 아래는 탭 5개로 한 화면씩 옆으로 넘긴다(탭 줄 sticky, 보던 탭은 다른 환자에서도 유지):
  연락 도우미(`ResponseGuide.tsx`) / 경과 요약(AI 요약·핵심 지표·위험 이유·점수 구성) / 그래프 / 캘린더 /
  연락 이력(`ContactHistory.tsx`: 새로 나빠짐·연락 기록·넘긴 기록 시간 순, 새로 나빠짐 줄에서 결과 기록). 넘김 효과는 `styles.css`의 `.tab-slide`.
- 로그인(`auth.tsx`): 로그인만 있다(회원가입 없음, 2026-11-12). 계정이 없으면 관리자에게 요청하라는 안내.
  '초대 코드를 받으셨나요? 계정 활성화하기' 링크 → `/activate`(`src/routes/activate.tsx`, 로그인 없이 열림).
- 계정 만들기: `CreateStaffAccount.tsx`(창) → 서버 함수 `src/lib/staff-account.server.ts`의 `createStaffAccount`
  (부른 사람이 관리자인지 확인 → service role로 `auth.admin.createUser`(아무도 모르는 임의 비밀번호, 메일 확인 생략) + `staff` 줄
  + `staff_invites` 줄(코드 해시), 중간에 실패하면 만든 것을 지움). 입력 확인은 `src/lib/staff-account.ts`(아이디·이름·역할만).
  만든 뒤 아이디·처음 설정 코드·기한을 한 번 보여 주고 '안내 문장 복사'를 준다(`SetupCodeView`).
  로컬에서는 `.env`에 service role 키가 없으면 실패한다(배포 사이트에는 `SUPABASE_SERVICE_ROLE_KEY` 있음).
- 담당 관리(`admin.tsx`, 관리자만): 의료진·환자가 많아져도 쓰도록 탭 2개(2026-11-12, 예전 '의료진 = 열' 표를 바꿈, 배포 사이트에서 확인).
  환자별(`AdminByPatient.tsx`): 환자 한 줄에 담당자 이름표(×로 해제), 이름 검색으로 추가(`NamePicker.tsx`), 환자 검색·담당 미배정만,
  여러 환자를 골라 한 사람에게 한 번에 배정, 연락 담당 선택. 의료진별(`AdminByStaff.tsx`): 이름·역할로 찾기, 역할·관리자 설정,
  펼쳐서 담당 환자 추가·해제, 업무량 표시, 계정 만들기, 새 계정(담당 0명·관리자 아님)이 맨 위('새 계정' 표시). 계산은 `src/lib/assignments.ts`. DB 변경 없음.
- 담당은 환자 단위 '연락 담당' 하나. '내가 맡기'(관리자·그 환자 담당자 누구나)와 '넘기기'(받는 사람은 그 환자 담당자)는
  DB 함수 `take_patient`, `handoff_patient`(SQL 007)가 권한을 확인하고 처리한다. 처리 안 된 알림 담당자도 함께 바뀐다.
- 담당자별 업무량(`staff_workload`, SQL 008, `src/lib/workload.ts`): 사람별 건수만 돌려주는 DB 함수(환자 정보 없음).
  RLS 때문에 화면에서 세면 동료 숫자가 적게 나와서 함수로 센다. 연락 담당 기준 환자 수: 맡은 환자·새로 나빠짐·오늘 다시 연락·오늘 할 일.
  '넘기기' 창의 받는 사람 카드(오늘 할 일 가장 적은 사람에 '여유' 표시, 자동 선택 안 함)와 대시보드 접힌 줄 '팀 업무량'(`TeamWorkload.tsx`).
  함수가 없으면(008 실행 전) 숫자만 숨기고 넘기기는 그대로 된다.
- 알림(`alerts`) = '새로 나빠짐' 사건. 종 아이콘(`AlertsBell.tsx`)은 '새로 나빠진 환자' 목록이고 누르면 환자 상세.
- 다음 연락 일정(`follow_ups`, `src/lib/follow-up.ts`): '연락 기록하기' 창에서 예정일(주의 3일·이탈 위험 2일·치료이탈 1일 뒤
  기본)을 정한다. 그날 목록에 '오늘 다시 연락'으로 나오고, 다음 연락 기록 때 함께 완료한다. 보호자 안내문에도 들어간다.
- 시뮬레이터(`simulator.tsx`): 저장 없는 미리보기 전용. 가정한 플레이·미접속을 순서대로 쌓아 `computeRisk`로 계산만 한다.
  DB·대시보드·알림을 바꾸지 않는다. 알림 조건에 해당하면 안내 문구만 띄운다.
- `src/components/PatientDetail.tsx`: 환자 상세. 점수 구성 카드, 핵심 지표, AI 경과 요약(+근거 수치 칩), 대응 가이드, 위험 이유,
  점수 추이 그래프, 주별 그래프, 플레이 캘린더, 알림(상태·결과·메모), 조치 기록.
  - '점수 구성' 카드: `risk.breakdown` 항목 + `risk.adjustment`(단계 구간 보정) 합계 = `risk.score`.
  - 근거 칩: AI 요약이면 `aiInputChips`(Claude에 보낸 수치), 규칙 기반이면 `summaryEvidence`(문장에 쓰인 수치).
- 대응 가이드(`ResponseGuide.tsx`, 문구는 `src/lib/response-guide.ts`): 단계·추정 원인·지표 숫자로 할 일, 전화 문장, 문자,
  보호자용 쉬운 설명(점수 없이, 복사, A4 '스타러커스 사용 안내' 인쇄: `src/lib/guardian-sheet.ts`)을 만든다. 처리 안 된 알림 결과가 '연락 불가'면 다음 단계 안내를 앞에 보여 준다.
  '전화했어요'·'문자 보냈어요'를 누르면 조치 기록 창이 유형·메모 틀이 채워진 채로 열린다. 문자는 앱에서 보내지 않는다(복사만).
  문구는 Claude가 쓴 초기 예시이며 현장 검토 전이다(화면에 표시). 진단·처방 변경·약물 표현 금지를 테스트로 확인한다.
- `src/components/AlertsBell.tsx`: 종 아이콘 알림 목록(최근 30건). 알림마다 결과 버튼(메모는 환자 상세에서만).
- `src/lib/risk.ts`: 위험 점수·단계 계산의 유일한 위치. 임계값은 `RISK_CONFIG`. 점수는 클라이언트에서 play_logs로 계산한다.
- `src/lib/daily-check.ts`: 매일 점검 계획(`planDailyCheck`, 순수 함수), 한국 시간 `koreaNow`, Cron 인증 `isAuthorizedCron`.
- `src/lib/daily-check-run.ts`: 매일 점검 DB 조회·저장(`runDailyCheckWith(client, now)`). 대시보드는 `queries.ts`의
  `runDailyCheck`(로그인 사용자 클라이언트), Cron은 `src/routes/api/daily-check.ts`(관리자 클라이언트)로 같은 함수를 쓴다.
- `src/routes/api/daily-check.ts`: Vercel Cron이 부르는 서버 주소(GET). `CRON_SECRET` 확인 후 실행, 아니면 401.
  관리자 클라이언트(`client.server.ts`)는 핸들러 안에서 동적 import한다.
- Cron 설정은 `vite.config.ts`의 `nitro.vercel.config.crons`에 있다. 매일 `0 0 * * *`(UTC 0시 = 한국 9시대,
  무료 플랜은 그 시간 안 아무 때나 실행). Nitro가 `.vercel/output/config.json`을 직접 만들어서 `vercel.json`의
  crons는 적용되지 않는다(처음에 vercel.json으로 했다가 Cron이 등록되지 않아 옮김).
  확인: `NITRO_PRESET=vercel npm run build` 후 `.vercel/output/config.json`의 `crons`.
- `src/lib/alert-outcome.ts`: 알림 결과 집계(`outcomeStats`)와 '회복' 제안(`suggestOutcome`, 알림 후 7일 안 플레이 기록).
  제안은 문구로만 보여주고 자동 저장하지 않는다.
- `src/lib/calendar.ts`: 캘린더 표시용 집계. 위험 계산은 risk.ts에 맡긴다.
- `src/lib/queries.ts`: Supabase 조회·기록.
- `src/lib/ai-summary.ts`(클라이언트에서 써도 되는 함수·타입), `src/lib/ai-summary.server.ts`(Claude API 호출 서버 함수
  `fetchAiSummary`, `PatientDetail.tsx`가 import해서 호출한다).
- `src/integrations/supabase/`: 브라우저 클라이언트(`client.ts`), 서버용 service_role 클라이언트(`client.server.ts`),
  로그인 확인 미들웨어(`auth-middleware.ts`), Lovable 크론용 인증(`cron-auth.ts`, 현재 어디서도 쓰지 않음).
- 환경 변수 이름: `.env`에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`와 각각의 `VITE_` 버전.
  서버 코드가 쓰는 비밀 변수는 `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`(선택), `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`,
  `LOVABLE_CRON_SECRET`(쓰지 않음). 비밀 변수는 Vercel 환경 변수(서버)에만 둔다.

## DB
- 테이블: patients, play_logs, risk_scores, alerts, actions. 원래 스키마는 `drizzle/migrations/*.sql`.
  타입은 `src/integrations/supabase/types.ts`.
- 마이그레이션 파일에는 없지만 사용자 Supabase에는 추가돼 있는 것(SQL Editor로 직접 실행):
  - `play_logs`: `accuracy`(numeric), `reaction_ms`(integer)
  - `alerts`: `outcome`('미정'|'회복'|'이탈'|'연락 불가', 기본 '미정'), `outcome_at`, `outcome_note`,
    `alert_score`, `alert_level` (2026-11-11)
  - `risk_scores`: `source`('record'|'daily', 기본 'record'), `check_date`(date),
    고유 인덱스 `risk_scores_daily_once`(patient_id, check_date where source='daily') (2026-11-11)
  - `staff`(의료진: id=auth.users.id, name, role '의사'|'간호사'|'상담원', is_admin), `patient_staff`(환자-담당자, 여러 명) (2026-11-12)
  - `staff_invites`(처음 설정 코드: staff_id, login_id, code_hash, expires_at, used_at, attempts, created_by) (2026-11-12, 010)
  - `staff.is_demo`(둘러보기 계정), `demo_baseline`(시연 기준 한 줄, data jsonb) (2026-11-13, 011)
  - `alerts`: `assignee_id`(→ staff), `assigned_at`, `resolved_at` / `patient_staff`: `is_contact`(환자당 1명, 관리자만 변경) (2026-11-12)
  - `alert_handoffs`(넘긴 기록, 007부터 alert_id 비어 있을 수 있음), `follow_ups`(다음 연락 일정) (2026-11-12, 006·007)
- 손으로 실행한 SQL은 `supabase/manual-sql/`에 번호 순서로 둔다(001 알림 결과, 002 매일 점검, 003 담당 환자 RLS와
  되돌리기·시험 SQL, 004 관리자 아이디, 005 알림 담당자, 006 넘기기·다음 연락, 007 환자 단위 맡기·넘기기, 008 담당자별 업무량, 009 역할별 접근, 010 처음 설정 코드, 011 전시회 둘러보기). DB를 새로 만들 때 마이그레이션 다음에 이 순서대로 실행한다.
- RLS(003 이후): 관리자(`is_admin()`)는 전체, 그 외에는 `patient_staff`로 연결된 환자만(`can_see_patient()`).
  - patients·play_logs: 읽기는 관리자·담당자, 쓰기는 관리자만
  - risk_scores·alerts: 담당자도 추가(대시보드 매일 점검)·알림 상태와 결과 기록 가능, 삭제는 관리자
  - actions: 담당자가 자기 이름(staff_id = auth.uid())으로만 기록, 수정·삭제는 본인이나 관리자
  - staff: 모두 읽기, 자기 정보만 만들고 고침, 관리자 권한은 관리자만 바꿈 / patient_staff: 추가·삭제는 관리자만
  - Vercel Cron 매일 점검은 service role이라 RLS와 관계없이 전체 환자를 점검한다.
  - 정책을 바꾸면 `003_staff_rls_test.sql`을 다시 돌려 확인한다(시험 중 변경은 자동으로 되돌린다).

## 위험 단계 (규칙 기반, 초기 가정치)
정상 0~29 / 주의 30~54 / 이탈 위험 55~79 (점수 구간, `RISK_CONFIG.bands`).
치료이탈은 점수가 아니라 사실로 판정한다: 처방 기간 중 7일 이상 연속 미접속(`dropoutGapDays`). 80~100점으로 표시.
점수식: 연속 미접속일×14 + 회차 지연×8 + 정확도 하락(%p)×1.5 + 짧은 세션 10. 합계를 단계 구간 안으로 맞춘다.
신호: 처방 대비 순응도, 연속 미접속일, 세션 시간 추세, 정확도 하락, 경과일.
반응 속도 변화는 이유에만 표시하고 점수에는 반영하지 않는다.
공개된 이탈 임계값 표준이 없어서 처방 기준을 바탕으로 정한 가정치다. 수치를 근거 없이 "검증된 기준"처럼 표현하지 않는다.

## 알림 (매일 점검)
- 알림 = 상태가 새로 나빠졌다는 사건 기록(`alerts`). 이미 높은 단계인 환자에게 같은 이유로 다시 알리지 않는다.
- 매일 점검: 처방 기간 중인 환자의 오늘 점수를 마지막 저장 점수(없으면 어제 기준 계산)와 비교해
  `shouldAlert`(이탈 위험·치료이탈로 올라감, 또는 `ALERT_SCORE_JUMP` 15점 이상 상승)면 알림을 만든다.
  알림에는 당시 점수·단계(`alert_score`, `alert_level`)를 함께 저장한다.
- 환자별로 하루 한 번만 저장한다(고유 인덱스로 중복 방지). 처방 시작 전·종료 환자는 점검하지 않는다.
- 실행 경로 두 가지(같은 날 둘 다 돌아도 하루 한 번만 저장):
  - Vercel Cron: 매일 한국 9시대에 `/api/daily-check`. 프로덕션 배포에서만 돈다. 무료 플랜은 실행이 빠질 수 있다.
  - 대시보드를 열 때 자동 실행 + '지금 점검' 버튼(Cron이 빠진 날의 보험).
- 날짜는 항상 한국 시간 기준(`koreaNow`). Vercel 서버는 UTC라서 그대로 쓰면 날짜가 어긋나 중복 저장될 수 있다.
  남은 차이: 한국 0~9시 플레이 기록은 서버 계산에서 전날로 셀 수 있다.
- 게임 연동이 없어 새 플레이 기록이 들어오는 경로는 현재 없다(예전 시뮬레이터 저장 기능 `addLogAndRecalc`는 제거).
- 2026-11-11 첫 점검: 8명 점검, 새 알림 3건 생성을 화면에서 확인.

## AI 경과 요약 (Claude API)
- 서버 함수에서만 `@anthropic-ai/sdk`로 호출한다. 키는 `process.env.ANTHROPIC_API_KEY`, 모델은 `ANTHROPIC_MODEL`로
  바꿀 수 있다(기본값 `claude-haiku-4-5`).
- 로그인한 사용자만 호출할 수 있다(`requireSupabaseAuth` 미들웨어). 3초 넘으면 중단, `max_tokens` 300.
- 같은 환자·점수·단계·날짜에는 다시 호출하지 않는다(`aiSummaryQueryKey`로 TanStack Query 캐시, 24시간).
- Claude에 보내는 건 점수·단계·추정 원인·이유·지표 숫자·주별 요약(주, 접속일, 평균 세션 분)뿐(`riskToAiInput`).
  환자 이름, 나이, id는 보내지 않는다.
- 실패나 시간 초과 시 `risk.ts`의 규칙 기반 문장으로 폴백하고 '규칙 기반 요약' 표시를 붙인다.
  실패 이유는 서버 터미널에 찍히지 않는다.
- 현재 키는 유효하지만 Anthropic 크레딧이 없어 항상 폴백된다(2026-11-11 직접 호출로 확인:
  HTTP 400 "credit balance is too low"). 코드 문제가 아니다.

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
- 위험 점수 로직은 `risk.ts`에만 둔다. 다른 곳에서 따로 계산하지 않는다(daily-check, 시뮬레이터도 risk.ts를 부르기만 함).
- 알림 결과 '회복' 제안이나 매일 점검 외에 사람 확인 없이 결과를 자동 저장하지 않는다.
- 시뮬레이터는 DB에 쓰지 않는다.
- 이미 push한 기록을 force push, rebase, amend하지 않는다.
- DB 스키마를 바꾸면 사용자 Supabase(SQL Editor)에서 실행할 SQL을 함께 제시하고, `types.ts`도 맞춘다.
  SQL 실행 전에 새 컬럼을 쓰는 코드가 돌면 저장이 실패하니, 실행 순서를 사용자에게 알린다.
- 진단, 처방 변경, 약물 조언을 하는 문구를 만들지 않는다. "참고용 보조 정보" 안내 문구는 유지한다.

## 사용자와 일하는 방식
- 사용자는 비전공자에 가까운 학생이다. 터미널 명령은 그대로 붙여넣을 수 있게 주고, 결과를 어떻게 읽는지 함께 알려준다.
- 돌려 말하지 않고 사실만 말한다. 확실하지 않으면 추측이라고 밝힌다.
- 요청한 것만 한다. 범위를 넘는 변경은 먼저 묻는다. 큰 변경은 계획(파일·SQL·화면)을 먼저 보여주고 확인받는다.
- 답변은 한국어로 한다.
- 화면 문구는 실제 서비스 앱처럼 쓴다(2026-11-13 사용자 요청). 짧고 정중한 '-하세요/-합니다', 사용자가 할 일 중심.
  개발 사정(SQL 번호, '배포 사이트에서 시도', 'Supabase 키', 괄호 속 내부 설명)은 화면에 쓰지 않고 코드 주석·CLAUDE.md에 둔다.
  오류는 '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'처럼 사용자가 할 수 있는 행동으로 끝낸다.
  2026-11-13 화면 문구를 한 번 전체 점검했다(src/components, src/routes). 진단·가정치 안내 문구는 일부러 남겼다.
- 화면 확인은 사용자가 로컬(보통 `http://localhost:8081`) 또는 배포 사이트에서 직접 하고 캡처로 알려준다.
  로그인이 필요한 화면은 사용자가 로그인한다(비밀번호는 Claude가 입력하지 않음).
- 토큰을 아끼려고 한 채팅에서 한 가지 일을 하고 새 채팅으로 넘어간다. 큰 변경을 마치면 이 파일을 최신으로 맞춘다.

## Git 가지
- `main`: 최신이자 배포 대상(push하면 Vercel 자동 배포).
- `backup/before-redesign`: 화면 재배치 전 백업(3f0f69f). 되돌릴 때 참고한다.
- `redesign`: 재배치 작업용이었고 지금은 `main`과 같다. 더 쓰지 않는다.

## 다음에 할 일 (추천 순서, 2026-11-12 기준)
새 채팅은 "CLAUDE.md 읽고 이어서 하자. 오늘 할 일: (아래 중 하나)"로 시작한다. 큰 작업은 계획을 먼저 보여 주고 확인받는다.
1. (완료, 2026-11-12) 회원가입 막기: 코드·배포·계정 만들기 확인, Supabase 가입 끄기까지 끝.
2. (완료, 2026-11-12) 5차 페르소나 평가. 다음 평가도 5차 규칙(새 불편 -1, 과제 판단, 4차 규칙 점수 병기)을 쓴다.
   5차 보고서 제안: 상담원 CSV 버튼 숨기기·안내(완료), 첫 로그인 비밀번호 변경 강제(→ 초대 코드로 대신, 완료·배포 확인),
   여러 환자 한 번에 넘기기(2026-11-13 구현).
3. 점수 기준 검증·조정 기능 (큰 작업, DB 필요). 계획 초안: `docs/score-validation-plan.md`(1 잘못 울림 → 4 지표 → 2 기록 누락 → 3 기준 조정 추천, 결정할 것 5가지)
   - 4차 평가 남은 요청 1위(12명): 관리자가 위험 기준을 화면에서 조정하고 변경 기록 남기기, '잘못 울린 알림' 결과 추가,
     기록 누락과 미사용 구분, 적중률·기간별 이탈률 같은 성능 지표, 회복 사례 모아 보기.
   - 지금 임계값은 `risk.ts`의 `RISK_CONFIG`(코드 상수). 조정하려면 DB로 옮기고 risk.ts가 그 값을 받게 해야 한다(계산은 계속 risk.ts에서만).
4. 그 밖에 4차 평가에서 나온 작은 것: (여러 환자 한 번에 넘기기(35번)는 2026-11-13 구현), 의사 확인 요청에 답했는지 표시(58번),
   보호자 연락 가능 시간 기록(46번), 기관 정보(병원 이름·연락처) 자동 채우기, 짧은 통화 문장, 생활 변화·가정 환경 메모칸.
5. AI 요약 켜기: 개발을 마친 뒤 결제하기로 함. 그때 할 일은 아래 '남은 일'과 'AI 경과 요약' 절 참고
   (Anthropic 크레딧·월 한도, Vercel `ANTHROPIC_API_KEY`, 모델 선택: 지금 기본 claude-haiku-4-5. 3초·300토큰 설정이라
   생각 단계가 있는 모델은 설정 변경 필요, 응답에서 글자 블록 찾기·실패 이유 로그 남기기 코드 보강 필요).

## 남은 일
- Anthropic 크레딧 충전 여부 결정
- Lovable 쪽 GitHub 연결 해제 확인, 새 Supabase에서 안정 확인 후 Lovable DB 정리
  (Lovable 미리보기 링크가 과제 노션에 걸려 있으니 채점 후)
- 배포 사이트 AI 요약용 `ANTHROPIC_API_KEY`는 크레딧 충전 때 등록
- Vercel Cron을 'Schedules'로 옮길지 결정. 현재 Cron Jobs(Legacy)로 등록·동작 중이다
  (2026-11-11: Vercel 프로젝트 메뉴 Schedules → Cron Jobs에 `/api/daily-check` Active, 수동 Run 결과 HTTP 200).
  Vercel 화면에서 'deprecated, Schedules로 옮기라'는 안내가 나온다
- 예전 시뮬레이터가 실제로 저장한 play_logs·risk_scores 정리 여부 결정(삭제는 사용자 확인 후).
  2026-11-11 기준 alerts는 매일 점검이 만든 3건뿐이었다. play_logs·risk_scores는 확인하지 않았다
- 회원가입은 막혔다(Supabase 가입 끔). 계정은 앱의 '의료진 계정 만들기'(관리자 API)로만 만들고, 본인이 처음 설정 코드로 비밀번호를 만든다.
  배포 사이트에서 만든 시험 계정이 있으면 필요 없을 때 Supabase → Authentication → Users에서 지운다.
- 역할별 접근 제한은 구현했다(아래). 실제 운영 전 병원 개인정보 담당 확인 필요
- 대응 가이드 문구 현장 검토, 관리자가 문구를 화면에서 고치는 기능(DB 필요), 실제 문자 발송 연동 검토
- Lovable 전용 코드 정리(`lovable-error-reporting.ts`, `previewAuthStorage.ts`, `cron-auth.ts`, `@lovable.dev/vite-tanstack-config`)
- (정리함, 2026-11-13) README·AGENTS.md·prompts.md·config.toml. 남은 것: 설정의 비밀번호 변경은 6자 이상인데
  초대 코드 활성화는 8자 이상(규칙이 다름, 고치지 않음). `src/routes/README.md`는 TanStack 라우팅 안내라 그대로 둠.

## 역할별 접근 제한 (2026-11-12 완료: main 반영, SQL 009 실행, 시험 25가지 기대대로, 배포 사이트에서 상담원·관리자 화면 확인)
- 상담원(의료인 아님)은 연락 업무에 필요한 정보만 본다. 의사·간호사·관리자 화면은 그대로. 판단은 `src/lib/roles.ts`의 `canSeeClinical`.
- DB(SQL 009): 상담원은 play_logs·risk_scores·alerts를 직접 못 읽음(알림 문구에 정확도 등 수치가 있어서). 역할은 관리자만 바꾸고
  새 가입자는 '상담원'으로 시작(`saveMyStaff`는 이름만). 상담원도 쓰는 DB 함수: `record_contact`, `mark_alert_seen`, `set_contact_outcome`(미정·연락 불가만).
- 상담원 화면 데이터는 서버 함수 `src/lib/counselor-view.server.ts`(목록·종 알림·환자 상세)가 만든다. 사용자 권한으로 담당 환자를 확인한 뒤
  그 환자들의 play_logs·alerts만 관리자 클라이언트로 읽어 서버에서 risk.ts로 계산하고, 단계·접속 관련 이유(`counselorReasons`)·접속한 날짜·
  연락 도우미 문장·단계만 담은 알림을 보낸다. 점수·정확도·반응 속도·세션 시간·저장된 알림 문구는 보내지 않는다.
- 상담원 화면: 환자 상세 `CounselorPatientDetail.tsx`(탭: 연락 도우미·접속 캘린더 `AttendanceCalendar.tsx`·연락 이력), 대시보드 목록은 점수 없이,
  매일 점검·시뮬레이터·AI 요약 없음(AI 요약 서버 함수도 거절). 알림 결과는 미정·연락 불가만.
- 설정 → 데이터(`settings.tsx`의 `DataSection`, 2026-11-12): 상담원에게는 '알림 결과 통계'와 'CSV 내려받기'를 숨기고
  "의료진이 내려받습니다" 안내만 보인다(상담원은 alerts를 못 읽어 0건·빈 파일이 되므로). `main` 반영(c8dc27e, cccb48c), 배포 사이트 화면 확인은 아직.
- 남은 빈틈: 보호자 안내문(인쇄)에 주별 평균 사용 시간이 들어감(보호자용 정보라 허용), 연락 기록 메모는 상담원도 봄,
  프로필 메뉴의 '내 알림' 수는 상담원에게 0으로 보일 수 있음.
- 처음 배포 때 상담원 목록이 "불러오지 못했습니다"였던 원인은 Vercel에 `SUPABASE_PUBLISHABLE_KEY`(VITE_ 없는 이름)가 없어서였다. 추가·Redeploy 후 해결.
- 시험 계정: 상담원 '황도영'(강민준·김하늘 담당).

## 초대 코드 (처음 설정 코드, 2026-11-12, SQL 010)
- 흐름: 관리자 '의료진 계정 만들기'(비밀번호 칸 없음) → 아이디·코드(예: K7QM-4XPA)·기한 표시, '안내 문장 복사' →
  본인이 로그인 화면 '처음 설정 코드로 비밀번호 만들기'(`/activate`)에서 아이디·코드·새 비밀번호 → 바로 로그인.
- 코드 규칙(`src/lib/setup-code.ts`, 테스트 `setup-code.test.ts`): 0·O·1·I 없는 32글자 중 8글자, 72시간, 한 번만, 5번 틀리면 잠김.
  DB에는 SHA-256(staff_id:코드) 해시만 저장. 틀린 이유는 한 문장으로만 알린다(아이디가 있는지 알려 주지 않음).
- 서버 함수(`staff-account.server.ts`): `createStaffAccount`, `reissueSetupCode`(관리자, 자기 자신은 불가, 비밀번호를 임의 값으로 바꿔
  예전 비밀번호를 막음), `activateAccount`(로그인 없이, 코드를 먼저 사용함으로 표시한 뒤 비밀번호 설정).
- 담당 관리 '의료진별': 코드를 아직 안 쓴 사람에 '설정 대기'·'코드 기한 지남'·'코드 잠김', 줄마다 '코드 다시 만들기'(비밀번호 잊음에도 사용).
  상태는 `setupInvitesQuery`(관리자만, code_hash 열은 권한으로 막힘). 010 이전 계정은 줄이 없어 설정 마침으로 본다.
- 권한 시험: `003_staff_rls_test.sql` 26~29번(관리자 아닌 계정 0건, 관리자 1건, 관리자도 해시 읽기·화면에서 고치기 막힘).
- 남은 빈틈: 코드를 다시 만들어도 이미 로그인돼 있던 기기는 바로 로그아웃되지 않을 수 있음(추정, 확인 안 함). 코드 시도 횟수는 계정별로만 센다.
- 로컬에서는 service role 키가 없어 계정 만들기·코드 확인이 '서버 설정이 없어' 문구로 실패한다(정상, 화면에서 확인함).
- 화면에서 부르는 이름: 초대 코드, 계정 활성화(`/activate`), 초대 코드 재발급, 상태 '활성화 대기'·'코드 만료'·'코드 잠김'.
  코드 안의 이름은 setup code·invite 그대로.
- 완료: SQL 010 실행, 배포 사이트 확인(2026-11-13). 시험 SQL 26~29번 결과는 받지 못했다.

## 전시회 둘러보기 (2026-11-13, SQL 011)
- 목적: 전시회에서 누구나 로그인 없이 의사·간호사·상담원 화면을 써 보게 한다. 데이터는 전부 가상 환자.
- 켜기: Vercel 환경 변수 `DEMO_MODE=on`(서버용, VITE_ 아님)일 때만. 지우면 로그인 화면 버튼이 사라지고 둘러보기 로그인도 거절된다.
- 로그인 화면(`DemoEntry.tsx`): '의사로/간호사로/상담원으로 둘러보기' 버튼(둘러보기 계정이 있는 역할만).
  서버 함수 `src/lib/demo.server.ts`: `getDemoStatus`, `demoSignIn`(관리자 API `generateLink(magiclink)`의 hashed_token을
  서버에서 바로 `/auth/v1/verify`로 바꿔 세션을 돌려줌, 비밀번호 없음, 화면 코드에 비밀 없음). 계정 고르기는 `src/lib/demo.ts`(테스트 있음):
  `staff.is_demo` 켜짐 + 관리자 아님 + 역할 일치, 먼저 만든 계정.
- 둘러보기 중: 화면 맨 위 띠(`DemoBanner`, '나가기'), 설정의 이름·비밀번호 변경 숨김(DB에서도 자기 정보 수정 막음: staff_update_self 정책).
- 관리자: 담당 관리 '의료진별'에 '둘러보기' 스위치(관리자 계정은 불가), 설정 → 데이터 '전시회 둘러보기'(`DemoDataControls.tsx`)에서
  '지금 상태를 시연 기준으로 저장'·'시연 기준으로 되돌리기'.
- 되돌리기(`reset_demo_data`): 기준 저장 뒤 바뀐 연락 기록·넘긴 기록·다음 연락 일정·담당 연결·알림 상태를 **누가 바꿨든 모두** 기준으로 돌린다.
  기준 뒤에 생긴 알림은 지우지 않고 '미확인·미정'으로. 환자·플레이 기록·위험 점수·계정은 그대로.
  둘러보기가 켜져 있으면 Vercel Cron 매일 점검 전에 자동 실행(`/api/daily-check` 응답의 demoReset).
- 권한 시험: `003_staff_rls_test.sql` 30~35번.
- 확인 못 한 것: `demoSignIn`의 세션 받기(`/verify`에 type magiclink + token_hash)는 로컬에 service role 키가 없어 실행해 보지 못함. 배포 사이트에서 확인 필요.
  로컬 로그인 화면은 둘러보기가 꺼진 상태로 에러 없이 열리는 것만 확인.
- 준비 순서: SQL 011 실행 → 시험 SQL 30~35 → push → Vercel `DEMO_MODE=on` 추가·Redeploy → 관리자로 시연 계정 3개(의사·간호사·상담원)
  만들고 '둘러보기' 켜고 환자 배정 → 설정 → 데이터 '시연 기준으로 저장'.
- 남은 걱정(추정): 새 플레이 기록이 들어오지 않아 날짜가 지날수록 가상 환자가 대부분 '치료이탈'로 보일 수 있다. 전시회 날짜에 맞춘 예시 데이터 갱신은 따로.
  둘러보기 로그인 주소는 누구나 부를 수 있다(횟수 제한 없음). 전시회가 끝나면 `DEMO_MODE`를 지울 것.

