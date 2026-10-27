import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/AppHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "로그인 | 이탈방지턱" },
      { name: "description", content: "의료진 전용 이탈방지턱 로그인 및 회원가입" },
      { property: "og:title", content: "로그인 | 이탈방지턱" },
      { property: "og:description", content: "의료진 전용 이탈방지턱 로그인 및 회원가입" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      else navigate({ to: "/dashboard", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/dashboard" },
      });
      if (error) setError(error.message.includes("Password") ? "비밀번호는 6자 이상이어야 합니다." : "가입에 실패했습니다. 다시 시도해 주세요.");
      else if (data.session) navigate({ to: "/dashboard", replace: true });
      else setInfo("확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.");
    }
    setLoading(false);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold">{mode === "login" ? "의료진 로그인" : "의료진 회원가입"}</h1>
          <p className="mt-1 text-muted-foreground">스타러커스 처방 환자의 이탈 위험을 확인하세요.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">이메일</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">비밀번호</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 text-base" />
            </div>
            {error && <p className="rounded-lg bg-level-risk-soft px-3 py-2 text-sm text-level-risk">{error}</p>}
            {info && <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">{info}</p>}
            <Button type="submit" disabled={loading} className="h-12 w-full text-base">
              {loading ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setInfo(null); }}
            className="mt-5 w-full text-center text-sm font-medium text-primary hover:underline"
          >
            {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
          </button>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          AI는 진단·처방을 바꾸지 않으며, 연락 우선순위 판단을 돕는 보조 도구입니다.
        </p>
      </div>
    </div>
  );
}
