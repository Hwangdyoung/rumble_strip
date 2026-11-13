import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { myStaffQuery } from "@/lib/queries";
import { demoSignIn, getDemoStatus } from "@/lib/demo.server";
import type { DemoRole } from "@/lib/demo";

const ROLE_HINT: Record<DemoRole, string> = {
  의사: "점수·경과 요약·그래프까지",
  간호사: "연락 업무와 넘기기",
  상담원: "연락 업무에 필요한 정보만",
};

/**
 * 로그인 화면의 '로그인 없이 둘러보기' (전시회용, SQL 011).
 * 서버가 둘러보기를 켜 두었고(DEMO_MODE=on) 둘러보기 계정이 있는 역할만 버튼을 보여 준다. 꺼져 있으면 아무것도 그리지 않는다.
 */
export function DemoEntry() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["demo-status"], queryFn: () => getDemoStatus(), staleTime: 60_000, retry: false });
  const [busy, setBusy] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data?.enabled) return null;

  async function enter(role: DemoRole) {
    setBusy(role);
    setError(null);
    try {
      const s = await demoSignIn({ data: { role } });
      const { error: e } = await supabase.auth.setSession(s);
      if (e) throw e;
      await qc.cancelQueries();
      qc.clear();
      navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg && !msg.startsWith("Missing") ? msg : "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(null);
    }
  }

  return (
    <section className="mb-4 rounded-2xl border-2 border-primary/40 bg-card p-5 shadow-card sm:p-6" aria-labelledby="demo-title">
      <h2 id="demo-title" className="flex items-center gap-2 text-lg font-bold">
        <Eye className="size-5 text-primary" aria-hidden /> 로그인 없이 둘러보기
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">역할을 고르면 바로 들어갑니다. 모든 환자는 가상 인물입니다.</p>
      <div className="mt-4 grid gap-2">
        {data.roles.map((role) => (
          <Button
            key={role}
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => enter(role)}
            className="h-auto min-h-12 justify-between gap-3 px-4 py-2.5 text-left"
          >
            <span className="text-base font-semibold">{busy === role ? "들어가는 중…" : `${role}로 둘러보기`}</span>
            <span className="text-sm font-normal text-muted-foreground">{ROLE_HINT[role]}</span>
          </Button>
        ))}
      </div>
      {error && <p className="mt-3 rounded-lg bg-level-risk-soft px-3 py-2 text-sm text-level-risk" role="alert">{error}</p>}
    </section>
  );
}

/** 둘러보기 계정으로 들어왔을 때 화면 맨 위 띠 (나가기 = 로그아웃) */
export function DemoBanner() {
  const { data: me } = useQuery(myStaffQuery());
  const qc = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  if (!me?.staff?.is_demo) return null;

  async function leave() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="bg-primary text-primary-foreground" role="status">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <p>
          <b>{me.staff.role}로 둘러보는 중입니다.</b> 가상 환자 데이터이며, 남긴 기록은 정해진 때 처음 상태로 돌아갑니다.
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={leave} className="h-8">
          <LogOut className="size-4" aria-hidden /> 나가기
        </Button>
      </div>
    </div>
  );
}
