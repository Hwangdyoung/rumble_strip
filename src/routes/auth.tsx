import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/AppHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { loginIdToEmail } from "@/lib/login-id";

/**
 * 로그인 화면. 회원가입은 받지 않는다(Supabase에서 가입을 끄고, 관리자가 '담당 관리 → 의료진별'에서 계정을 만든다).
 */
export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "로그인 | 이탈방지턱" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "의료진 전용 이탈방지턱 로그인" },
      { property: "og:title", content: "로그인 | 이탈방지턱" },
      { property: "og:description", content: "의료진 전용 이탈방지턱 로그인" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // 아이디만 입력하면(예: admin) 정해진 주소를 붙여 이메일로 바꾼다
    const { error } = await supabase.auth.signInWithPassword({ email: loginIdToEmail(email), password });
    if (error) setError("아이디(이메일) 또는 비밀번호가 올바르지 않습니다.");
    else navigate({ to: "/dashboard", replace: true });
    setLoading(false);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold">의료진 로그인</h1>
          <p className="mt-1 text-muted-foreground">스타러커스 처방 환자의 이탈 위험을 확인하세요.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">아이디 또는 이메일</Label>
              <Input
                id="email"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">비밀번호</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 text-base" />
            </div>
            {error && <p className="rounded-lg bg-level-risk-soft px-3 py-2 text-sm text-level-risk">{error}</p>}
            <Button type="submit" disabled={loading} className="h-12 w-full text-base">
              {loading ? "처리 중…" : "로그인"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">
            이탈방지턱은 기관에서 발급한 계정으로만 이용할 수 있습니다.
            <br />
            계정 발급이나 비밀번호 초기화는 담당 관리자에게 문의해 주세요.
          </p>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          AI는 진단·처방을 바꾸지 않으며, 연락 우선순위 판단을 돕는 보조 도구입니다.
        </p>
        <Disclaimer />
      </div>
    </div>
  );
}
