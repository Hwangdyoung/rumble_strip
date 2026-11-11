import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/components/LevelBadge";
import { alertStatusStyle } from "@/components/AlertsBell";
import { myStaffQuery, staffListQuery, worklistQuery } from "@/lib/queries";
import { RISK_LEVELS, type RiskLevel } from "@/lib/risk";
import { buildWorklist, OVERDUE_DAYS, type WorkTab } from "@/lib/worklist";
import { cn } from "@/lib/utils";

const TAB_LABEL: Record<WorkTab, string> = { mine: "내 담당", unassigned: "미지정", all: "전체" };

/** 대시보드 '오늘 처리할 알림'. compact(분할 화면)면 한 줄 요약으로 접는다. */
export function TodayWorklist({ compact = false, embedded = false }: { compact?: boolean; embedded?: boolean }) {
  const navigate = useNavigate();
  const { data: alerts, isPending, isError } = useQuery(worklistQuery());
  const { data: staff = [] } = useQuery(staffListQuery());
  const { data: me } = useQuery(myStaffQuery());
  const myId = me?.staff?.id ?? null;
  const [tab, setTab] = useState<WorkTab>("mine");
  const [expanded, setExpanded] = useState(false);

  if (isPending) return <section className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-card" role="status">오늘 처리할 알림을 불러오는 중…</section>;
  if (isError) return <section className="rounded-2xl border bg-card px-4 py-3 text-sm shadow-card">오늘 처리할 알림을 불러오지 못했습니다.</section>;

  const w = buildWorklist(alerts, myId);
  const nameOf = (id: string | null) => (id === null ? "미지정" : (staff.find((s) => s.id === id)?.name ?? "알 수 없음"));
  const open = (patientId: string) => navigate({ to: "/dashboard", search: { patient: patientId }, resetScroll: false });

  if (compact && !expanded) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-3 shadow-card" aria-label="오늘 처리할 알림 요약">
        <p className="text-sm">
          <span className="font-semibold">오늘 처리할 알림 {w.items.all.length}건</span>
          <span className="text-muted-foreground"> · 내 담당 {w.items.mine.length}건{w.overdueCount > 0 ? ` · 지연 ${w.overdueCount}건` : ""}</span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
          펼치기 <ChevronDown className="size-4" />
        </Button>
      </section>
    );
  }

  const rows = w.items[tab];
  return (
    <section className={cn("space-y-3", !embedded && "rounded-2xl border bg-card p-5 shadow-card")} aria-label="오늘 처리할 알림">
      <div className={cn("flex flex-wrap items-baseline justify-between gap-2", embedded && "hidden")}>
        <h2 className="text-lg font-bold">오늘 처리할 알림</h2>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">오늘 처리 완료 {w.doneToday}건</p>
          {compact && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
              접기 <ChevronUp className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="알림 담당 구분">
        {(Object.keys(TAB_LABEL) as WorkTab[]).map((t) => (
          <Button
            key={t}
            variant="outline"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("h-auto rounded-full px-3 py-1.5 text-sm", tab === t ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
          >
            {TAB_LABEL[t]} <span className={cn("tabular-nums", tab === t ? "opacity-80" : "text-muted-foreground")}>{w.items[t].length}</span>
          </Button>
        ))}
      </div>
      {embedded && <p className="text-sm text-muted-foreground">오늘 처리 완료 {w.doneToday}건</p>}
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {tab === "mine" ? "내가 맡은 처리할 알림이 없습니다." : tab === "unassigned" ? "담당자가 정해지지 않은 알림이 없습니다." : "처리할 알림이 없습니다."}
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => open(a.patient_id)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 text-left hover:bg-muted sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_auto]"
              >
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {a.patient_name}
                  {a.alert_level && RISK_LEVELS.includes(a.alert_level as RiskLevel) && <LevelBadge level={a.alert_level as RiskLevel} />}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", alertStatusStyle[a.status])}>{a.status}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} 알림 · {a.ageDays === 0 ? "오늘" : `${a.ageDays}일 지남`}
                  {a.overdue && <span className="ml-1.5 rounded-full bg-level-risk-soft px-1.5 py-0.5 text-xs font-semibold text-level-risk">지연</span>}
                </span>
                <span className={cn("text-sm", a.assignee_id ? "" : "font-medium text-level-risk")}>{nameOf(a.assignee_id)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {w.byAssignee.length > 0 && (
        <p className="border-t pt-3 text-sm text-muted-foreground">
          담당자별 남은 알림:{" "}
          {w.byAssignee.map((b, i) => (
            <span key={b.assigneeId ?? "none"}>
              {i > 0 && " · "}
              <span className={b.assigneeId === null ? "text-level-risk" : ""}>{nameOf(b.assigneeId)}</span> {b.count}
            </span>
          ))}
        </p>
      )}
      <p className="text-xs text-muted-foreground">알림 후 {OVERDUE_DAYS}일 이상 처리되지 않으면 '지연'으로 표시합니다(초기 가정치). 알림을 누르면 환자 상세가 열립니다.</p>
    </section>
  );
}
