/**
 * 플레이 캘린더용 순수 로직 (표시 전용 — 위험 계산은 risk.ts가 담당)
 */
import { computeRisk, toDateKey, type PatientLike, type PlayLogLike, type RiskResult } from "./risk";

export interface CalendarLog extends PlayLogLike {
  tasks_completed: number;
  ended_early: boolean;
}

export interface CalendarDay {
  key: string; // YYYY-MM-DD
  day: number; // 날짜 숫자
  inWindow: boolean; // 처방 기간 안
  minutes: number;
  sessions: number;
  tasks: number;
  endedEarly: boolean;
  hasAction: boolean;
  hasAlert: boolean;
  isToday: boolean;
  isFuture: boolean;
}

const DAY = 86_400_000;

function parseKey(key: string): Date {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 처방 종료일 (시작일 포함 weeks*7일째의 마지막 날) */
export function prescriptionEndKey(patient: PatientLike): string {
  const start = parseKey(patient.prescription_start_date);
  return toDateKey(new Date(start.getTime() + (patient.prescription_weeks * 7 - 1) * DAY));
}

/** 월간 달력 칸 (월요일 시작, 앞뒤 빈 칸은 null) */
export function buildMonth(
  patient: PatientLike,
  logs: CalendarLog[],
  actionKeys: Set<string>,
  alertKeys: Set<string>,
  year: number,
  month: number, // 0-based
  todayKey: string = toDateKey(new Date()),
): (CalendarDay | null)[] {
  const startKey = patient.prescription_start_date;
  const endKey = prescriptionEndKey(patient);
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // 월요일 시작

  const byDay = new Map<string, { minutes: number; sessions: number; tasks: number; endedEarly: boolean }>();
  for (const l of logs) {
    if (l.play_minutes <= 0) continue;
    const key = toDateKey(new Date(l.session_start));
    const cur = byDay.get(key) ?? { minutes: 0, sessions: 0, tasks: 0, endedEarly: false };
    cur.minutes += l.play_minutes;
    cur.sessions += 1;
    cur.tasks += l.tasks_completed;
    cur.endedEarly = cur.endedEarly || l.ended_early;
    byDay.set(key, cur);
  }

  const cells: (CalendarDay | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toDateKey(new Date(year, month, d));
    const log = byDay.get(key);
    cells.push({
      key,
      day: d,
      inWindow: key >= startKey && key <= endKey,
      minutes: log?.minutes ?? 0,
      sessions: log?.sessions ?? 0,
      tasks: log?.tasks ?? 0,
      endedEarly: log?.endedEarly ?? false,
      hasAction: actionKeys.has(key),
      hasAlert: alertKeys.has(key),
      isToday: key === todayKey,
      isFuture: key > todayKey,
    });
  }
  return cells;
}

/** 그날까지의 기록만으로 계산한 그날의 위험 점수·단계 */
export function riskOnDay(patient: PatientLike, logs: PlayLogLike[], key: string): RiskResult {
  const end = new Date(`${key}T23:59:59`);
  return computeRisk(patient, logs.filter((l) => new Date(l.session_start) <= end), end);
}

/** 이번 주(월~오늘) 접속 일수와 주간 목표 */
export function weekProgress(logs: PlayLogLike[], targetDays: number, now: Date = new Date()) {
  const mondayKey = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)));
  const nowKey = toDateKey(now);
  const days = new Set<string>();
  for (const l of logs) {
    if (l.play_minutes <= 0) continue;
    const key = toDateKey(new Date(l.session_start));
    if (key >= mondayKey && key <= nowKey) days.add(key);
  }
  return { days: days.size, target: targetDays };
}

/** 플레이 시간 → 청록 농도 (0~1). 목표 시간이면 1 */
export function playIntensity(minutes: number, targetMinutes: number): number {
  if (minutes <= 0) return 0;
  return Math.min(1, 0.25 + (0.75 * minutes) / Math.max(1, targetMinutes));
}
