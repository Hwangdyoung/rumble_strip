import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { demoBaselineQuery, resetDemoData, saveDemoBaseline } from "@/lib/queries";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "없음";

/**
 * 관리자: '로그인 없이 둘러보기'의 시연 기준 저장·되돌리기 (설정 → 데이터, SQL 011).
 * 되돌리기는 기준 저장 뒤에 바뀐 연락 기록·넘긴 기록·다음 연락 일정·담당 연결·알림 상태를 모두 기준으로 돌린다.
 * 매일 점검(Cron) 때도 둘러보기가 켜져 있으면 자동으로 되돌린다.
 */
export function DemoDataControls() {
  const qc = useQueryClient();
  const { data } = useQuery(demoBaselineQuery());
  const [confirm, setConfirm] = useState<"save" | "reset" | null>(null);
  const refreshAll = () => qc.invalidateQueries();

  const save = useMutation({
    mutationFn: saveDemoBaseline,
    onSuccess: () => {
      toast.success("지금 상태를 시연 기준으로 저장했습니다.");
      setConfirm(null);
      refreshAll();
    },
    onError: () => toast.error("저장하지 못했습니다. 잠시 후 다시 시도해 주세요."),
  });
  const reset = useMutation({
    mutationFn: resetDemoData,
    onSuccess: (msg) => {
      toast.success(msg === "되돌렸습니다." ? "시연 기준으로 되돌렸습니다." : String(msg));
      setConfirm(null);
      refreshAll();
    },
    onError: () => toast.error("되돌리지 못했습니다. 잠시 후 다시 시도해 주세요."),
  });

  if (!data?.ready) {
    return <p className="text-sm text-muted-foreground">둘러보기 기능을 준비하는 중입니다. 잠시 후 다시 확인해 주세요.</p>;
  }
  const pending = save.isPending || reset.isPending;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">시연 기준 저장</dt>
        <dd className="tabular-nums">{when(data.savedAt)}</dd>
        <dt className="text-muted-foreground">마지막 되돌리기</dt>
        <dd className="tabular-nums">{when(data.resetAt)}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-11" disabled={pending} onClick={() => setConfirm("save")}>
          <Save className="size-4" aria-hidden /> 지금 상태를 시연 기준으로 저장
        </Button>
        <Button variant="outline" className="h-11" disabled={pending || !data.savedAt} onClick={() => setConfirm("reset")}>
          <RotateCcw className="size-4" aria-hidden /> 시연 기준으로 되돌리기
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        되돌리면 기준 저장 뒤에 바뀐 연락 기록, 넘긴 기록, 다음 연락 일정, 담당 연결, 알림 상태가 모두 기준으로 돌아갑니다.
        둘러보기를 켜 둔 동안에는 매일 아침 점검 때 자동으로 되돌립니다.
      </p>

      <Dialog open={confirm !== null} onOpenChange={(v) => { if (!pending && !v) setConfirm(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{confirm === "save" ? "시연 기준을 저장할까요?" : "시연 기준으로 되돌릴까요?"}</DialogTitle>
            <DialogDescription>
              {confirm === "save"
                ? "지금의 연락 기록, 담당 연결, 알림 상태가 새 기준이 됩니다. 이전 기준은 지워집니다."
                : `${when(data.savedAt)}에 저장한 상태로 돌아갑니다. 그 뒤에 남긴 기록은 누가 남겼든 모두 사라지며 되살릴 수 없습니다.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={pending} onClick={() => setConfirm(null)}>취소</Button>
            <Button disabled={pending} onClick={() => (confirm === "save" ? save.mutate() : reset.mutate())}>
              {pending ? "처리 중…" : confirm === "save" ? "저장" : "되돌리기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
