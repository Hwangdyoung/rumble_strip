# 이탈방지턱 (rumble_strip)

게임형 디지털 치료제 '스타러커스'(ADHD 아동, 처방 4주·주 5회·하루 약 30분)를 처방받은 환자의 플레이 기록으로
치료 이탈 위험을 계산해, 의료진이 누구에게 먼저 연락할지 알려 주는 웹 앱입니다.

- AI와 점수는 진단·처방을 바꾸지 않는 **참고용 보조 정보**입니다.
- 지금 데이터는 모두 **가상 환자**(예시 8명)입니다. 실제 환자 정보는 없습니다.
- 위험 점수 기준은 처방 기준을 바탕으로 정한 **초기 가정치**입니다. 검증된 기준이 아닙니다.
- 배포 사이트: https://rumble-strip.vercel.app (기관에서 발급한 계정으로만 로그인)

## 주요 기능

- **대시보드**: 오늘 연락할 환자 목록(새로 나빠짐·연락 전·오늘 다시 연락·담당 미지정), 내 담당, 업무 목록 인쇄,
  여러 환자 한 번에 넘기기, 팀 업무량.
- **환자 상세**: 연락 도우미(할 일·전화 문장·문자·보호자 설명과 안내문 인쇄), 경과 요약(AI 요약, 점수 구성),
  그래프, 플레이 캘린더, 연락 이력. 연락 기록과 다음 연락 일정.
- **매일 점검**: 처방 기간 중인 환자의 점수를 하루 한 번 계산해, 상태가 새로 나빠진 환자에게 알림을 만듭니다
  (Vercel Cron 매일 한국 9시대 + 대시보드를 열 때).
- **역할별 화면**: 의사·간호사·관리자는 점수와 게임 결과까지, 상담원은 연락 업무에 필요한 정보만 봅니다.
- **담당 관리(관리자)**: 환자별·의료진별 담당 배정, 연락 담당 지정, 의료진 계정 만들기(초대 코드), 초대 코드 재발급.
- **시뮬레이터**: 가정한 플레이·미접속으로 점수가 어떻게 바뀌는지 미리 봅니다. 저장하지 않습니다.

## 기술

- TanStack Start(React, 파일 기반 라우팅) + Vite + Tailwind v4 + shadcn/ui
- Supabase(PostgreSQL, 로그인, RLS)
- Claude API(AI 경과 요약, 서버 함수에서만 호출. 키가 없거나 실패하면 규칙 기반 문장으로 대신함)
- Vercel 배포(GitHub `main`에 push하면 자동 배포)
- 처음에는 [Lovable](https://lovable.dev)로 만들었고(원래 이름 Care Signal Compass), 이후 로컬에서 개발하고 있습니다.

## 실행

Node.js와 npm이 필요합니다.

```sh
npm install
npm run dev      # http://localhost:8080 (사용 중이면 다음 포트)
npm run test     # vitest
npm run build
```

변경을 확인할 때는 `npm run test`, `npm run build`, `npx tsc --noEmit -p .`를 씁니다.
(`npm run lint`는 기존 파일의 형식 문제로 에러가 많이 나옵니다. 동작과는 무관합니다.)

## 환경 변수

`.env`(저장소에 올라감)에는 **공개해도 되는 값만** 둡니다.

| 이름 | 쓰는 곳 |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | 브라우저 |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` | 서버 함수(로그인 확인) |

비밀 값은 저장소에 두지 않고 배포 환경(Vercel 환경 변수)에만 둡니다.

| 이름 | 용도 |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | 계정 만들기·초대 코드, 상담원 화면 데이터, 매일 점검 Cron |
| `CRON_SECRET` | `/api/daily-check` 호출 확인 |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`(선택) | AI 경과 요약 |
| `DEMO_MODE` | `on`이면 로그인 화면에 전시회용 '둘러보기' 버튼 (끄려면 지움) |

로컬에 `SUPABASE_SERVICE_ROLE_KEY`가 없으면 계정 만들기·계정 활성화는 실패합니다(정상).

## 데이터베이스 준비

새 Supabase 프로젝트에서 아래 순서로 SQL을 실행합니다.

1. `drizzle/migrations/*.sql` (기본 테이블)
2. `supabase/manual-sql/` 번호 순서: 001 알림 결과 → 002 매일 점검 → 003 담당 환자 RLS → 004 관리자 아이디 →
   005 알림 담당자 → 006 넘기기·다음 연락 → 007 환자 단위 맡기·넘기기 → 008 담당자별 업무량 →
   009 역할별 접근 → 010 초대 코드 → 011 전시회 둘러보기
3. 권한 확인: `supabase/manual-sql/003_staff_rls_test.sql` (시험 중 바꾼 것은 자동으로 되돌립니다)

## 폴더

| 위치 | 내용 |
| --- | --- |
| `src/routes/` | 화면(파일 기반 라우팅). 로그인 후 화면은 `_authenticated/` |
| `src/components/` | 화면 부품 |
| `src/lib/risk.ts` | 위험 점수·단계 계산(유일한 위치, 기준값은 `RISK_CONFIG`) |
| `src/lib/*.server.ts` | 서버 함수(비밀 키는 이 안에서만 사용) |
| `supabase/manual-sql/` | Supabase에 손으로 실행한 SQL과 권한 시험 |

개발 기록과 작업 규칙은 `CLAUDE.md`에 있습니다.
