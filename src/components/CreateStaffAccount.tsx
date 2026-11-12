import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStaffAccount, reissueSetupCode, type SetupCodeResult } from "@/lib/staff-account.server";
import { checkNewAccount, NEW_ACCOUNT_ROLES } from "@/lib/staff-account";
import { formatSetupCode, setupMessage } from "@/lib/setup-code";

/**
 * 관리자: 의료진 계정 만들기 (회원가입을 막은 뒤 계정을 만드는 곳).
 * 비밀번호는 관리자가 정하지 않는다. 만들고 나면 아이디와 '처음 설정 코드'를 한 번 보여 주고,
 * 본인이 로그인 화면 '코드로 비밀번호 만들기'(/activate)에서 직접 비밀번호를 만든다.
 */
export function CreateStaffAccount({ disabled, onCreated }: { disabled?: boolean; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("간호사");
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<SetupCodeResult | null>(null);

  function reset() {
    setLoginId("");
    setName("");
    setRole("간호사");
    setErrors([]);
    setDone(null);
  }

  const m = useMutation({
    mutationFn: (v: { loginId: string; name: string; role: string }) => createStaffAccount({ data: v }),
    onSuccess: (r) => {
      setDone(r);
      onCreated();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("Unauthorized")) setErrors(["로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요."]);
      else if (msg.startsWith("Missing Supabase")) setErrors(["일시적인 오류로 계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요."]);
      else setErrors([msg || "계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요."]);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = checkNewAccount({ loginId, name, role });
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    m.mutate({ loginId: r.value.loginId, name: r.value.name, role: r.value.role });
  }

  return (
    <>
      <Button type="button" disabled={disabled} onClick={() => { reset(); setOpen(true); }} className="h-10">
        <UserPlus className="size-4" aria-hidden /> 의료진 계정 만들기
      </Button>
      <Dialog open={open} onOpenChange={(v) => { if (!m.isPending) setOpen(v); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          {done ? (
            <SetupCodeView result={done} title="계정을 만들었습니다" onClose={() => setOpen(false)}>
              담당 환자는 목록에서 이름을 눌러 추가할 수 있습니다.
            </SetupCodeView>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl">의료진 계정 만들기</DialogTitle>
                <DialogDescription>함께 일할 의료진을 초대합니다.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="new-login-id" className="text-base">아이디</Label>
                <Input
                  id="new-login-id"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="예: kim01"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  className="h-11 text-base"
                />
                <p className="text-xs text-muted-foreground">영문 소문자와 숫자 3~30자. 로그인할 때 사용합니다.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name" className="text-base">이름</Label>
                <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} className="h-11 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-base" id="new-role-label">역할</Label>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="new-role-label">
                  {NEW_ACCOUNT_ROLES.map((r) => (
                    <Button
                      key={r}
                      type="button"
                      variant="outline"
                      role="radio"
                      aria-checked={role === r}
                      onClick={() => setRole(r)}
                      className={role === r ? "border-primary bg-secondary ring-2 ring-primary" : ""}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">상담원은 연락 업무에 필요한 정보만 볼 수 있습니다.</p>
              </div>
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                계정을 만들면 초대 코드가 발급됩니다. 비밀번호는 초대받은 분이 직접 설정합니다.
              </p>
              {errors.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-level-risk-soft px-3 py-2 text-sm text-level-risk" role="alert">
                  {errors.map((er) => <li key={er}>{er}</li>)}
                </ul>
              )}
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" disabled={m.isPending} onClick={() => setOpen(false)}>취소</Button>
                <Button type="submit" disabled={m.isPending}>{m.isPending ? "만드는 중…" : "계정 만들기"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * 처음 설정 코드를 한 번 보여 주는 화면 (계정 만들기·코드 다시 만들기에서 함께 쓴다).
 * 코드 원문은 DB에 없으므로 창을 닫으면 다시 볼 수 없다.
 */
export function SetupCodeView({
  result,
  title,
  onClose,
  children,
}: {
  result: SetupCodeResult;
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const expires = new Date(result.expiresAt);
  const message = setupMessage({
    name: result.name,
    loginId: result.loginId,
    code: result.code,
    expiresAt: expires,
    siteUrl: typeof window === "undefined" ? "" : window.location.origin,
  });

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("복사했습니다.");
    } catch {
      toast.error("복사하지 못했습니다. 직접 옮겨 적어 주세요.");
    }
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-xl">{title}</DialogTitle>
        <DialogDescription>
          {result.name} 님에게 아이디와 초대 코드를 전달해 주세요. 이 창을 닫으면 코드를 다시 확인할 수 없습니다.
        </DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border bg-muted/40 p-4 text-base">
        <dt className="text-muted-foreground">아이디</dt>
        <dd className="font-mono font-semibold">{result.loginId}</dd>
        <dt className="text-muted-foreground">초대 코드</dt>
        <dd className="font-mono text-lg font-semibold tracking-wider">{formatSetupCode(result.code)}</dd>
        <dt className="text-muted-foreground">유효 기간</dt>
        <dd>{expires.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}까지 (1회 사용)</dd>
      </dl>
      <p className="text-sm text-muted-foreground">
        초대받은 분은 로그인 화면에서 '계정 활성화'를 눌러 비밀번호를 설정합니다. {children}
      </p>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={() => copy(message)}>
          안내 메시지 복사
        </Button>
        <Button type="button" onClick={onClose}>닫기</Button>
      </DialogFooter>
    </div>
  );
}

/**
 * 관리자: 처음 설정 코드 다시 만들기 (코드 분실·기한 지남·잠김, 또는 비밀번호를 잊었을 때).
 * 만들면 그 사람의 지금 비밀번호로는 더 로그인할 수 없고, 새 코드로 비밀번호를 다시 만들어야 한다.
 */
export function ReissueSetupCode({ staffId, name, disabled, onDone }: { staffId: string; name: string; disabled?: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<SetupCodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => reissueSetupCode({ data: { staffId } }),
    onSuccess: (r) => {
      setDone(r);
      onDone();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      setError(msg.startsWith("Missing Supabase") ? "일시적인 오류로 재발급하지 못했습니다. 잠시 후 다시 시도해 주세요." : msg || "초대 코드를 재발급하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => { setDone(null); setError(null); setOpen(true); }}
        aria-label={`${name} 초대 코드 재발급`}
      >
        <KeyRound className="size-4" aria-hidden /> 초대 코드 재발급
      </Button>
      <Dialog open={open} onOpenChange={(v) => { if (!m.isPending) setOpen(v); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          {done ? (
            <SetupCodeView result={done} title="초대 코드를 재발급했습니다" onClose={() => setOpen(false)} />
          ) : (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl">{name} 님의 초대 코드를 재발급할까요?</DialogTitle>
                <DialogDescription>
                  코드를 분실했거나 유효 기간이 지났을 때, 또는 비밀번호를 잊었을 때 사용합니다.
                  재발급하면 <b>기존 비밀번호와 이전 코드는 더 이상 사용할 수 없습니다.</b>
                </DialogDescription>
              </DialogHeader>
              {error && <p className="rounded-lg bg-level-risk-soft px-3 py-2 text-sm text-level-risk" role="alert">{error}</p>}
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" disabled={m.isPending} onClick={() => setOpen(false)}>취소</Button>
                <Button type="button" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? "재발급 중…" : "재발급"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
