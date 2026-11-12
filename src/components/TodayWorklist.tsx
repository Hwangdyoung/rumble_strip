import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRightLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/components/LevelBadge";
import { alertStatusStyle } from "@/components/AlertsBell";
import { completeFollowUps, followUpsQuery, myStaffQuery, staffListQuery, worklistQuery } from "@/lib/queries";
import { RISK_LEVELS, type RiskLevel } from "@/lib/risk";
import { buildWorklist, overCapacity, type WorkSort, type WorkTab } from "@/lib/worklist";
import { dueFollowUps } from "@/lib/follow-up";
import { buildWorkSheetHtml } from "@/lib/work-sheet";
import { setPreferences, usePreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

type Tab = WorkTab | "follow";
const TAB_LABEL: Record<Tab, string> = { mine: "내 담당", unassigned: "미지정", all: "전체", follow: "다시 연락" };

/** 대시보드 '오늘 업무 → 처리할 알림'. 알림 목록과 오늘 다시 연락할 환자, 정렬, 업무량 경고, 인쇄. */
export function TodayWorklist({ embedded = false }: { compact?: boolean; embedded?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: alerts, isPending, isError } = useQuery(worklistQuery());
  const { data: follows = [] } = useQuery(followUpsQuery());
  const { data: staff = [] } = useQuery(staffListQuery());
  const { data: me } = useQuery(myStaffQuery());
  const myId = me?.staff?.id ?? null;
  const [tab, setTab] = useState<Tab>("mine");
  const prefs = usePreferences();
  const done = useMutation({
    mutationFn: (id: string) => completeFollowUps([id]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
      toast.success("다시 연락을 완료로 표시했습니다.");
    },
    onError: () => toast.error("완료 처리하지 못했습니다."),
  });

  if (isPending) return <p className="py-4 text-sm text-muted-foreground" role="status">오늘 처리할 알림을 불러오는 중…</p>;
  if (isError) return <p className="py-4 text-sm">오늘 처리할 알림을 불러오지 못했습니다.</p>;

  const w = buildWorklist(alerts, myId, new Date(), prefs.overdueDays, prefs.alertSort);
  const due = dueFollowUps(follows);
  const nameOf = (id: string | null) => (id === null ? "미지정" : (staff.find((s) => s.id === id)?.name ?? "알 수 없음"));
  const open = (patientId: string) => navigate({ to: "/dashboard", search: { patient: patientId }, resetScroll: false });
  const over = overCapacity(w.items.mine.length, prefs.myAlertCapacity);
  const counts: Record<Tab, number> = { mine: w.items.mine.length, unassigned: w.items.unassigned.length, all: w.items.all.length, follow: due.length };

  function print() {
    const list = tab === "follow" ? w.items.all : w.items[tab];
    const html = buildWorkSheetHtml({
      title: tab === "mine" ? `${me?.staff?.name ?? "내"} 담당` : tab === "unassigned" ? "담당 미지정" : "전체",
      alerts: list.map((a) => ({
        patient: a.patient_name,
        level: a.alert_level,
        status: a.status,
        assignee: nameOf(a.assignee_id),
        ageDays: a.ageDays,
        overdue: a.overdue,
        handoffNote: a.handoff ? `${nameOf(a.handoff.from_staff)} · ${a.handoff.reason}${a.handoff.note ? ` · ${a.handoff.note}` : ""}` : null,
      })),
      followUps: (tab === "mine" ? due.filter((f) => f.assignee_id === myId) : due).map((f) => ({
        patient: f.patient_name,
        dueDate: f.due_date,
        overdueDays: f.overdueDays,
        assignee: nameOf(f.assignee_id),
      })),
    });
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      toast.error("새 창을 열지 못했습니다. 팝업 차단을 확인해 주세요.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.setTimeout(() => win.print(), 300);
  }

  return (
    <section className={cn("space-y-3", !embedded && "rounded-2xl border bg-card p-5 shadow-card")} aria-label="오늘 처리할 알림">
      {over > 0 && (
        <p className="rounded-lg bg-level-caution-soft px-3 py-2 text-sm text-level-caution-ink">
          내 담당이 {w.items.mine.length}건으로, 하루 처리 가능 수({prefs.myAlertCapacity}건)보다 {over}건 많아요. 알림의 '넘기기'로 다른 담당자에게 넘기는 걸 검토해 보세요.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="처리할 알림 구분">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <Button
              key={t}
              variant="outline"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("h-auto rounded-full px-3 py-1.5 text-sm", tab === t ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
            >
              {TAB_LABEL[t]} <span className={cn("tabular-nums", tab === t ? "opacity-80" : "text-muted-foreground")}>{counts[t]}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {tab !== "follow" && (
            <select
              value={prefs.alertSort}
              onChange={(e) => setPreferences({ alertSort: e.target.value as WorkSort })}
              className="h-8 rounded-md border border-input bg-card px-2 text-sm"
              aria-label="정렬"
            >
              <option value="oldest">오래된 순</option>
              <option value="score">위험 높은 순</option>
            </select>
          )}
          <Button variant="ghost" size="sm" onClick={print} aria-label="오늘 업무 목록 인쇄"><Printer /> 인쇄</Button>
        </div>
      </div>

      {tab === "follow" ? (
        due.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">오늘 다시 연락할 환자가 없습니다. 조치 기록 때 '다음 연락 예정일'을 정하면 그날 여기에 나타납니다.</p>
        ) : (
          <ul className="divide-y">
            {due.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2.5">
                <button type="button" onClick={() => open(f.patient_id)} className="min-w-0 flex-1 text-left font-semibold hover:underline">{f.patient_name}</button>
                <span className="text-sm text-muted-foreground">
                  {Number(f.due_date.slice(5, 7))}/{Number(f.due_date.slice(8))} 예정
                  {f.overdueDays > 0 && <span className="ml-1.5 rounded-full bg-level-risk-soft px-1.5 py-0.5 text-xs font-semibold text-level-risk">{f.overdueDays}일 지남</span>}
                </span>
                <span className="text-sm">{nameOf(f.assignee_id)}</span>
                <Button variant="outline" size="sm" disabled={done.isPending} onClick={() => done.mutate(f.id)}>완료</Button>
              </li>
            ))}
          </ul>
        )
      ) : w.items[tab].length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {tab === "mine" ? "내가 맡은 처리할 알림이 없습니다." : tab === "unassigned" ? "담당자가 정해지지 않은 알림이 없습니다." : "처리할 알림이 없습니다."}
        </p>
      ) : (
        <ul className="divide-y">
          {w.items[tab].map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => open(a.patient_id)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 text-left hover:bg-muted sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_auto]"
              >
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {a.patient_name}
                  {a.alert_level && RISK_LEVELS.includes(a.alert_level as RiskLevel) && <LevelBadge level={a.alert_level as RiskLevel} />}
                  {prefs.alertSort === "score" && a.alert_score != null && <span className="text-sm font-normal text-muted-foreground tabular-nums">{a.alert_score}점</span>}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", alertStatusStyle[a.status])}>{a.status}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} 알림 · {a.ageDays === 0 ? "오늘" : `${a.ageDays}일 지남`}
                  {a.overdue && <span className="ml-1.5 rounded-full bg-level-risk-soft px-1.5 py-0.5 text-xs font-semibold text-level-risk">지연</span>}
                </span>
                <span className={cn("text-sm", a.assignee_id ? "" : "font-medium text-level-risk")}>{nameOf(a.assignee_id)}</span>
                {a.handoff && (
                  <span className="col-span-full flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowRightLeft className="size-3.5" /> 넘겨받음: {nameOf(a.handoff.from_staff)} · {a.handoff.reason}
                    {a.handoff.note && ` · ${a.handoff.note}`}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {w.byAssignee.length > 0 && tab !== "follow" && (
        <p className="border-t pt-3 text-sm text-muted-foreground">
          담당자별 남은 알림:{" "}
          {w.byAssignee.map((b, i) => (
            <span key={b.assigneeId ?? "none"}>
              {i > 0 && " · "}
              <span className={b.assigneeId === null ? "text-level-risk" : ""}>{nameOf(b.assigneeId)}</span> {b.count}
            </span>
          ))}
          <span className="ml-2">· 오늘 처리 완료 {w.doneToday}건</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        알림 후 {prefs.overdueDays}일 이상 처리되지 않으면 '지연'으로 표시합니다(설정 → 업무에서 변경). 알림을 누르면 환자 상세가 열립니다.
      </p>
    </section>
  );
}
