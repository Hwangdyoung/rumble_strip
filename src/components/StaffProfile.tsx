import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { myStaffQuery, saveMyStaff, type Staff } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** 내 정보(이름) 입력 폼. 설정 화면과 첫 로그인 창에서 함께 쓴다. 역할은 관리자가 정한다(보기만). */
export function StaffProfileForm({ current, onSaved, autoFocus = false }: { current: Staff | null; onSaved?: () => void; autoFocus?: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState(current?.name ?? "");
  useEffect(() => {
    setName(current?.name ?? "");
  }, [current]);

  const m = useMutation({
    mutationFn: () => saveMyStaff(name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["patient-staff"] });
      toast.success("내 정보를 저장했습니다.");
      onSaved?.();
    },
    onError: () => toast.error("저장하지 못했습니다. 다시 시도해 주세요."),
  });
  const valid = name.trim().length >= 1 && name.trim().length <= 40;
  const changed = !current || name.trim() !== current.name;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (valid) m.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="staff-name" className="text-base">이름</Label>
        <Input id="staff-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="예: 김하늘" className="h-11 text-base" autoFocus={autoFocus} />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">역할</p>
        <p className="text-base">{current ? `${current.role}${current.is_admin ? " · 관리자" : ""}` : "상담원 (처음 시작)"}</p>
        <p className="text-sm text-muted-foreground">
          역할은 관리자가 '담당 관리'에서 정합니다. 역할에 따라 볼 수 있는 정보가 다릅니다(상담원은 연락 업무에 필요한 정보만).
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" className="h-11" disabled={!valid || !changed || m.isPending}>
          {m.isPending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </form>
  );
}

/** 로그인 후 레이아웃에 둔다: 의료진 정보가 없으면 닫을 수 없는 입력 창을 띄운다. */
export function StaffProfileGate() {
  const { data } = useQuery(myStaffQuery());
  const needs = Boolean(data && data.userId && !data.staff);
  return (
    <Dialog open={needs}>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-md [&>button.absolute]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">처음 오셨네요</DialogTitle>
          <DialogDescription>이름과 역할을 입력해 주세요. 관리자가 담당 환자를 배정할 때 이 이름이 보입니다.</DialogDescription>
        </DialogHeader>
        <StaffProfileForm current={null} autoFocus />
      </DialogContent>
    </Dialog>
  );
}

/**
 * 비밀번호 변경 폼: 현재 비밀번호를 한 번 확인한 뒤 새 비밀번호로 바꾼다.
 * 비밀번호 값은 Supabase 인증으로만 보내고 어디에도 저장·출력하지 않는다.
 */
export function PasswordChangeForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const valid = current.length > 0 && next.length >= 6 && next === confirm && next !== current;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) throw new Error("로그인이 필요합니다.");
      // 현재 비밀번호 확인
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) {
        setError("현재 비밀번호가 올바르지 않습니다.");
        return;
      }
      const { error: ue } = await supabase.auth.updateUser({ password: next });
      if (ue) {
        setError(ue.message.toLowerCase().includes("password") ? `비밀번호를 바꾸지 못했습니다: ${ue.message}` : "비밀번호를 바꾸지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.");
    } catch {
      setError("비밀번호를 바꾸지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pw-current">현재 비밀번호</Label>
        <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-next">새 비밀번호 (6자 이상)</Label>
        <Input id="pw-next" type="password" autoComplete="new-password" minLength={6} value={next} onChange={(e) => setNext(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-confirm">새 비밀번호 확인</Label>
        <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" aria-invalid={mismatch} />
        {mismatch && <p className="text-sm text-level-risk">새 비밀번호가 서로 다릅니다.</p>}
      </div>
      {error && <p className="rounded-lg bg-level-risk-soft px-3 py-2 text-sm text-level-risk">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" variant="outline" className="h-11" disabled={!valid || saving}>
          {saving ? "바꾸는 중…" : "비밀번호 바꾸기"}
        </Button>
      </div>
    </form>
  );
}
