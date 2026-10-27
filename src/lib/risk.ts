/**
 * 이탈 위험 계산 (규칙 기반, 초기 가정치)
 * 모든 수치는 RISK_CONFIG에서 조정할 수 있습니다.
 */

export type RiskLevel = "정상" | "주의" | "이탈 위험" | "치료이탈";

export const RISK_LEVELS: RiskLevel[] = ["정상", "주의", "이탈 위험", "치료이탈"];

export const RISK_CONFIG = {
  /** 단계별 점수 구간 [최소, 최대] — 점수는 항상 단계 구간 안에 들어갑니다 */
  bands: {
    정상: [0, 29],
    주의: [30, 54],
    "이탈 위험": [55, 79],
    치료이탈: [80, 100],
  } as Record<RiskLevel, [number, number]>,
  /** 신호별 가중치 (합계 100) */
  weights: { adherence: 35, gap: 30, trend: 20, elapsed: 15 },
  /** 치료이탈: 처방 기간 중 연속 미접속 일수 */
  dropoutGapDays: 7,
  /** 이탈 위험: 최근 7일 접속 일수 이하 */
  highRiskMaxDays: 2,
  /** 이탈 위험: 연속 미접속 일수 이상 */
  highRiskGapDays: 3,
  /** 주의: 최근 7일 접속 일수 이하 */
  cautionMaxDays: 3,
  /** 주의: 세션 시간 감소율 이상 (0~1) */
  cautionSessionDrop: 0.2,
};

export interface PatientLike {
  prescription_start_date: string; // YYYY-MM-DD
  prescription_weeks: number;
  weekly_target_days: number;
  session_target_minutes: number;
}

export interface PlayLogLike {
  session_start: string;
  play_minutes: number;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  reasons: string[];
  metrics: {
    elapsedDays: number;
    recentDays: number;
    currentGap: number;
    maxGap: number;
    adherence: number;
    sessionChange: number; // -0.4 = 40% 감소
    weeklyDeclineStreak: number;
    lastPlayDate: string | null;
  };
}

const DAY = 86_400_000;

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dayIndex(start: Date, d: Date): number {
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / DAY);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** asOf 날짜(그날 끝) 기준으로 위험도를 계산합니다. */
export function computeRisk(patient: PatientLike, logs: PlayLogLike[], asOf: Date = new Date()): RiskResult {
  const cfg = RISK_CONFIG;
  const start = parseDateKey(patient.prescription_start_date);
  const totalDays = patient.prescription_weeks * 7;
  const today = clamp(dayIndex(start, asOf), 0, totalDays - 1);
  const elapsedDays = today + 1;

  // 날짜별 플레이 분
  const minutesByDay = new Array<number>(elapsedDays).fill(0);
  const sessionsByDay = new Array<number>(elapsedDays).fill(0);
  let lastPlay = -1;
  for (const log of logs) {
    const idx = dayIndex(start, new Date(log.session_start));
    if (idx < 0 || idx > today) continue;
    minutesByDay[idx] += log.play_minutes;
    sessionsByDay[idx] += 1;
    lastPlay = Math.max(lastPlay, idx);
  }
  const played = minutesByDay.map((m) => m > 0);

  // 공백
  const currentGap = today - lastPlay;
  let maxGap = 0;
  let run = 0;
  for (const p of played) {
    run = p ? 0 : run + 1;
    maxGap = Math.max(maxGap, run);
  }

  // 최근 7일 접속 일수 (7일 미만이면 7일 기준으로 환산)
  const windowStart = Math.max(0, today - 6);
  const windowLen = today - windowStart + 1;
  const rawRecent = played.slice(windowStart, today + 1).filter(Boolean).length;
  const recentDays = windowLen < 7 ? Math.round((rawRecent * 7) / windowLen) : rawRecent;

  // 순응도
  const expectedMinutes = (elapsedDays / 7) * patient.weekly_target_days * patient.session_target_minutes;
  const totalMinutes = minutesByDay.reduce((a, b) => a + b, 0);
  const adherence = expectedMinutes > 0 ? clamp(totalMinutes / expectedMinutes, 0, 1.2) : 1;

  // 세션 시간 추세: 최근 7일 평균 세션 vs 직전 7일 평균 세션
  const avgSession = (from: number, to: number) => {
    let m = 0;
    let s = 0;
    for (let i = Math.max(0, from); i <= to; i++) {
      m += minutesByDay[i];
      s += sessionsByDay[i];
    }
    return s > 0 ? m / s : null;
  };
  const recentAvg = avgSession(today - 6, today);
  const prevAvg = today >= 7 ? avgSession(today - 13, today - 7) : null;
  let sessionChange = 0;
  if (prevAvg && prevAvg > 0) sessionChange = ((recentAvg ?? 0) - prevAvg) / prevAvg;

  // 주별 사용량 연속 감소 (완료된 주 + 현재 주를 7일 단위로 비교)
  const weekTotals: number[] = [];
  for (let end = today; end - 6 >= 0; end -= 7) {
    weekTotals.unshift(minutesByDay.slice(end - 6, end + 1).reduce((a, b) => a + b, 0));
  }
  let weeklyDeclineStreak = 0;
  for (let i = weekTotals.length - 1; i > 0; i--) {
    if (weekTotals[i] < weekTotals[i - 1]) weeklyDeclineStreak++;
    else break;
  }

  // 단계 판정
  let level: RiskLevel;
  if (maxGap >= cfg.dropoutGapDays) level = "치료이탈";
  else if (recentDays <= cfg.highRiskMaxDays || currentGap >= cfg.highRiskGapDays || weeklyDeclineStreak >= 2)
    level = "이탈 위험";
  else if (recentDays <= cfg.cautionMaxDays || sessionChange <= -cfg.cautionSessionDrop) level = "주의";
  else level = "정상";

  // 점수: 신호 합산 후 단계 구간 안으로 매핑
  const w = cfg.weights;
  const raw =
    w.adherence * clamp(1 - adherence, 0, 1) +
    w.gap * clamp(currentGap / cfg.dropoutGapDays, 0, 1) +
    w.trend * clamp(-sessionChange / 0.5, 0, 1) +
    w.elapsed * clamp(elapsedDays / totalDays, 0, 1) * clamp(1 - adherence, 0, 1);
  const [lo, hi] = cfg.bands[level];
  const score = Math.round(lo + (clamp(raw, 0, 100) / 100) * (hi - lo));

  // 이유 문장
  const reasons: string[] = [];
  if (level === "치료이탈") reasons.push(`처방 기간 중 ${maxGap}일 연속 미접속`);
  if (windowLen >= 7) reasons.push(`최근 7일 중 ${rawRecent}일 접속`);
  else reasons.push(`최근 ${windowLen}일 중 ${rawRecent}일 접속`);
  if (currentGap >= 2 && level !== "치료이탈") reasons.push(`${currentGap}일 연속 미접속`);
  if (sessionChange <= -0.1) reasons.push(`세션 시간 ${Math.round(-sessionChange * 100)}% 감소`);
  if (weeklyDeclineStreak >= 2) reasons.push(`${weeklyDeclineStreak}주 연속 사용량 감소`);
  reasons.push(`처방 대비 순응도 ${Math.round(Math.min(adherence, 1) * 100)}%`);

  return {
    score,
    level,
    reasons,
    metrics: {
      elapsedDays,
      recentDays,
      currentGap,
      maxGap,
      adherence,
      sessionChange,
      weeklyDeclineStreak,
      lastPlayDate: lastPlay >= 0 ? toDateKey(new Date(start.getTime() + lastPlay * DAY)) : null,
    },
  };
}

/** 날짜별 위험 점수 추이 */
export function riskHistory(patient: PatientLike, logs: PlayLogLike[], asOf: Date = new Date()) {
  const start = parseDateKey(patient.prescription_start_date);
  const last = clamp(dayIndex(start, asOf), 0, patient.prescription_weeks * 7 - 1);
  const out: { date: string; score: number; level: RiskLevel }[] = [];
  for (let i = 0; i <= last; i++) {
    const d = new Date(start.getTime() + i * DAY);
    const r = computeRisk(patient, logs, d);
    out.push({ date: toDateKey(d).slice(5), score: r.score, level: r.level });
  }
  return out;
}

/** 주별 접속 일수와 평균 세션 시간 */
export function weeklySummary(patient: PatientLike, logs: PlayLogLike[]) {
  const start = parseDateKey(patient.prescription_start_date);
  return Array.from({ length: patient.prescription_weeks }, (_, w) => {
    const days = new Set<number>();
    let minutes = 0;
    let sessions = 0;
    for (const l of logs) {
      const idx = dayIndex(start, new Date(l.session_start));
      if (Math.floor(idx / 7) !== w || idx < 0) continue;
      days.add(idx);
      minutes += l.play_minutes;
      sessions++;
    }
    return {
      week: `${w + 1}주차`,
      days: days.size,
      avgMinutes: sessions ? Math.round(minutes / sessions) : 0,
    };
  });
}
