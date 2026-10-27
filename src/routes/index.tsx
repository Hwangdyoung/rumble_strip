import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/AppHeader";
import { Disclaimer } from "@/components/Disclaimer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "이탈방지턱 — 디지털 치료제 이탈 위험 조기 알림" },
      { name: "description", content: "스타러커스 처방 환자의 플레이 기록으로 이탈 위험을 계산해 의료진에게 먼저 알려드립니다." },
      { property: "og:title", content: "이탈방지턱 — 디지털 치료제 이탈 위험 조기 알림" },
      { property: "og:description", content: "스타러커스 처방 환자의 플레이 기록으로 이탈 위험을 계산해 의료진에게 먼저 알려드립니다." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <Button asChild variant="outline"><Link to="/auth">로그인</Link></Button>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <p className="font-semibold text-teal">의료진 전용 · 스타러커스</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          환자가 그만두기 전에,<br />먼저 알려드립니다.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          플레이 기록으로 이탈 위험을 계산하고, 누구에게 먼저 연락할지 정리해 드립니다.
          진단과 처방은 언제나 의료진의 몫입니다.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="h-12 px-6 text-base"><Link to="/auth">대시보드 시작하기</Link></Button>
        </div>
      </main>
      <Disclaimer />
    </div>
  );
}
