import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { PasswordChangeForm, StaffProfileForm } from "@/components/StaffProfile";
import { MAX_CAPACITY, useAlertSettings } from "@/lib/alert-settings";
import { displayLoginId } from "@/lib/login-id";
import { myStaffQuery, patientsOverviewQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "설정 | 이탈방지턱" },
      { name: "description", content: "알림 기준, 내 정보, 비밀번호를 바꿉니다." },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const { data: me } = useQuery(myStaffQuery());
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">설정</h1>
        {me?.email && <p className="mt-1 text-muted-foreground">로그인 아이디: {displayLoginId(me.email)}</p>}
      </div>

      <Section title="알림 기준" description="대시보드 '오늘 업무 → 연락할 환자'에 누가 들어갈지 정합니다. 이 브라우저에만 저장됩니다.">
        <AlertSettingsForm />
      </Section>

      <Section title="내 정보" description="담당자 목록과 환자 상세에 보이는 이름과 역할입니다.">
        <div className="max-w-md">
          <StaffProfileForm current={me?.staff ?? null} />
        </div>
      </Section>

      <Section title="비밀번호 변경" description="현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿉니다.">
        <div className="max-w-md">
          <PasswordChangeForm />
        </div>
      </Section>
    </div>
  );
}

function AlertSettingsForm() {
  const { threshold, capacity, setThreshold, setCapacity } = useAlertSettings();
  const { data: patients = [] } = useQuery(patientsOverviewQuery());
  const targets = patients.filter((p) => p.risk.level !== "정상" && p.risk.score >= threshold);
  const applyCapacity = () => {
    // 점수 순으로 capacity번째 환자의 점수를 기준으로 삼는다 (동점이면 더 많아질 수 있음)
    const nth = patients[Math.min(capacity, patients.length) - 1];
    setThreshold(nth ? nth.risk.score : 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="threshold" className="text-base">알림 기준 점수</Label>
          <span className="text-xl font-bold tabular-nums">{threshold}점 이상</span>
        </div>
        <Slider id="threshold" aria-label="알림 기준 점수" min={0} max={100} step={1} value={[threshold]} onValueChange={([v]) => setThreshold(v ?? 0)} className="mt-3" />
        <p className="mt-2 text-sm text-muted-foreground">
          낮추면 놓치는 환자는 줄지만 연락할 환자가 늘고, 높이면 줄지만 놓칠 수 있어요. 정상 단계는 기준과 관계없이 빠집니다.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="capacity" className="text-base">하루 처리 가능 인원</Label>
          <Input
            id="capacity"
            type="number"
            min={1}
            max={MAX_CAPACITY}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="mt-2 h-11 w-28 text-base"
          />
        </div>
        <Button variant="outline" className="h-11" onClick={applyCapacity}>기준 자동 설정</Button>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm">
        지금 기준이면 연락할 환자 <b className="tabular-nums">{targets.length}명</b>
        {targets.length > capacity ? ` · 처리 가능 인원보다 ${targets.length - capacity}명 많음` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        처리 가능 인원은 1~{MAX_CAPACITY}명(예시 환자 {MAX_CAPACITY}명 기준)입니다. 자동 설정은 점수 순으로 그 인원째 환자의 점수를 기준으로 맞춥니다.
      </p>
    </div>
  );
}
