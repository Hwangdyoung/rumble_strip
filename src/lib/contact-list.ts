/**
 * '오늘 연락할 환자' 목록 (순수 함수). 환자 한 줄 = 할 일 하나.
 *
 * 들어가는 환자: 정상이 아니고 알림 기준 점수 이상 / 새로 나빠짐(처리 안 된 알림) / 오늘까지 다시 연락하기로 한 환자.
 * 위험 점수는 risk.ts 결과를 그대로 쓴다. 여기서 점수를 계산하지 않는다.
 */
import { toDateKey, type RiskLevel, type RiskResult } from "./risk";

export type ContactStatus = "다시 연락" | "연락 전" | "연락 불가" | "연락 예정" | "연락함" | "경과 관찰";

export interface ContactInput {
  patients: Array<{ id: string; name: string; age: number; risk: RiskResult }>;
  threshold: number;
  /** 볼 수 있는 환자의 알림 전체 */
  alerts: Array<{ id: string; patient_id: string; created_at: string; status: string; outcome: string; outcome_at: string | null }>;
  /** 열린 다음 연락 일정 */
  followUps: Array<{ patient_id: string; due_date: string }>;
  /** 환자별 마지막 조치 시각 */
  lastActionAt: Record<string, string>;
  /** 환자별 연락 담당 */
  contactOf: Record<string, string>;
  now?: Date;
  /** true면 연락 대상이 아닌 환자(정상 등)도 '경과 관찰'로 넣는다 (전체 보기) */
  includeAll?: boolean;
}

export interface ContactRow {
  patientId: string;
  name: string;
  age: number;
  level: RiskLevel;
  /** 위험 점수 (상담원 화면에서는 null: 점수를 보내지 않음) */
  score: number | null;
  reason: string;
  /** 처리 안 된 '새로 나빠짐' 알림이 있으면 그 시각 */
  newWorseAt: string | null;
  /** 오늘까지인 다시 연락 (지난 일수 포함) */
  followDue: { dueDate: string; overdueDays: number } | null;
  /** 앞으로 잡힌 다음 연락 */
  nextFollow: string | null;
  status: ContactStatus;
  /** 상태 옆에 붙일 날짜 (연락함·연락 예정) */
  statusDate: string | null;
  contactId: string | null;
  /** 지금 손이 가야 하는 줄인지 (다시 연락·연락 전·연락 불가) */
  needsAction: boolean;
  /** 오늘 연락 대상인지 (아니면 전체 보기에서만 보임) */
  inToday: boolean;
}

const LEVEL_RANK: Record<RiskLevel, number> = { 치료이탈: 0, "이탈 위험": 1, 주의: 2, 정상: 3 };
const RECENT_DAYS = 7;

function daysBetween(fromKey: string, to: Date) {
  const [y, m, d] = fromKey.split("-").map(Number);
  const a = new Date(y!, m! - 1, d!).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function buildContactList(input: ContactInput): ContactRow[] {
  const now = input.now ?? new Date();
  const today = toDateKey(now);
  const rows: ContactRow[] = [];

  for (const p of input.patients) {
    const mine = input.alerts.filter((a) => a.patient_id === p.id);
    const open = mine.filter((a) => a.status !== "조치완료").sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const latest = [...mine].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    const follows = input.followUps.filter((f) => f.patient_id === p.id).map((f) => f.due_date).sort();
    const dueKey = follows.find((d) => d <= today) ?? null;
    const nextFollow = follows.find((d) => d > today) ?? null;
    const lastAction = input.lastActionAt[p.id] ?? null;

    const inList = (p.risk.level !== "정상" && p.risk.score >= input.threshold) || open.length > 0 || dueKey !== null;
    if (!inList && !input.includeAll) continue;

    let status: ContactStatus;
    let statusDate: string | null = null;
    if (!inList) status = "경과 관찰";
    else if (dueKey) status = "다시 연락";
    else if (latest?.outcome === "연락 불가" && (!lastAction || (latest.outcome_at ?? "") >= lastAction)) status = "연락 불가";
    else if (nextFollow) {
      status = "연락 예정";
      statusDate = nextFollow;
    } else if (
      lastAction &&
      (!open[0] || lastAction > open[0].created_at) &&
      daysBetween(toDateKey(new Date(lastAction)), now) < RECENT_DAYS
    ) {
      status = "연락함";
      statusDate = toDateKey(new Date(lastAction));
    } else status = "연락 전";

    rows.push({
      patientId: p.id,
      name: p.name,
      age: p.age,
      level: p.risk.level,
      score: p.risk.score,
      reason: p.risk.reasons[0] ?? "",
      newWorseAt: open[0]?.created_at ?? null,
      followDue: dueKey ? { dueDate: dueKey, overdueDays: daysBetween(dueKey, now) } : null,
      nextFollow,
      status,
      statusDate,
      contactId: input.contactOf[p.id] ?? null,
      needsAction: status === "다시 연락" || status === "연락 전" || status === "연락 불가",
      inToday: inList,
    });
  }

  // 오늘 대상 먼저 → 손이 가야 하는 줄 → 새로 나빠짐 → 단계(치료이탈·이탈 위험·주의) → 점수 높은 순
  return rows.sort(
    (a, b) =>
      Number(b.inToday) - Number(a.inToday) ||
      Number(b.needsAction) - Number(a.needsAction) ||
      Number(Boolean(b.newWorseAt)) - Number(Boolean(a.newWorseAt)) ||
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
      (b.score ?? 0) - (a.score ?? 0),
  );
}

export type ContactFilter = "new" | "todo" | "follow" | "unassigned";

/** 요약 숫자 4칸 (오늘 대상 기준) */
export function contactSummary(rows: ContactRow[]) {
  const today = rows.filter((r) => r.inToday);
  return {
    new: today.filter((r) => r.newWorseAt).length,
    todo: today.filter((r) => r.status === "연락 전").length,
    follow: today.filter((r) => r.followDue).length,
    unassigned: today.filter((r) => !r.contactId).length,
  };
}

export function matchFilter(r: ContactRow, f: ContactFilter | null): boolean {
  if (!f) return true;
  if (f === "new") return Boolean(r.newWorseAt);
  if (f === "todo") return r.status === "연락 전";
  if (f === "follow") return Boolean(r.followDue);
  return !r.contactId;
}
