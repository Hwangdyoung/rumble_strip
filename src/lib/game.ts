// 조원이 만든 '스타러커스 체험 게임' 코드를 가져옴(2026-11-17, AI-DB-PROJECT-main/rumble_strip-play). 내용은 그대로.
/**
 * 환자용 기억 게임(N-back) 규칙과 채점
 *
 * - 그림이 하나씩 나오고, N개 전에 나온 그림과 같으면 '같아요'를 누른다.
 * - 처음 N개는 비교할 대상이 없어서 채점하지 않는다.
 * - 결과는 play_logs 한 줄(세션)로 바뀐다. 위험 점수 계산은 risk.ts가 맡고, 여기서는 하지 않는다.
 * - 화면·DB와 무관한 순수 함수만 둔다(테스트: game.test.ts).
 */

export const GAME_CONFIG = {
  /** 한 과제(블록)의 문항 수. 블록을 끝까지 마치면 tasks_completed가 1 오른다 */
  trialsPerBlock: 20,
  /** 그림이 보이는 시간(ms) */
  stimulusMs: 1600,
  /** 다음 그림까지 빈 화면(ms) */
  gapMs: 700,
  /** 정답(같은 그림)이 나올 비율 */
  targetRate: 0.3,
  /** 세션 길이 선택지(분). 30분은 처방 기준 */
  sessionMinutes: [2, 30] as const,
};

export type NBack = 1 | 2;

/** 게임에 쓰는 그림 8종 (화면에서 SVG로 그림) */
export const SYMBOLS = ["star", "moon", "planet", "rocket", "comet", "ufo", "sun", "gem"] as const;
export type SymbolId = (typeof SYMBOLS)[number];
export const SYMBOL_LABEL: Record<SymbolId, string> = {
  star: "별",
  moon: "달",
  planet: "행성",
  rocket: "로켓",
  comet: "혜성",
  ufo: "비행접시",
  sun: "해",
  gem: "보석",
};

export interface Trial {
  symbol: SymbolId;
  /** N개 전 그림과 같은지 (처음 N개는 항상 false, 채점 제외) */
  isTarget: boolean;
  scored: boolean;
}

/** 같은 입력이면 항상 같은 결과를 내는 간단한 난수 */
export function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 한 블록의 문항 순서를 만든다. 정답 비율은 targetRate에 맞춘다 */
export function makeBlock(n: NBack, rand: () => number = Math.random, length = GAME_CONFIG.trialsPerBlock): Trial[] {
  const trials: Trial[] = [];
  for (let i = 0; i < length; i++) {
    const scored = i >= n;
    const back = scored ? trials[i - n]!.symbol : null;
    if (back && rand() < GAME_CONFIG.targetRate) {
      trials.push({ symbol: back, isTarget: true, scored });
      continue;
    }
    // 정답이 아닌 문항: N개 전 그림과 다른 그림을 고른다
    let symbol: SymbolId;
    do symbol = SYMBOLS[Math.floor(rand() * SYMBOLS.length)]!;
    while (symbol === back);
    trials.push({ symbol, isTarget: false, scored });
  }
  return trials;
}

export type Outcome = "hit" | "miss" | "falseAlarm" | "correctReject";

/** 한 문항의 판정. 누른 시점(ms)이 있으면 '같아요'를 누른 것 */
export function judge(trial: Trial, pressedAfterMs: number | null): Outcome | null {
  if (!trial.scored) return null;
  const pressed = pressedAfterMs !== null;
  if (trial.isTarget) return pressed ? "hit" : "miss";
  return pressed ? "falseAlarm" : "correctReject";
}

export interface Response {
  outcome: Outcome;
  /** 누른 문항이면 그림이 나온 뒤 누르기까지 걸린 시간(ms) */
  rtMs: number | null;
}

export interface SessionSummary {
  scoredTrials: number;
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejects: number;
  /** 정확도(%) = (맞힌 같아요 + 맞게 넘긴 문항) / 채점 문항. 소수 첫째 자리 */
  accuracy: number | null;
  /** 같은 그림을 맞힌 문항의 평균 반응 시간(ms) */
  reactionMs: number | null;
}

export function summarize(responses: Response[]): SessionSummary {
  const count = (o: Outcome) => responses.filter((r) => r.outcome === o).length;
  const hits = count("hit");
  const correctRejects = count("correctReject");
  const scoredTrials = responses.length;
  const hitRts = responses.filter((r) => r.outcome === "hit" && r.rtMs !== null).map((r) => r.rtMs!);
  return {
    scoredTrials,
    hits,
    misses: count("miss"),
    falseAlarms: count("falseAlarm"),
    correctRejects,
    accuracy: scoredTrials ? Math.round(((hits + correctRejects) / scoredTrials) * 1000) / 10 : null,
    reactionMs: hitRts.length ? Math.round(hitRts.reduce((a, b) => a + b, 0) / hitRts.length) : null,
  };
}

/** 실제로 플레이한 시간(ms, 일시정지 제외)을 play_minutes로. 1분 미만도 접속 기록이 남도록 최소 1분 */
export function toPlayMinutes(activeMs: number) {
  return Math.max(1, Math.round(activeMs / 60_000));
}

export interface PlayLogInsert {
  patient_id: string;
  session_start: string;
  session_end: string;
  play_minutes: number;
  tasks_completed: number;
  ended_early: boolean;
  accuracy: number | null;
  reaction_ms: number | null;
}

/** 세션 결과를 play_logs 한 줄로. 채점한 문항이 하나도 없으면 저장하지 않는다(null) */
export function toPlayLog(input: {
  patientId: string;
  startedAt: Date;
  endedAt: Date;
  activeMs: number;
  blocksCompleted: number;
  endedEarly: boolean;
  summary: SessionSummary;
}): PlayLogInsert | null {
  if (input.summary.scoredTrials === 0) return null;
  return {
    patient_id: input.patientId,
    session_start: input.startedAt.toISOString(),
    session_end: input.endedAt.toISOString(),
    play_minutes: toPlayMinutes(input.activeMs),
    tasks_completed: input.blocksCompleted,
    ended_early: input.endedEarly,
    accuracy: input.summary.accuracy,
    reaction_ms: input.summary.reactionMs,
  };
}

/** 오늘 날짜 기준 처방 진행 상황 (환자 화면용. 위험 점수는 보여주지 않는다) */
export function prescriptionProgress(
  patient: { prescription_start_date: string; prescription_weeks: number; weekly_target_days: number },
  playDates: string[],
  today: Date = new Date(),
) {
  const [y, m, d] = patient.prescription_start_date.split("-").map(Number);
  const start = new Date(y!, m! - 1, d!);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const totalDays = patient.prescription_weeks * 7;
  const dayNumber = Math.floor((startOfToday.getTime() - start.getTime()) / 86_400_000) + 1;
  const weekIndex = Math.max(0, Math.floor((dayNumber - 1) / 7));
  const weekStart = new Date(start.getTime() + weekIndex * 7 * 86_400_000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const key = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const unique = Array.from(new Set(playDates));
  const thisWeek = unique.filter((k) => k >= key(weekStart) && k < key(weekEnd)).length;
  return {
    dayNumber,
    totalDays,
    status: dayNumber < 1 ? ("before" as const) : dayNumber > totalDays ? ("ended" as const) : ("active" as const),
    weekNumber: weekIndex + 1,
    playedThisWeek: thisWeek,
    weeklyTarget: patient.weekly_target_days,
    playedToday: unique.includes(key(startOfToday)),
  };
}
