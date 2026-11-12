import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/AppHeader";
import { activateAccount } from "@/lib/staff-account.server";
import { checkActivation } from "@/lib/setup-code";
import { MIN_PASSWORD } from "@/lib/staff-account";
import { loginIdToEmail } from "@/lib/login-id";

/**
 * 처음 설정 코드로 비밀번호 만들기 (로그인 없이 연다).
 * 관리자에게 받은 아이디·코드를 넣고 본인이 비밀번호를 정한다. 성공하면 바로 로그인해 대시보드로 간다.
 * 비밀번호를 잊었을 때도 관리자가 코드를 다시 만들어 주면 여기서 새로 정한다.
 */
export const Route = createFileRoute("/activate")({
  head: () => ({
    meta: [
      { title: "비밀번호 만들기 | 이탈방지턱" },
      { name: "description", content: "관리자에게 받은 처음 설정 코드로 비밀번호를 만듭니다." },
    ],
  }),
  component: ActivatePage,
});

function ActivatePage() {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = checkActivation({ loginId, code, password, confirm });
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    setBusy(true);
    try {
      await activateAccount({ data: r.value });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setErrors([msg.startsWith("Missing Supabase") ? "서버 설정이 없어 지금은 비밀번호를 만들 수 없습니다. 배포 사이트에서 시도해 주세요." : msg || "비밀번호를 만들지 못했습니다. 다시 시도해 주세요."]);
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginIdToEmail(r.value.loginId), password: r.value.password });
    setBusy(false);
    if (error) navigate({ to: "/auth", replace: true });
    else navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold">비밀번호 만들기</h1>
          <p className="mt-1 text-muted-foreground">관리자에게 받은 아이디와 처음 설정 코드를 넣고, 앞으로 쓸 비밀번호를 직접 정하세요.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="act-login-id" className="text-base">아이디</Label>
              <Input id="act-login-id" value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-code" className="text-base">처음 설정 코드</Label>
              <Input
                id="act-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: K7QM-4XPA"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                required
                className="h-12 font-mono text-base tracking-wider"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-password" className="text-base">새 비밀번호</Label>
              <Input id="act-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD} required className="h-12 text-base" />
              <p className="text-xs text-muted-foreground">{MIN_PASSWORD}자 이상. 관리자도 이 비밀번호를 알 수 없습니다.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-confirm" className="text-base">새 비밀번호 확인</Label>
              <Input id="act-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required className="h-12 text-base" />
            </div>
            {errors.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-level-risk-soft px-3 py-2 text-sm text-level-risk" role="alert">
                {errors.map((er) => <li key={er}>{er}</li>)}
              </ul>
            )}
            <Button type="submit" disabled={busy} className="h-12 w-full text-base">
              {busy ? "처리 중…" : "비밀번호 만들고 로그인"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">
            코드를 잃어버렸거나 기한이 지났으면 관리자에게 코드를 다시 만들어 달라고 요청해 주세요.
            <br />
            <Link to="/auth" className="font-semibold text-primary underline-offset-4 hover:underline">로그인 화면으로</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
