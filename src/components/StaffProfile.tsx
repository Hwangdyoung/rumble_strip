import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { myStaffQuery, saveMyStaff, STAFF_ROLES, type Staff, type StaffRole } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** 내 정보(이름·역할) 입력 창. required면 닫을 수 없음(첫 로그인). */
export function StaffProfileDialog({
  open,
  onOpenChange,
  current,
  required = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current: Staff | null;
  required?: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(current?.name ?? "");
  const [role, setRole] = useState<StaffRole>((current?.role as StaffRole) ?? "의사");
  useEffect(() => {
    if (open) {
      setName(current?.name ?? "");
      setRole((current?.role as StaffRole) ?? "의사");
    }
  }, [open, current]);

  const m = useMutation({
    mutationFn: () => saveMyStaff(name.trim(), role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["patient-staff"] });
      toast.success("내 정보를 저장했습니다.");
      onOpenChange(false);
    },
    onError: () => toast.error("저장하지 못했습니다. 다시 시도해 주세요."),
  });
  const valid = name.trim().length >= 1 && name.trim().length <= 40;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (valid) m.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!required || !v ? onOpenChange(v) : undefined)}>
      <DialogContent
        // 첫 입력(required)에서는 닫기 버튼을 숨기고 바깥 클릭·ESC로 닫히지 않게 함
        className={cn("w-[calc(100%-2rem)] max-w-md", required && "[&>button.absolute]:hidden")}
        onEscapeKeyDown={(e) => required && e.preventDefault()}
        onPointerDownOutside={(e) => required && e.preventDefault()}
      >
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="text-xl">{required ? "처음 오셨네요" : "내 정보"}</DialogTitle>
            <DialogDescription>
              {required
                ? "이름과 역할을 입력해 주세요. 관리자가 담당 환자를 배정할 때 이 이름이 보입니다."
                : "담당자 목록과 환자 상세에 보이는 이름과 역할입니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="staff-name" className="text-base">이름</Label>
            <Input id="staff-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="예: 김하늘" className="h-11 text-base" autoFocus />
          </div>
          <div className="space-y-2">
            <Label className="text-base">역할</Label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="역할">
              {STAFF_ROLES.map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant="outline"
                  role="radio"
                  aria-checked={role === r}
                  onClick={() => setRole(r)}
                  className={cn("h-11", role === r && "border-primary bg-secondary ring-2 ring-primary")}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="h-11" disabled={!valid || m.isPending}>
              {m.isPending ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 로그인 후 레이아웃에 둔다: 의료진 정보가 없으면 입력 창을 띄운다. */
export function StaffProfileGate() {
  const { data } = useQuery(myStaffQuery());
  const needs = Boolean(data && data.userId && !data.staff);
  return <StaffProfileDialog open={needs} onOpenChange={() => {}} current={null} required />;
}
