import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReasonNoteFields, ReceiverPicker } from "@/components/HandoffFields";
import { handoffPatient, patientLinksQuery, staffWorkloadQuery, type HandoffReason, type Staff } from "@/lib/queries";
import { bulkResultText, handoffCandidates, splitHandoff } from "@/lib/bulk-handoff";
import { lightestStaff } from "@/lib/workload";

/**
 * 여러 환자 한 번에 넘기기 (대시보드 '내 담당'에서 고른 환자).
 * 받는 사람은 그 환자의 담당자여야 하므로(DB 규칙), 담당하지 않는 환자는 미리 알려 주고 건너뛴다.
 * 넘기기는 환자마다 handoff_patient를 차례로 부른다. 중간에 실패해도 앞서 넘긴 환자는 넘어간 상태로 남고, 결과에 실패한 환자를 알린다.
 */
export function BulkHandoffDialog({
  open,
  onOpenChange,
  patientIds,
  nameOf,
  staff,
  myId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 고른 환자 (목록 순서) */
  patientIds: string[];
  nameOf: (patientId: string) => string;
  staff: Staff[];
  myId: string | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState<HandoffReason>("인계");
  const [note, setNote] = useState("");
  const links = useQuery({ ...patientLinksQuery(patientIds), enabled: open && patientIds.length > 0 });
  const { data: workload } = useQuery({ ...staffWorkloadQuery(), enabled: open });
  const cands = links.data ? handoffCandidates(patientIds, links.data, myId) : [];
  const options = cands
    .map((c) => staff.find((s) => s.id === c.staffId))
    .filter((s): s is Staff => Boolean(s));
  const light = workload ? lightestStaff(workload, options.map((s) => s.id)) : [];
  const isAdmin = Boolean(staff.find((s) => s.id === myId)?.is_admin);
  const plan = to && links.data ? splitHandoff(patientIds, links.data, to) : { eligible: [], skipped: [] };

  useEffect(() => {
    if (!open) return;
    setReason("인계");
    setNote("");
    setTo("");
  }, [open]);
  // 후보를 받아 오면 넘길 수 있는 환자가 가장 많은 사람을 처음 선택으로 둔다(바꿀 수 있음)
  useEffect(() => {
    if (open && !to && options[0]) setTo(options[0].id);
  }, [open, to, options]);

  const m = useMutation({
    mutationFn: async () => {
      const failed: string[] = [];
      let done = 0;
      for (const pid of plan.eligible) {
        try {
          await handoffPatient({ patientId: pid, toStaff: to, reason, note });
          done++;
        } catch {
          failed.push(nameOf(pid));
        }
      }
      return { done, failed };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["patient-staff"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onSuccess: ({ done, failed }) => {
      const text = bulkResultText(staff.find((s) => s.id === to)?.name ?? "", done, failed);
      if (failed.length > 0) toast.error(text);
      else toast.success(text);
      if (done > 0) onDone();
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (to && plan.eligible.length > 0) m.mutate();
  }

  const n = patientIds.length;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!m.isPending) onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl">{n}명 연락 담당 넘기기</DialogTitle>
            <DialogDescription>받는 사람이 선택한 환자의 연락 담당이 됩니다. 이유와 메모는 모든 환자의 연락 이력에 남습니다.</DialogDescription>
          </DialogHeader>

          {links.isPending ? (
            <p className="text-sm text-muted-foreground" role="status">받을 수 있는 사람을 찾는 중…</p>
          ) : links.isError ? (
            <p className="rounded-lg bg-level-risk-soft px-3 py-2 text-sm text-level-risk" role="alert">담당자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
          ) : options.length === 0 ? (
            <div className="space-y-2 rounded-lg bg-muted px-3 py-3 text-sm">
              <p className="font-semibold">넘길 수 있는 사람이 없습니다</p>
              <p className="text-muted-foreground">
                선택한 환자를 함께 담당하는 의료진이 있어야 넘길 수 있습니다.
                {isAdmin ? " 담당 관리에서 담당자를 먼저 추가하세요." : " 관리자에게 담당자 추가를 요청하세요."}
              </p>
              {isAdmin && (
                <Link to="/admin" onClick={() => onOpenChange(false)} className="inline-block font-semibold text-primary underline-offset-4 hover:underline">
                  담당 관리에서 담당자 추가하기
                </Link>
              )}
            </div>
          ) : (
            <ReceiverPicker
              options={options}
              value={to}
              onChange={setTo}
              workload={workload}
              light={light}
              extra={(id) => {
                const c = cands.find((x) => x.staffId === id);
                return c ? `${n}명 중 ${c.eligible.length}명 받을 수 있음` : null;
              }}
            />
          )}

          {plan.skipped.length > 0 && (
            <div className="rounded-lg bg-level-caution-soft px-3 py-2 text-sm text-level-caution-ink">
              <p className="font-semibold">{plan.skipped.length}명은 넘기지 않습니다</p>
              <p>
                {plan.skipped.map(nameOf).join(", ")}: 받는 사람이 이 환자의 담당자가 아닙니다. 필요하면 관리자에게 담당 추가를 요청하세요.
              </p>
            </div>
          )}

          {options.length > 0 && <ReasonNoteFields reason={reason} onReason={setReason} note={note} onNote={setNote} />}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={m.isPending} onClick={() => onOpenChange(false)}>{options.length > 0 ? "취소" : "닫기"}</Button>
            {options.length > 0 && (
              <Button type="submit" className="h-11" disabled={!to || plan.eligible.length === 0 || m.isPending}>
                {m.isPending ? "넘기는 중…" : `${plan.eligible.length}명 넘기기`}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
