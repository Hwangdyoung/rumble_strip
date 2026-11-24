import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginIdToEmail } from "@/lib/login-id";
import { DemoEntry } from "@/components/DemoEntry";
import { GameEntry } from "@/components/GameEntry";

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
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <GameEntry />
      <DemoEntry />
      {/* 왼쪽(모바일은 위): 서비스가 하는 일. 가운데 카드 하나만 있던 흔한 로그인 화면 대신 제품 설명을 옆에 둔다 */}
      <aside className="relative flex flex-col justify-between gap-10 overflow-hidden bg-primary px-6 pb-8 pt-24 text-white dark:bg-secondary dark:text-secondary-foreground sm:px-10 lg:min-h-screen lg:px-14 lg:pb-12 lg:pt-28">
        <div className="max-w-md">
          <p className="flex items-center gap-2.5 text-lg font-bold">
            <span className="grid size-9 place-items-center rounded-lg bg-white/15 dark:bg-white/10">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M3 17h4c2 0 3-7 5-7s3 7 5 7h4" />
              </svg>
            </span>
            이탈방지턱
          </p>
          <h1 className="mt-10 text-[1.9rem] font-bold leading-snug tracking-tight sm:text-4xl sm:leading-snug">
            치료가 멈추기 전에
            <br />
            먼저 알려 드립니다
          </h1>
          <p className="mt-4 text-[1.05rem] leading-relaxed opacity-85">
            스타러커스 처방 환자의 플레이 기록으로 이탈 위험을 매일 점검하고, 오늘 연락할 환자를 정리합니다.
          </p>
          {/* 방지턱 띠: 이름에서 온 모양. 끊어진 막대가 점점 짙어진다 */}
          <div aria-hidden className="mt-10 flex items-end gap-1.5">
            {[0.18, 0.18, 0.25, 0.25, 0.35, 0.45, 0.6, 0.8, 1, 1].map((o, i) => (
              <span key={i} className="h-2 w-7 rounded-[2px] bg-current" style={{ opacity: o }} />
            ))}
          </div>
        </div>
        <p className="hidden max-w-md text-sm leading-relaxed opacity-75 lg:block">
          AI는 진단·처방을 바꾸지 않으며, 연락 우선순위 판단을 돕는 보조 도구입니다.
        </p>
      </aside>

      <main className="flex flex-col px-6 py-10 sm:px-10 lg:min-h-screen lg:justify-center lg:px-16">
        <div className="w-full max-w-sm lg:mx-auto">
          <h2 className="text-2xl font-bold tracking-tight">의료진 로그인</h2>
          <p className="mt-1 text-muted-foreground">기관에서 발급한 계정으로 로그인하세요.</p>
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
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
            {error && <p className="rounded-md border-l-2 border-level-risk bg-level-risk-soft px-3 py-2 text-sm text-level-risk">{error}</p>}
            <Button type="submit" disabled={loading} className="h-12 w-full text-base">
              {loading ? "처리 중…" : "로그인"}
            </Button>
          </form>
          <p className="mt-6 text-[0.95rem] text-muted-foreground">
            초대 코드를 받으셨나요?{" "}
            <Link to="/activate" className="font-semibold text-primary underline-offset-4 hover:underline">
              계정 활성화하기
            </Link>
          </p>
          <p className="mt-6 border-t pt-6 text-sm leading-relaxed text-muted-foreground">
            계정이 없거나 비밀번호를 잊으셨다면 관리자에게 문의해 주세요.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground lg:hidden">
            AI는 진단·처방을 바꾸지 않으며, 연락 우선순위 판단을 돕는 보조 도구입니다.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">예시 데이터(가상 환자)이며 실제 의료 데이터가 아닙니다.</p>
        </div>
      </main>
    </div>
  );
}
