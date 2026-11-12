import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  alertHandoffsQuery,
  handoffAlert,
  HANDOFF_REASONS,
  myStaffQuery,
  patientStaffQuery,
  staffListQuery,
  type HandoffReason,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

/** 알림 넘기기 버튼 + 창: 받는 사람(그 환자 담당자), 이유, 메모 */
export function HandoffButton({ alertId, patientId, assigneeId }: { alertId: string; patientId: string; assigneeId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: staff = [] } = useQuery(patientStaffQuery(patientId));
  const { data: me } = useQuery(myStaffQuery());
  const options = staff.filter((s) => s.id !== assigneeId);
  const [to, setTo] = useState("");
  const [reason, setReason] = useState<HandoffReason>("인계");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) return;
    setTo(options[0]?.id ?? "");
    setReason("인계");
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const m = useMutation({
    mutationFn: () => handoffAlert({ alertId, patientId, toStaff: to, reason, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      const name = staff.find((s) => s.id === to)?.name ?? "";
      toast.success(`${name}님에게 넘겼습니다.`);
      setOpen(false);
    },
    onError: () => toast.error("넘기지 못했습니다. 다시 시도해 주세요."),
  });

  // 담당자가 나 말고 없으면 넘길 사람이 없다
  if (options.length === 0 || !me?.staff) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (to) m.mutate();
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setOpen(true)}>
        <ArrowRightLeft /> 넘기기
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl">알림 넘기기</DialogTitle>
              <DialogDescription>받는 사람이 이 알림의 담당자가 되고, 넘긴 기록과 메모가 남습니다.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="handoff-to" className="text-base">받는 사람</Label>
              <select
                id="handoff-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-base"
              >
                {options.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role}{s.is_contact ? "·연락 담당" : ""})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-base">이유</Label>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="넘기는 이유">
                {HANDOFF_REASONS.map((r) => (
                  <Button
                    key={r}
                    type="button"
                    variant="outline"
                    role="radio"
                    aria-checked={reason === r}
                    onClick={() => setReason(r)}
                    className={cn("h-auto min-h-11 whitespace-normal px-2", reason === r && "border-primary bg-secondary ring-2 ring-primary")}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="handoff-note" className="text-base">메모</Label>
              <Textarea
                id="handoff-note"
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={reason === "의사 확인 요청" ? "예: 정확도가 계속 떨어져서 난이도 검토 부탁드려요" : "예: 오후에 보호자와 통화 약속, 아직 연결 안 됨"}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="h-11" disabled={!to || m.isPending}>{m.isPending ? "넘기는 중…" : "넘기기"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 한 알림의 넘긴 기록 */
export function HandoffHistory({ alertId, patientId }: { alertId: string; patientId: string }) {
  const { data = [] } = useQuery(alertHandoffsQuery(patientId));
  const { data: staff = [] } = useQuery(staffListQuery());
  const rows = data.filter((h) => h.alert_id === alertId);
  if (rows.length === 0) return null;
  const name = (id: string | null) => (id ? (staff.find((s) => s.id === id)?.name ?? "알 수 없음") : "알 수 없음");
  return (
    <ul className="space-y-1 rounded-lg bg-muted px-3 py-2 text-sm" aria-label="넘긴 기록">
      {rows.map((h) => (
        <li key={h.id}>
          <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>{" "}
          <b>{name(h.from_staff)}</b> → <b>{name(h.to_staff)}</b>
          <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold", h.reason === "의사 확인 요청" ? "bg-level-caution-soft text-level-caution-ink" : "bg-card")}>{h.reason}</span>
          {h.note && <span className="ml-1.5">· {h.note}</span>}
        </li>
      ))}
    </ul>
  );
}
