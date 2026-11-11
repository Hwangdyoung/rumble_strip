/**
 * 알림 결과 기록 — 나중에 실제 데이터로 점수를 검증하기 위한 집계
 *
 * 위험 점수 계산과는 무관합니다(점수는 risk.ts만 계산).
 * 여기의 '회복' 제안은 화면에 띄우는 참고일 뿐, 자동으로 저장하지 않습니다.
 */

import { RISK_LEVELS, type RiskLevel } from "./risk";

export type AlertOutcome = "미정" | "회복" | "이탈" | "연락 불가";
export const ALERT_OUTCOMES: AlertOutcome[] = ["미정", "회복", "이탈", "연락 불가"];

/** 알림 후 이 기간 안에 플레이 기록이 다시 생기면 '회복'으로 보인다고 제안합니다. */
export const RECOVERY_WINDOW_DAYS = 7;

const DAY = 86_400_000;

export interface OutcomeSuggestion {
  outcome: "회복";
  /** 알림 후 며칠 뒤 첫 플레이 기록이 있었는지 (0 = 알림 당일) */
  daysAfter: number;
  text: string;
}

/** 알림 이후 7일 안의 첫 플레이 기록을 찾아 '회복' 제안을 만듭니다. 기록이 없으면 null. */
export function suggestOutcome(
  alertCreatedAt: string,
  logs: Array<{ session_start: string; play_minutes: number }>,
): OutcomeSuggestion | null {
  const created = new Date(alertCreatedAt).getTime();
  const until = created + RECOVERY_WINDOW_DAYS * DAY;
  let first: number | null = null;
  for (const l of logs) {
    if (l.play_minutes <= 0) continue;
    const t = new Date(l.session_start).getTime();
    if (t > created && t <= until && (first === null || t < first)) first = t;
  }
  if (first === null) return null;
  const daysAfter = Math.floor((first - created) / DAY);
  const when = daysAfter === 0 ? "알림 당일" : `알림 ${daysAfter}일 뒤`;
  return {
    outcome: "회복",
    daysAfter,
    text: `${when} 플레이 기록이 있어 '회복'으로 보입니다. 확인 후 직접 선택해 주세요.`,
  };
}

export type LevelKey = RiskLevel | "단계 미기록";

export interface OutcomeStats {
  total: number;
  /** 결과가 기록된(미정이 아닌) 알림 수 */
  recorded: number;
  counts: Record<Exclude<AlertOutcome, "미정">, number>;
  /** 기록된 알림 중 비율 (0~1). 기록이 없으면 null */
  rates: Record<Exclude<AlertOutcome, "미정">, number | null>;
  /** 알림 당시 단계별 회복 비율 (기록된 알림이 있는 단계만) */
  byLevel: Array<{ level: LevelKey; recorded: number; recovered: number; rate: number }>;
}

export function outcomeStats(alerts: Array<{ outcome: string; alert_level: string | null }>): OutcomeStats {
  const done = alerts.filter((a) => a.outcome !== "미정");
  const count = (o: string) => done.filter((a) => a.outcome === o).length;
  const counts = { 회복: count("회복"), 이탈: count("이탈"), "연락 불가": count("연락 불가") };
  const rate = (n: number) => (done.length > 0 ? n / done.length : null);

  const levelOf = (l: string | null): LevelKey => (RISK_LEVELS.includes(l as RiskLevel) ? (l as RiskLevel) : "단계 미기록");
  const order: LevelKey[] = [...RISK_LEVELS, "단계 미기록"];
  const byLevel = order
    .map((level) => {
      const rows = done.filter((a) => levelOf(a.alert_level) === level);
      const recovered = rows.filter((a) => a.outcome === "회복").length;
      return { level, recorded: rows.length, recovered, rate: rows.length > 0 ? recovered / rows.length : 0 };
    })
    .filter((r) => r.recorded > 0);

  return {
    total: alerts.length,
    recorded: done.length,
    counts,
    rates: { 회복: rate(counts.회복), 이탈: rate(counts.이탈), "연락 불가": rate(counts["연락 불가"]) },
    byLevel,
  };
}
