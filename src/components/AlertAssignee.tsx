import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { myStaffQuery, patientStaffQuery, setAlertAssignee } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * 알림 담당자 고르기. 고를 수 있는 사람은 그 환자의 담당자뿐이다.
 * 내가 그 환자 담당자이고 아직 내 알림이 아니면 '내가 맡기' 버튼을 보여 준다.
 */
export function AlertAssignee({
  alertId,
  patientId,
  assigneeId,
  compact = false,
}: {
  alertId: string;
  patientId: string;
  assigneeId: string | null;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const { data: staff = [], isSuccess: staffLoaded } = useQuery(patientStaffQuery(patientId));
  const { data: me } = useQuery(myStaffQuery());
  const myId = me?.staff?.id ?? null;
  const m = useMutation({
    mutationFn: (staffId: string | null) => setAlertAssignee(alertId, staffId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      toast.success("알림 담당자를 바꿨습니다.");
    },
    onError: () => toast.error("담당자를 바꾸지 못했습니다. 다시 시도해 주세요."),
  });

  // 담당에서 빠진 사람이 아직 배정돼 있는 경우에도 이름이 보이도록 목록에 남긴다
  const current = assigneeId && !staff.some((s) => s.id === assigneeId) ? [{ id: assigneeId, name: "이전 담당자", role: "", is_contact: false }] : [];
  const options = [...staff, ...current];
  const canTake = myId !== null && assigneeId !== myId && staff.some((s) => s.id === myId);

  // 환자에게 담당자가 한 명도 없으면 고를 사람이 없으니 이유를 알려 준다
  if (staffLoaded && staff.length === 0 && !assigneeId) {
    return (
      <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
        <span className="font-medium text-level-risk">담당 미지정</span> · 이 환자의 담당자가 없습니다.{" "}
        {me?.staff?.is_admin ? (
          <Link to="/admin" className="font-medium text-primary underline-offset-2 hover:underline">담당 관리에서 지정</Link>
        ) : (
          "관리자에게 담당 지정을 요청하세요."
        )}
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", compact ? "text-xs" : "text-sm")}>
      <label className="flex items-center gap-1.5">
        <span className="font-medium text-muted-foreground">담당</span>
        <select
          value={assigneeId ?? ""}
          disabled={m.isPending}
          onChange={(e) => m.mutate(e.target.value || null)}
          className={cn("rounded-md border border-input bg-card px-2", compact ? "h-7" : "h-9", !assigneeId && "text-level-risk")}
          aria-label="알림 담당자"
        >
          <option value="">미지정</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.role ? ` (${s.role}${s.is_contact ? "·연락" : ""})` : ""}
            </option>
          ))}
        </select>
      </label>
      {canTake && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(compact ? "h-7 px-2 text-xs" : "h-9")}
          disabled={m.isPending}
          onClick={() => m.mutate(myId)}
        >
          내가 맡기
        </Button>
      )}
    </div>
  );
}
