/**
 * 다음 연락 예정일 (순수 함수).
 * 기본 간격은 대응 가이드 문구(response-guide.ts)와 맞춘 초기 가정치다.
 */
import { toDateKey, type RiskLevel } from "./risk";

/** 단계별 다음 연락까지 기본 일수 (정상은 예정 없음) */
export const FOLLOW_UP_DAYS: Record<RiskLevel, number | null> = {
  정상: null,
  주의: 3,
  "이탈 위험": 2,
  치료이탈: 1,
};

/** 오늘(from) 기준 기본 예정일 YYYY-MM-DD, 정상이면 "" */
export function defaultFollowUpDate(level: RiskLevel, from: Date = new Date()): string {
  const days = FOLLOW_UP_DAYS[level];
  if (days === null) return "";
  return toDateKey(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
}

export interface FollowUpLike {
  id: string;
  patient_id: string;
  due_date: string;
  assignee_id: string | null;
  done_at: string | null;
}

/** 오늘까지 해야 할(예정일이 오늘이거나 지난) 열린 일정. 오래된 순 */
export function dueFollowUps<T extends FollowUpLike>(items: T[], today: Date = new Date()): Array<T & { overdueDays: number }> {
  const key = toDateKey(today);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return items
    .filter((f) => !f.done_at && f.due_date <= key)
    .map((f) => {
      const [y, m, d] = f.due_date.split("-").map(Number);
      return { ...f, overdueDays: Math.round((t0 - new Date(y!, m! - 1, d!).getTime()) / 86_400_000) };
    })
    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
}

/** 환자별 가장 가까운 열린 예정일 (보호자 안내문 '다음 연락 예정'에 씀) */
export function nextFollowUpDate(items: FollowUpLike[], patientId: string): string | null {
  const open = items.filter((f) => f.patient_id === patientId && !f.done_at).map((f) => f.due_date).sort();
  return open[0] ?? null;
}
