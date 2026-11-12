import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, BellRing, MessageSquareText, Phone, StickyNote } from "lucide-react";
import { AlertOutcomePicker } from "@/components/AlertOutcome";
import { alertHandoffsQuery, staffListQuery } from "@/lib/queries";
import { suggestOutcome } from "@/lib/alert-outcome";
import type { CalendarLog } from "@/lib/calendar";

type AlertItem = { id: string; message: string; status: string; created_at: string; outcome: string; outcome_note: string | null; alert_level: string | null };
type ActionItem = { id: string; action_type: string; memo: string | null; created_at: string; staff_id?: string | null };

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * 환자 상세 '연락 이력': 새로 나빠짐(알림), 연락 기록(조치), 넘긴 기록을 시간 순(최신 먼저)으로 한 줄씩.
 * 새로 나빠짐 줄에서 그 뒤 결과(회복·이탈·연락 불가)를 기록한다(점수 검증용).
 */
export function ContactHistory({
  patientId,
  alerts,
  actions,
  logs,
  limited = false,
}: {
  patientId: string;
  alerts: AlertItem[];
  actions: ActionItem[];
  logs: CalendarLog[];
  /** 상담원: 결과는 미정·연락 불가만, '회복' 제안 없음 */
  limited?: boolean;
}) {
  const { data: handoffs = [] } = useQuery(alertHandoffsQuery(patientId));
  const { data: staff = [] } = useQuery(staffListQuery());
  const name = (id: string | null | undefined) => (id ? (staff.find((s) => s.id === id)?.name ?? "알 수 없음") : "알 수 없음");

  const items = [
    ...alerts.map((a) => ({ kind: "alert" as const, at: a.created_at, a })),
    ...actions.map((a) => ({ kind: "action" as const, at: a.created_at, a })),
    ...handoffs.map((h) => ({ kind: "handoff" as const, at: h.created_at, h })),
  ].sort((x, y) => (x.at < y.at ? 1 : -1));

  if (items.length === 0) return <p className="text-muted-foreground">아직 연락 이력이 없습니다. '연락 기록하기'로 첫 기록을 남겨 보세요.</p>;

  return (
    <ol className="space-y-3">
      {items.map((it) => (
        <li key={`${it.kind}-${it.kind === "handoff" ? it.h.id : it.a.id}`} className="flex gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden>
            {it.kind === "alert" ? <BellRing className="size-4 text-level-risk" /> : it.kind === "handoff" ? <ArrowRightLeft className="size-4" /> : it.a.action_type === "문자" ? <MessageSquareText className="size-4" /> : it.a.action_type === "전화 상담" ? <Phone className="size-4" /> : <StickyNote className="size-4" />}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5 border-b pb-3">
            <p className="text-xs text-muted-foreground">{when(it.at)}</p>
            {it.kind === "alert" && (
              <>
                <p>
                  <span className="mr-1.5 rounded-full bg-level-risk-soft px-2 py-0.5 text-xs font-semibold text-level-risk">새로 나빠짐</span>
                  {it.a.message}
                </p>
                <AlertOutcomePicker
                  alertId={it.a.id}
                  patientId={patientId}
                  outcome={it.a.outcome}
                  note={it.a.outcome_note}
                  suggestion={!limited && it.a.outcome === "미정" ? suggestOutcome(it.a.created_at, logs) : null}
                  limited={limited}
                  compact
                />
              </>
            )}
            {it.kind === "action" && (
              <p className="break-words">
                <span className="font-semibold">{it.a.action_type}</span>
                {it.a.staff_id && <span className="text-muted-foreground"> · {name(it.a.staff_id)}</span>}
                {it.a.memo ? <span className="block whitespace-pre-line text-sm">{it.a.memo}</span> : <span className="text-muted-foreground"> · 메모 없음</span>}
              </p>
            )}
            {it.kind === "handoff" && (
              <p>
                연락 담당 넘김 <b>{name(it.h.from_staff)}</b> → <b>{name(it.h.to_staff)}</b>
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold">{it.h.reason}</span>
                {it.h.note && <span className="block text-sm">{it.h.note}</span>}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
