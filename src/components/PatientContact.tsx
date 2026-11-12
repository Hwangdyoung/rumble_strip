import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRightLeft, Hand } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { handoffPatient, HANDOFF_REASONS, myStaffQuery, patientStaffQuery, staffWorkloadQuery, takePatient, type HandoffReason } from "@/lib/queries";
import { lightestStaff, workloadText } from "@/lib/workload";
import { cn } from "@/lib/utils";

/**
 * 환자 상세 맨 위: 이 환자의 '연락 담당' 한 명과 '내가 맡기'·'넘기기'.
 * 맡기·넘기기는 DB 함수(take_patient, handoff_patient)가 권한을 확인한 뒤 처리한다.
 */
export function PatientContact({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const { data: staff = [], isSuccess } = useQuery(patientStaffQuery(patientId));
  const { data: me } = useQuery(myStaffQuery());
  const myId = me?.staff?.id ?? null;
  const contact = staff.find((s) => s.is_contact) ?? null;
  const others = staff.filter((s) => s.id !== contact?.id);
  const [open, setOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["patient-staff", patientId] });
    qc.invalidateQueries({ queryKey: ["alerts"] });
    qc.invalidateQueries({ queryKey: ["patient", patientId] });
    qc.invalidateQueries({ queryKey: ["assignments"] });
  };
  const take = useMutation({
    mutationFn: () => takePatient(patientId),
    onSuccess: () => {
      refresh();
      toast.success("이 환자를 맡았습니다. 연락 담당이 나로 바뀌었습니다.");
    },
    onError: () => toast.error("맡지 못했습니다. 다시 시도해 주세요."),
  });

  if (!isSuccess) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">연락 담당</span>
      <span className={cn("font-semibold", !contact && "text-level-risk")}>{contact ? `${contact.name} (${contact.role})` : "미지정"}</span>
      {me?.staff && contact?.id !== myId && (
        <Button type="button" variant="outline" size="sm" disabled={take.isPending} onClick={() => take.mutate()}>
          <Hand /> 내가 맡기
        </Button>
      )}
      {me?.staff && others.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ArrowRightLeft /> 넘기기
        </Button>
      )}
      {staff.length > 1 && (
        <span className="text-xs text-muted-foreground">· 함께 보는 담당 {staff.map((s) => s.name).join(", ")}</span>
      )}
      <HandoffDialog open={open} onOpenChange={setOpen} patientId={patientId} options={others} onDone={refresh} />
    </div>
  );
}

function HandoffDialog({
  open,
  onOpenChange,
  patientId,
  options,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  options: Array<{ id: string; name: string; role: string }>;
  onDone: () => void;
}) {
  const [to, setTo] = useState("");
  const [reason, setReason] = useState<HandoffReason>("인계");
  const [note, setNote] = useState("");
  // 업무량은 SQL 008 실행 전이면 못 받아온다. 그때는 숫자만 빼고 넘기기는 그대로 된다.
  const { data: workload } = useQuery({ ...staffWorkloadQuery(), enabled: open });
  const light = workload ? lightestStaff(workload, options.map((s) => s.id)) : [];
  useEffect(() => {
    if (!open) return;
    setTo(options[0]?.id ?? "");
    setReason("인계");
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const m = useMutation({
    mutationFn: () => handoffPatient({ patientId, toStaff: to, reason, note }),
    onSuccess: () => {
      onDone();
      toast.success(`${options.find((s) => s.id === to)?.name ?? ""}님에게 넘겼습니다.`);
      onOpenChange(false);
    },
    onError: () => toast.error("넘기지 못했습니다. 다시 시도해 주세요."),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (to) m.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl">연락 담당 넘기기</DialogTitle>
            <DialogDescription>받는 사람이 이 환자의 연락 담당이 됩니다. 넘긴 기록과 메모는 연락 이력에 남습니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label id="handoff-to-label" className="text-base">받는 사람</Label>
            <div className="grid gap-2" role="radiogroup" aria-labelledby="handoff-to-label">
              {options.map((s) => {
                const w = workload?.find((x) => x.staffId === s.id);
                const on = to === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setTo(s.id)}
                    className={cn(
                      "flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border bg-card px-3 py-2 text-left transition hover:bg-muted",
                      on && "border-primary bg-secondary ring-2 ring-primary",
                    )}
                  >
                    <span className="font-semibold">
                      {s.name} <span className="font-normal text-muted-foreground">({s.role})</span>
                      {light.includes(s.id) && (
                        <span className="ml-2 rounded-full bg-level-normal-soft px-2 py-0.5 text-xs font-semibold text-level-normal">여유</span>
                      )}
                    </span>
                    {workload && <span className="text-sm tabular-nums text-muted-foreground">{workloadText(w)}</span>}
                  </button>
                );
              })}
            </div>
            {workload && (
              <p className="text-xs text-muted-foreground">
                오늘 할 일 = 새로 나빠졌거나 오늘까지 다시 연락할 환자 수(연락 담당 기준). '여유'는 참고 표시이고, 받는 사람은 직접 고릅니다.
              </p>
            )}
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
  );
}
