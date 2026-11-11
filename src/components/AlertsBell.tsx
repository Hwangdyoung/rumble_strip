import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { alertsQuery, setAlertStatus } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertOutcomePicker } from "@/components/AlertOutcome";
import { AlertAssignee } from "@/components/AlertAssignee";

export const alertStatusStyle: Record<string, string> = {
  미확인: "bg-level-risk-soft text-level-risk",
  확인: "bg-level-caution-soft text-level-caution-ink",
  조치완료: "bg-level-normal-soft text-level-normal",
};

export function AlertsBell() {
  const { data: alerts = [] } = useQuery(alertsQuery());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = alerts.filter((a) => a.status === "미확인").length;

  async function openAlert(a: (typeof alerts)[number]) {
    try {
      if (a.status === "미확인") await setAlertStatus(a.id, "확인");
    } catch {
      toast.error("알림 상태를 바꾸지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["alerts"] });
    qc.invalidateQueries({ queryKey: ["patient", a.patient_id] });
    setOpen(false);
    navigate({ to: "/dashboard", search: { patient: a.patient_id }, resetScroll: false });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label={`알림 ${unread}건`} className="relative grid size-10 place-items-center rounded-full bg-card hover:bg-muted">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-level-risk px-1 text-xs font-bold text-primary-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="border-b px-4 py-3 font-bold">알림 <span className="text-sm font-medium text-muted-foreground">미확인 {unread}건</span></div>
        <ul className="max-h-96 divide-y overflow-y-auto">
          {alerts.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">알림이 없습니다.</li>}
          {alerts.map((a) => (
            <li key={a.id} className={cn(a.status === "미확인" && "bg-secondary")}>
              <Button variant="ghost" onClick={() => openAlert(a)} className="block h-auto w-full whitespace-normal rounded-none px-4 pb-2 pt-3 text-left font-normal hover:bg-muted">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{a.patients?.name}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", alertStatusStyle[a.status])}>{a.status}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("ko-KR")}</p>
              </Button>
              <div className="px-4 pb-3">
                <div className="space-y-2">
                  <AlertAssignee alertId={a.id} patientId={a.patient_id} assigneeId={a.assignee_id} compact />
                  <AlertOutcomePicker alertId={a.id} patientId={a.patient_id} outcome={a.outcome} suggestion={a.suggestion} compact />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
