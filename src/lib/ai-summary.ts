/**
 * AI 경과 요약 — 클라이언트/서버 공용 순수 함수 및 타입
 *
 * @anthropic-ai/sdk 나 process.env 를 절대 import/참조하지 않는다.
 * 브라우저 번들에 포함돼도 안전하다.
 */

import { progressSummary } from "@/lib/risk";
import type { RiskResult } from "@/lib/risk";

// ─── 타입 ────────────────────────────────────────────────────────────────────

/** Claude에 보낼 익명화된 지표 타입 (환자 이름·나이·id 없음) */
export interface AiSummaryInput {
  score: number;
  level: string;
  cause: string | null;
  reasons: string[];
  metrics: {
    adherence: number;
    currentGap: number;
    recentDays: number;
    sessionChange: number;
    weeklyDeclineStreak: number;
    sessionsDone: number;
    sessionsExpected: number;
    sessionsBehind: number;
    accuracyDrop: number;
    recentAccuracy: number | null;
    recentAvgMinutes: number | null;
    shortSession: boolean;
    reactionChange: number | null;
  };
  weeklySummary: Array<{ week: string; days: number; avgMinutes: number }>;
}

// ─── 순수 함수 ───────────────────────────────────────────────────────────────

/**
 * RiskResult에서 AI 서버 함수에 보낼 입력을 추출한다.
 * 환자 이름·나이·id는 포함하지 않는다.
 */
export function riskToAiInput(
  risk: RiskResult,
  weeklySummary: Array<{ week: string; days: number; avgMinutes: number }>,
): AiSummaryInput {
  return {
    score: risk.score,
    level: risk.level,
    cause: risk.cause,
    reasons: risk.reasons,
    metrics: {
      adherence: risk.metrics.adherence,
      currentGap: risk.metrics.currentGap,
      recentDays: risk.metrics.recentDays,
      sessionChange: risk.metrics.sessionChange,
      weeklyDeclineStreak: risk.metrics.weeklyDeclineStreak,
      sessionsDone: risk.metrics.sessionsDone,
      sessionsExpected: risk.metrics.sessionsExpected,
      sessionsBehind: risk.metrics.sessionsBehind,
      accuracyDrop: risk.metrics.accuracyDrop,
      recentAccuracy: risk.metrics.recentAccuracy,
      recentAvgMinutes: risk.metrics.recentAvgMinutes,
      shortSession: risk.metrics.shortSession,
      reactionChange: risk.metrics.reactionChange,
    },
    weeklySummary,
  };
}

/**
 * TanStack Query queryKey 헬퍼.
 * 같은 환자·점수·단계·날짜에는 재호출하지 않는다.
 */
export function aiSummaryQueryKey(
  patientId: string,
  score: number,
  level: string,
  dateKey: string, // YYYY-MM-DD
) {
  return ["aiSummary", patientId, score, level, dateKey] as const;
}

/**
 * Claude에 보낸 지표를 화면 칩 문구로 바꾼다.
 * ai-summary.server.ts의 buildUserPrompt가 보내는 지표와 같은 항목이다.
 */
export function aiInputChips(input: AiSummaryInput): string[] {
  const m = input.metrics;
  const signed = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
  const chips = [
    `순응도 ${Math.round(Math.min(m.adherence, 1) * 100)}%`,
    `연속 미접속 ${m.currentGap}일`,
    `최근 7일 접속 ${m.recentDays}일`,
    `진행 회차 ${m.sessionsDone}/${m.sessionsExpected}회`,
    `정확도 하락 ${Math.round(m.accuracyDrop)}%p`,
  ];
  if (m.recentAccuracy != null) chips.push(`최근 정확도 ${Math.round(m.recentAccuracy)}%`);
  chips.push(`세션 시간 ${signed(m.sessionChange)}`);
  if (m.recentAvgMinutes != null) chips.push(`최근 평균 세션 ${Math.round(m.recentAvgMinutes)}분`);
  if (m.reactionChange != null) chips.push(`반응 속도 ${signed(m.reactionChange)}`);
  if (m.weeklyDeclineStreak > 0) chips.push(`주별 사용량 ${m.weeklyDeclineStreak}주 연속 감소`);
  return chips;
}

/** API 실패·타임아웃 시 반환할 규칙 기반 폴백 문장 */
export function fallbackSummary(risk: RiskResult): string {
  return progressSummary(risk);
}

