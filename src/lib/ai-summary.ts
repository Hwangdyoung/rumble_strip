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

/** API 실패·타임아웃 시 반환할 규칙 기반 폴백 문장 */
export function fallbackSummary(risk: RiskResult): string {
  return progressSummary(risk);
}

