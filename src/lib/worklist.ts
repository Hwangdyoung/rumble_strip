/**
 * 오늘 처리할 알림 목록 (순수 함수). 위험 점수 계산은 하지 않는다.
 * - 처리 대상: 상태가 '조치완료'가 아닌 알림
 * - 오래된 알림부터, 알림 후 OVERDUE_DAYS일 이상 지나면 '지연'
 */
import { toDateKey } from "./risk";

/** '지연' 기본 기준 (초기 가정치, 설정 → 업무에서 바꿀 수 있음) */
export const OVERDUE_DAYS = 2;
const DAY = 86_400_000;

export interface WorkAlert {
  id: string;
  patient_id: string;
  patient_name: string;
  created_at: string;
  status: string;
  alert_level: string | null;
  assignee_id: string | null;
  resolved_at: string | null;
}

export interface WorkItem extends WorkAlert {
  ageDays: number;
  overdue: boolean;
}

export type WorkTab = "mine" | "unassigned" | "all";

export interface Worklist {
  items: Record<WorkTab, WorkItem[]>;
  /** 담당자별 남은 건수 (assigneeId null = 미지정), 많은 순 */
  byAssignee: Array<{ assigneeId: string | null; count: number }>;
  overdueCount: number;
  doneToday: number;
}

export function buildWorklist(alerts: WorkAlert[], myId: string | null, now: Date = new Date(), overdueDays: number = OVERDUE_DAYS): Worklist {
  const today = toDateKey(now);
  const open = alerts
    .filter((a) => a.status !== "조치완료")
    .map((a) => {
      const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(a.created_at).getTime()) / DAY));
      return { ...a, ageDays, overdue: ageDays >= overdueDays };
    })
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));

  const counts = new Map<string | null, number>();
  for (const a of open) counts.set(a.assignee_id, (counts.get(a.assignee_id) ?? 0) + 1);

  return {
    items: {
      mine: myId ? open.filter((a) => a.assignee_id === myId) : [],
      unassigned: open.filter((a) => a.assignee_id === null),
      all: open,
    },
    byAssignee: [...counts.entries()]
      .map(([assigneeId, count]) => ({ assigneeId, count }))
      .sort((a, b) => b.count - a.count || (a.assigneeId === null ? 1 : b.assigneeId === null ? -1 : 0)),
    overdueCount: open.filter((a) => a.overdue).length,
    doneToday: alerts.filter((a) => a.status === "조치완료" && a.resolved_at && toDateKey(new Date(a.resolved_at)) === today).length,
  };
}
