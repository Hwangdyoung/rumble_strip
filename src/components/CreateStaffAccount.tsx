import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStaffAccount } from "@/lib/staff-account.server";
import { checkNewAccount, MIN_PASSWORD, NEW_ACCOUNT_ROLES, suggestPassword } from "@/lib/staff-account";

/**
 * 관리자: 의료진 계정 만들기 (회원가입을 막은 뒤 계정을 만드는 곳).
 * 만들고 나면 아이디와 처음 비밀번호를 한 번 보여 준다. 관리자는 이것을 본인에게 직접 전하고,
 * 본인은 첫 로그인 뒤 설정 화면에서 비밀번호를 바꾼다.
 */
export function CreateStaffAccount({ disabled, onCreated }: { disabled?: boolean; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("간호사");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<{ loginId: string; name: string; password: string } | null>(null);

  function reset() {
    setLoginId("");
    setName("");
    setRole("간호사");
    setPassword(suggestPassword());
    setErrors([]);
    setDone(null);
  }

  const m = useMutation({
    mutationFn: (v: { loginId: string; name: string; role: string; password: string }) => createStaffAccount({ data: v }),
    onSuccess: (r, v) => {
      setDone({ loginId: r.loginId, name: r.name, password: v.password });
      onCreated();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("Unauthorized")) setErrors(["로그인 확인에 실패해 계정을 만들지 못했습니다. 로그아웃 후 다시 로그인해서 시도해 주세요."]);
      else if (msg.startsWith("Missing Supabase")) setErrors(["서버 설정(Supabase 키)이 없어 계정을 만들 수 없습니다. 배포 사이트에서 시도해 주세요."]);
      else setErrors([msg || "계정을 만들지 못했습니다. 다시 시도해 주세요."]);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = checkNewAccount({ loginId, name, role, password });
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    m.mutate({ loginId: r.value.loginId, name: r.value.name, role: r.value.role, password: r.value.password });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("복사했습니다.");
    } catch {
      toast.error("복사하지 못했습니다. 직접 옮겨 적어 주세요.");
    }
  }

  return (
    <>
      <Button type="button" disabled={disabled} onClick={() => { reset(); setOpen(true); }} className="h-10">
        <UserPlus className="size-4" aria-hidden /> 의료진 계정 만들기
      </Button>
      <Dialog open={open} onOpenChange={(v) => { if (!m.isPending) setOpen(v); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          {done ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl">계정을 만들었습니다</DialogTitle>
                <DialogDescription>
                  아래 아이디와 처음 비밀번호를 {done.name} 님에게 직접 전해 주세요. 이 창을 닫으면 비밀번호는 다시 볼 수 없습니다.
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border bg-muted/40 p-4 text-base">
                <dt className="text-muted-foreground">아이디</dt>
                <dd className="font-mono font-semibold">{done.loginId}</dd>
                <dt className="text-muted-foreground">처음 비밀번호</dt>
                <dd className="font-mono font-semibold break-all">{done.password}</dd>
              </dl>
              <p className="text-sm text-muted-foreground">
                첫 로그인 뒤 오른쪽 위 이름표 → 설정에서 비밀번호를 바꾸도록 안내해 주세요. 담당 환자는 목록에서 이 사람을 펼쳐 추가합니다.
              </p>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => copy(`이탈방지턱 아이디: ${done.loginId}\n처음 비밀번호: ${done.password}`)}>
                  아이디·비밀번호 복사
                </Button>
                <Button type="button" onClick={() => setOpen(false)}>닫기</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl">의료진 계정 만들기</DialogTitle>
                <DialogDescription>회원가입은 받지 않습니다. 함께 일할 의료진의 계정을 여기서 만들어 주세요.</DialogDescription>
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
                <p className="text-xs text-muted-foreground">영어 소문자·숫자 3~30자. 로그인할 때 이 아이디만 입력합니다.</p>
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
                <p className="text-xs text-muted-foreground">상담원은 연락 업무에 필요한 정보(단계·접속 여부·연락 도우미)만 봅니다.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-base">처음 비밀번호</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    spellCheck={false}
                    required
                    minLength={MIN_PASSWORD}
                    className="h-11 font-mono text-base"
                  />
                  <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => setPassword(suggestPassword())}>
                    새로 만들기
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{MIN_PASSWORD}자 이상. 본인이 첫 로그인 뒤 바꿉니다.</p>
              </div>
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
