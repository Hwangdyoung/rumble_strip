/**
 * 담당자별 업무량 (순수 함수). 숫자는 DB 함수 staff_workload(SQL 008)가 센다.
 * 모두 '연락 담당' 기준 환자 수다. 위험 점수는 쓰지 않는다.
 */
export interface Workload {
  staffId: string;
  name: string;
  role: string;
  /** 연락 담당인 환자 */
  patients: number;
  /** 그중 처리 안 된 알림이 있는 환자 (새로 나빠짐) */
  newWorse: number;
  /** 그중 오늘까지 다시 연락할 환자 */
  followDue: number;
  /** 새로 나빠짐 또는 오늘 다시 연락 (겹치면 한 번) */
  todo: number;
}

/** 업무량 한 줄 요약. 예: "맡은 환자 5 · 오늘 할 일 2" */
export function workloadText(w: Workload | undefined): string {
  if (!w) return "업무량 정보 없음";
  return `맡은 환자 ${w.patients} · 오늘 할 일 ${w.todo}`;
}

/**
 * '여유' 표시할 사람: 후보 중 오늘 할 일이 가장 적은 사람(같으면 맡은 환자가 적은 사람).
 * 후보가 한 명이거나, 모두 같은 숫자면 아무도 표시하지 않는다(비교할 의미가 없음).
 * 자동으로 고르지 않고 표시만 한다.
 */
export function lightestStaff(list: Workload[], candidateIds: string[]): string[] {
  const cands = list.filter((w) => candidateIds.includes(w.staffId));
  if (cands.length < 2) return [];
  const key = (w: Workload) => [w.todo, w.patients] as const;
  const cmp = (a: Workload, b: Workload) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1];
  const best = [...cands].sort(cmp)[0]!;
  const same = cands.filter((w) => cmp(w, best) === 0);
  if (same.length === cands.length) return [];
  return same.map((w) => w.staffId);
}

/** 팀 업무량 표: 오늘 할 일 많은 순 → 맡은 환자 많은 순 → 이름 */
export function sortWorkload(list: Workload[]): Workload[] {
  return [...list].sort((a, b) => b.todo - a.todo || b.patients - a.patients || a.name.localeCompare(b.name, "ko"));
}
