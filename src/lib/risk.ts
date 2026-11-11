/**
 * 이탈 위험 계산 (규칙 기반, 초기 가정치)
 *
 * 위험 점수 = 연속 미접속일×14 + 회차 지연×8 + 정확도 하락(%p)×1.5 + 짧은 세션 가산 10  (최대 100점)
 * - 치료이탈은 점수가 아니라 '사실'로 판정합니다: 처방 기간 중 7일 이상 연속 미접속.
 * - 그 외 단계는 점수 구간으로 나눕니다 (정상 0~29 / 주의 30~54 / 이탈 위험 55~79).
 * 모든 수치는 RISK_CONFIG에서 조정할 수 있습니다.
 */

export type RiskLevel = "정상" | "주의" | "이탈 위험" | "치료이탈";
export type RiskCause = "난이도 과다" | "난이도 낮음" | "단순 미접속";

export const RISK_LEVELS: RiskLevel[] = ["정상", "주의", "이탈 위험", "치료이탈"];

export const RISK_CONFIG = {
  /** 단계별 점수 구간 [최소, 최대] — 점수는 항상 단계 구간 안에 들어갑니다 */
  bands: {
    정상: [0, 29],
    주의: [30, 54],
    "이탈 위험": [55, 79],
    치료이탈: [80, 100],
  } as Record<RiskLevel, [number, number]>,
  /** 점수식 계수 (가정값 — 의료진 자문과 실제 데이터로 보정) */
  formula: { gapPerDay: 14, behindPerSession: 8, accuracyPerPp: 1.5, shortSessionBonus: 10 },
  /** 치료이탈: 처방 기간 중 현재 연속 미접속 일수 */
  dropoutGapDays: 7,
  /** 처음/최근 몇 회차를 비교할지 (정확도·세션·반응 속도) */
  compareWindow: 5,
  /** 짧은 세션: 최근 평균 세션이 목표 시간의 이 비율 미만 */
  shortSessionRatio: 0.7,
  /** 원인 분류: 정확도가 이만큼(%p) 이상 하락하면 '난이도 과다' */
  hardAccuracyDrop: 10,
  /** 원인 분류: 최근 정확도가 이 값 이상이고 세션이 짧으면 '난이도 낮음' */
  easyAccuracy: 85,
  /** 참고 지표: 반응 속도가 이 비율 이상 느려지면 이유에 표시 (점수에는 반영하지 않음) */
  reactionSlowRatio: 0.15,
};

/** 원인별 권장 조치 */
export const CAUSE_ACTION: Record<RiskCause, string> = {
  "난이도 과다": "난이도 하향 재조정을 요청하고 보호자에게 연락하세요.",
  "난이도 낮음": "난이도 상향 재조정을 요청하고 보호자에게 연락하세요.",
  "단순 미접속": "보호자에게 연락하고 내원을 권유하세요.",
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
  accuracy?: number | null | undefined; // 0~100 (%)
  reaction_ms?: number | null | undefined;
}

export interface BreakdownItem {
  key: "gap" | "behind" | "accuracy" | "shortSession";
  label: string;
  detail: string;
  points: number;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  /** 추정 원인 (정상이면 null) */
  cause: RiskCause | null;
  reasons: string[];
  /** 점수 계산 내역 */
  breakdown: BreakdownItem[];
  /** 상한 적용 전 합계 */
  rawScore: number;
  /** 단계 구간 보정: score - rawScore (보정이 없으면 null). 항목 합계 + 보정 = score */
  adjustment: { points: number; reason: string } | null;
  metrics: {
    elapsedDays: number;
    recentDays: number;
    currentGap: number;
    maxGap: number;
    adherence: number;
    sessionChange: number; // -0.4 = 40% 감소
    weeklyDeclineStreak: number;
    lastPlayDate: string | null;
    sessionsDone: number; // 지금까지 접속한 날 수(회차)
    sessionsExpected: number; // 처방 기준 예상 회차
    sessionsBehind: number; // 회차 지연
    accuracyDrop: number; // %p, 하락한 만큼 양수
    recentAccuracy: number | null;
    recentAvgMinutes: number | null;
    shortSession: boolean;
    reactionChange: number | null; // 0.2 = 20% 느려짐
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
  return new Date(y!, m! - 1, d!);
}

function dayIndex(start: Date, d: Date): number {
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / DAY);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** asOf 날짜(그날 끝) 기준으로 위험도를 계산합니다. */
export function computeRisk(patient: PatientLike, logs: PlayLogLike[], asOf: Date = new Date()): RiskResult {
  const cfg = RISK_CONFIG;
  const f = cfg.formula;
  const start = parseDateKey(patient.prescription_start_date);
  const totalDays = patient.prescription_weeks * 7;
  const today = Math.max(0, dayIndex(start, asOf));
  const elapsedDays = today + 1;

  // 날짜별 플레이 분
  const minutesByDay = new Array<number>(elapsedDays).fill(0);
  const sessionsByDay = new Array<number>(elapsedDays).fill(0);
  const valid: { t: number; minutes: number; accuracy: number | null; reaction: number | null }[] = [];
  let lastPlay = -1;
  for (const log of logs) {
    const idx = dayIndex(start, new Date(log.session_start));
    if (idx < 0 || idx > today) continue;
    if (log.play_minutes <= 0) continue; // 0분 기록 = 미접속 표시용
    minutesByDay[idx] = (minutesByDay[idx] ?? 0) + log.play_minutes;
    sessionsByDay[idx] = (sessionsByDay[idx] ?? 0) + 1;
    lastPlay = Math.max(lastPlay, idx);
    valid.push({
      t: new Date(log.session_start).getTime(),
      minutes: log.play_minutes,
      accuracy: log.accuracy ?? null,
      reaction: log.reaction_ms ?? null,
    });
  }
  valid.sort((a, b) => a.t - b.t);
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

  // 회차 지연: 처방 기준 예상 회차 - 실제 접속 일수
  const sessionsDone = played.filter(Boolean).length;
  const sessionsExpected = Math.floor((Math.min(elapsedDays, totalDays) * patient.weekly_target_days) / 7);
  const sessionsBehind = Math.max(0, sessionsExpected - sessionsDone);

  // 순응도
  const expectedMinutes = (elapsedDays / 7) * patient.weekly_target_days * patient.session_target_minutes;
  const totalMinutes = minutesByDay.reduce((a, b) => a + b, 0);
  const adherence = expectedMinutes > 0 ? clamp(totalMinutes / expectedMinutes, 0, 1.2) : 1;

  // 세션 시간 추세: 최근 7일 평균 세션 vs 직전 7일 평균 세션
  const avgSession = (from: number, to: number) => {
    let m = 0;
    let s = 0;
    for (let i = Math.max(0, from); i <= to; i++) {
      m += minutesByDay[i] ?? 0;
      s += sessionsByDay[i] ?? 0;
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
    if ((weekTotals[i] ?? 0) < (weekTotals[i - 1] ?? 0)) weeklyDeclineStreak++;
    else break;
  }

  // 정확도: 처음 K회 평균 vs 최근 K회 평균 (회차 기준이라 오래 쉰 환자도 비교 가능)
  const accs = valid.filter((v) => v.accuracy != null).map((v) => v.accuracy as number);
  const kAcc = Math.min(cfg.compareWindow, Math.floor(accs.length / 2));
  const accuracyDrop = kAcc >= 2 ? Math.max(0, mean(accs.slice(0, kAcc)) - mean(accs.slice(-kAcc))) : 0;
  const recentAccuracy = accs.length > 0 ? mean(accs.slice(-Math.min(cfg.compareWindow, accs.length))) : null;

  // 반응 속도 (참고 지표 — 점수에는 반영하지 않음)
  const rts = valid.filter((v) => v.reaction != null).map((v) => v.reaction as number);
  const kRt = Math.min(cfg.compareWindow, Math.floor(rts.length / 2));
  const reactionChange = kRt >= 2 ? (mean(rts.slice(-kRt)) - mean(rts.slice(0, kRt))) / mean(rts.slice(0, kRt)) : null;

  // 짧은 세션: 최근 K회 평균 시간이 목표의 70% 미만
  const recentSessions = valid.slice(-cfg.compareWindow);
  const recentAvgMinutes = recentSessions.length > 0 ? mean(recentSessions.map((v) => v.minutes)) : null;
  const shortSession =
    valid.length >= 3 && recentAvgMinutes !== null && recentAvgMinutes < cfg.shortSessionRatio * patient.session_target_minutes;

  // 점수식
  const breakdown: BreakdownItem[] = [
    { key: "gap", label: "연속 미접속", detail: `${currentGap}일 × ${f.gapPerDay}`, points: currentGap * f.gapPerDay },
    { key: "behind", label: "회차 지연", detail: `${sessionsBehind}회 × ${f.behindPerSession}`, points: sessionsBehind * f.behindPerSession },
    {
      key: "accuracy",
      label: "정확도 하락",
      detail: `${accuracyDrop.toFixed(0)}%p × ${f.accuracyPerPp}`,
      points: Math.round(accuracyDrop * f.accuracyPerPp),
    },
    {
      key: "shortSession",
      label: "짧은 세션",
      detail: shortSession ? `최근 평균 ${Math.round(recentAvgMinutes ?? 0)}분 (목표 ${patient.session_target_minutes}분)` : "해당 없음",
      points: shortSession ? f.shortSessionBonus : 0,
    },
  ];
  const rawScore = breakdown.reduce((a, b) => a + b.points, 0);

  // 단계 판정: 치료이탈은 사실(7일 이상 연속 미접속), 나머지는 점수 구간
  const dropout = currentGap >= cfg.dropoutGapDays;
  let level: RiskLevel;
  if (dropout) level = "치료이탈";
  else if (rawScore >= cfg.bands["이탈 위험"][0]) level = "이탈 위험";
  else if (rawScore >= cfg.bands["주의"][0]) level = "주의";
  else level = "정상";
  const [lo, hi] = cfg.bands[level];
  const score = clamp(Math.round(rawScore), lo, hi);
  const adjustPoints = score - Math.round(rawScore);
  const adjustment =
    adjustPoints === 0
      ? null
      : {
          points: adjustPoints,
          reason:
            adjustPoints > 0
              ? level === "치료이탈"
                ? `치료이탈(${cfg.dropoutGapDays}일 이상 연속 미접속)은 최소 ${lo}점으로 표시`
                : `${level} 구간 최소 ${lo}점 적용`
              : `${level} 구간 최대 ${hi}점 적용`,
        };

  // 추정 원인
  let cause: RiskCause | null = null;
  if (level !== "정상") {
    if (accuracyDrop >= cfg.hardAccuracyDrop) cause = "난이도 과다";
    else if (recentAccuracy !== null && recentAccuracy >= cfg.easyAccuracy && shortSession) cause = "난이도 낮음";
    else cause = "단순 미접속";
  }

  // 이유 문장 (대시보드에는 앞의 2개가 표시됩니다)
  const reasons: string[] = [];
  if (level === "치료이탈") reasons.push(`처방 기간 중 ${currentGap}일 연속 미접속`);
  else if (currentGap >= 2) reasons.push(`${currentGap}일 연속 미접속`);
  if (accuracyDrop >= 5) reasons.push(`정확도 ${Math.round(accuracyDrop)}%p 하락`);
  if (shortSession) reasons.push(`평균 세션 ${Math.round(recentAvgMinutes ?? 0)}분으로 짧아짐`);
  if (sessionChange <= -0.1 && !shortSession && recentAvg !== null) reasons.push(`세션 시간 ${Math.round(-sessionChange * 100)}% 감소`);
  if (reactionChange !== null && reactionChange >= cfg.reactionSlowRatio) reasons.push(`반응 속도 ${Math.round(reactionChange * 100)}% 느려짐`);
  if (sessionsBehind > 0) reasons.push(`처방 대비 ${sessionsBehind}회 지연`);
  if (windowLen >= 7) reasons.push(`최근 7일 중 ${rawRecent}일 접속`);
  else reasons.push(`최근 ${windowLen}일 중 ${rawRecent}일 접속`);
  if (weeklyDeclineStreak >= 2) reasons.push(`${weeklyDeclineStreak}주 연속 사용량 감소`);
  reasons.push(`처방 대비 순응도 ${Math.round(Math.min(adherence, 1) * 100)}%`);

  return {
    score,
    level,
    cause,
    reasons,
    breakdown,
    rawScore: Math.round(rawScore),
    adjustment,
    metrics: {
      elapsedDays,
      recentDays,
      currentGap,
      maxGap,
      adherence,
      sessionChange,
      weeklyDeclineStreak,
      lastPlayDate: lastPlay >= 0 ? toDateKey(new Date(start.getTime() + lastPlay * DAY)) : null,
      sessionsDone,
      sessionsExpected,
      sessionsBehind,
      accuracyDrop,
      recentAccuracy,
      recentAvgMinutes,
      shortSession,
      reactionChange,
    },
  };
}

/** 날짜별 위험 점수 추이 */
export function riskHistory(patient: PatientLike, logs: PlayLogLike[], asOf: Date = new Date()) {
  const start = parseDateKey(patient.prescription_start_date);
  const last = Math.max(0, dayIndex(start, asOf));
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
  const maxIdx = Math.max(0, ...logs.map((l) => dayIndex(start, new Date(l.session_start))));
  const weeks = Math.max(patient.prescription_weeks, Math.floor(maxIdx / 7) + 1);
  return Array.from({ length: weeks }, (_, w) => {
    const days = new Set<number>();
    let minutes = 0;
    let sessions = 0;
    for (const l of logs) {
      const idx = dayIndex(start, new Date(l.session_start));
      if (Math.floor(idx / 7) !== w || idx < 0 || l.play_minutes <= 0) continue;
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

/** 평가 기준일: 오늘과 마지막 기록일 중 늦은 날 (시뮬레이터로 미래 날짜를 넣은 경우 대비) */
export function asOfFor(logs: PlayLogLike[], now: Date = new Date()): Date {
  let t = now.getTime();
  for (const l of logs) t = Math.max(t, new Date(l.session_start).getTime());
  return new Date(t);
}

/** 알림 기준: 점수 상승 폭 */
export const ALERT_SCORE_JUMP = 15;

/** 이전 → 이후 결과로 알림을 만들지 판단합니다. */
export function shouldAlert(before: Pick<RiskResult, "score" | "level">, after: Pick<RiskResult, "score" | "level">): boolean {
  const high = (l: RiskLevel) => l === "이탈 위험" || l === "치료이탈";
  if (high(after.level) && !high(before.level)) return true;
  if (after.level === "치료이탈" && before.level !== "치료이탈") return true;
  return after.score - before.score >= ALERT_SCORE_JUMP;
}

export function alertMessage(name: string, before: Pick<RiskResult, "score" | "level">, after: RiskResult): string {
  const head =
    after.level !== before.level
      ? `${name}님이 '${before.level}' → '${after.level}' 단계로 바뀌었습니다`
      : `${name}님의 위험 점수가 ${before.score} → ${after.score}점으로 올랐습니다`;
  const cause = after.cause ? ` (추정 원인: ${after.cause})` : "";
  return `${head}${cause}. 이유: ${after.reasons.slice(0, 3).join(", ")}`;
}

/** 규칙 기반 요약이 근거로 삼은 수치 (chip: 화면 칩 문구, phrase: 요약 문장에 들어가는 구절) */
export interface SummaryEvidence {
  chip: string;
  phrase: string;
}

/** 규칙 기반 경과 요약에 쓰이는 수치 목록. progressSummary와 같은 조건을 공유합니다. */
export function summaryEvidence(r: RiskResult): SummaryEvidence[] {
  const m = r.metrics;
  const adherence = Math.round(Math.min(m.adherence, 1) * 100);
  const out: SummaryEvidence[] = [{ chip: `순응도 ${adherence}%`, phrase: `처방 대비 ${adherence}% 수행` }];
  if (m.currentGap >= 2) out.push({ chip: `연속 미접속 ${m.currentGap}일`, phrase: `${m.currentGap}일 연속 미접속` });
  else out.push({ chip: `최근 7일 접속 ${m.recentDays}일`, phrase: `최근 7일 중 ${m.recentDays}일 접속` });
  if (m.accuracyDrop >= 5) {
    const drop = Math.round(m.accuracyDrop);
    out.push({ chip: `정확도 하락 ${drop}%p`, phrase: `정확도 ${drop}%p 하락` });
  }
  if (m.sessionChange <= -0.1) {
    const pct = Math.round(-m.sessionChange * 100);
    out.push({ chip: `세션 시간 -${pct}%`, phrase: `세션 시간 ${pct}% 감소` });
  } else if (m.sessionChange >= 0.1) {
    const pct = Math.round(m.sessionChange * 100);
    out.push({ chip: `세션 시간 +${pct}%`, phrase: `세션 시간 ${pct}% 증가` });
  }
  return out;
}

/** 규칙 기반 경과 요약 문장 */
export function progressSummary(r: RiskResult): string {
  const parts = summaryEvidence(r).map((e) => e.phrase);
  const advice: Record<RiskLevel, string> = {
    정상: "처방대로 잘 진행 중이며 경과 관찰을 유지하면 됩니다.",
    주의: "사용량이 줄고 있어 가벼운 격려 연락을 고려해 보세요.",
    "이탈 위험": "동기 저하 가능성이 있어 상담을 권장합니다.",
    치료이탈: "치료가 중단된 상태로 보여 재참여를 위한 연락이 필요합니다.",
  };
  const cause = r.cause ? ` 추정 원인은 '${r.cause}'입니다.` : "";
  return `${parts.join(", ")}. ${advice[r.level]}${cause}`;
}