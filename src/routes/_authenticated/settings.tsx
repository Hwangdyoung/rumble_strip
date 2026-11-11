import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Database, Info, Monitor, UserRound, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PasswordChangeForm, StaffProfileForm } from "@/components/StaffProfile";
import { MAX_CAPACITY, useAlertSettings } from "@/lib/alert-settings";
import { toCsv } from "@/lib/csv";
import { displayLoginId } from "@/lib/login-id";
import { setPreferences, usePreferences, type DefaultFilter, type FirstTab, type ThemePref } from "@/lib/preferences";
import { fetchAlertExport, myStaffQuery, patientsOverviewQuery } from "@/lib/queries";
import { RISK_CONFIG, toDateKey } from "@/lib/risk";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "account", label: "계정", icon: UserRound, desc: "이름·역할, 비밀번호" },
  { id: "display", label: "화면", icon: Monitor, desc: "다크 모드, 글자 크기, 움직임" },
  { id: "work", label: "업무", icon: Workflow, desc: "알림 기준, 지연 기준, 대시보드 기본값" },
  { id: "data", label: "데이터", icon: Database, desc: "알림 결과 내보내기" },
  { id: "info", label: "정보", icon: Info, desc: "점수 기준, 안내" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: zodValidator(z.object({ section: fallback(z.enum(["account", "display", "work", "data", "info"]), "account").optional() })),
  head: () => ({
    meta: [
      { title: "설정 | 이탈방지턱" },
      { name: "description", content: "계정, 화면, 업무 기준, 데이터 내보내기 설정" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { section } = Route.useSearch();
  const current: SectionId = section ?? "account";
  const meta = SECTIONS.find((s) => s.id === current)!;

  return (
    <div className="space-y-6">
      <h1 className={cn("text-2xl font-bold sm:text-3xl", section && "hidden md:block")}>설정</h1>
      <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
        {/* 왼쪽 카테고리 (휴대폰에서는 카테고리를 고르기 전까지 목록만 보임) */}
        <nav aria-label="설정 카테고리" className={cn("md:block", section ? "hidden" : "block")}>
          <ul className="space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <Link
                  to="/settings"
                  search={{ section: s.id }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    current === s.id ? "md:bg-secondary md:text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-current={current === s.id ? "page" : undefined}
                >
                  <s.icon className="size-4 shrink-0" />
                  <span className="flex-1">
                    {s.label}
                    <span className="block text-xs font-normal text-muted-foreground md:hidden">{s.desc}</span>
                  </span>
                  <ChevronRight className="size-4 md:hidden" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={cn("min-w-0 space-y-6", !section && "hidden md:block")}>
          <div className="flex items-center gap-2">
            <Link to="/settings" search={{}} className="-ml-2 rounded-md p-1 text-muted-foreground hover:bg-muted md:hidden" aria-label="설정 목록으로">
              <ChevronLeft className="size-5" />
            </Link>
            <h2 className="text-xl font-bold">{meta.label}</h2>
          </div>
          {current === "account" && <AccountSection />}
          {current === "display" && <DisplaySection />}
          {current === "work" && <WorkSection />}
          {current === "data" && <DataSection />}
          {current === "info" && <InfoSection />}
        </div>
      </div>
    </div>
  );
}

function Block({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
      <div>
        <h3 className="font-bold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <Button
          key={o.value}
          type="button"
          variant="outline"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-10", value === o.value && "border-primary bg-secondary text-secondary-foreground ring-2 ring-primary")}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

function ToggleRow({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-base">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─── 계정 ────────────────────────────────────────────────────────────────────

function AccountSection() {
  const { data: me } = useQuery(myStaffQuery());
  return (
    <>
      <Block title="내 정보" description={`담당자 목록과 환자 상세에 보이는 이름과 역할입니다.${me?.email ? ` 로그인 아이디: ${displayLoginId(me.email)}` : ""}`}>
        <div className="max-w-md">
          <StaffProfileForm current={me?.staff ?? null} />
        </div>
      </Block>
      <Block title="비밀번호 변경" description="현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿉니다.">
        <div className="max-w-md">
          <PasswordChangeForm />
        </div>
      </Block>
    </>
  );
}

// ─── 화면 ────────────────────────────────────────────────────────────────────

function DisplaySection() {
  const p = usePreferences();
  return (
    <>
      <Block title="테마" description="밤이나 어두운 병동에서는 어두운 화면이 눈부심이 덜합니다.">
        <Choice<ThemePref>
          label="테마"
          value={p.theme}
          onChange={(theme) => setPreferences({ theme })}
          options={[
            { value: "system", label: "기기 설정 따라감" },
            { value: "light", label: "밝게" },
            { value: "dark", label: "어둡게" },
          ]}
        />
      </Block>
      <Block title="보기 편하게">
        <div className="space-y-5">
          <ToggleRow id="pref-large" label="글자 크게 보기" description="화면 전체 글자를 약 12% 크게 합니다." checked={p.largeText} onChange={(largeText) => setPreferences({ largeText })} />
          <ToggleRow id="pref-motion" label="움직임 줄이기" description="패널 슬라이드, 화면 전환 애니메이션을 끕니다." checked={p.reduceMotion} onChange={(reduceMotion) => setPreferences({ reduceMotion })} />
        </div>
      </Block>
      <p className="text-xs text-muted-foreground">화면 설정은 이 브라우저에만 저장됩니다.</p>
    </>
  );
}

// ─── 업무 ────────────────────────────────────────────────────────────────────

function WorkSection() {
  const p = usePreferences();
  return (
    <>
      <Block title="알림 기준" description="대시보드 '오늘 업무 → 연락할 환자'에 누가 들어갈지 정합니다.">
        <AlertSettingsForm />
      </Block>
      <Block title="지연 기준" description="알림 후 며칠 동안 조치완료가 안 되면 '지연'으로 표시할지 정합니다. 초기값 2일은 가정치입니다.">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            id="pref-overdue"
            type="number"
            min={1}
            max={7}
            value={p.overdueDays}
            onChange={(e) => {
              const v = Math.round(Number(e.target.value));
              if (v >= 1 && v <= 7) setPreferences({ overdueDays: v });
            }}
            className="h-11 w-24 text-base"
            aria-label="지연 기준 일수"
          />
          <span className="text-sm text-muted-foreground">일 이상 지나면 지연 (1~7일)</span>
        </div>
      </Block>
      <Block title="대시보드 기본값">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">'오늘 업무'에서 처음 보일 탭</p>
            <Choice<FirstTab>
              label="처음 보일 탭"
              value={p.firstTab}
              onChange={(firstTab) => setPreferences({ firstTab })}
              options={[
                { value: "last", label: "마지막에 본 탭" },
                { value: "alerts", label: "처리할 알림" },
                { value: "contact", label: "연락할 환자" },
                { value: "outcomes", label: "알림 결과" },
              ]}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">환자 목록 기본 필터</p>
            <Choice<DefaultFilter>
              label="환자 목록 기본 필터"
              value={p.defaultFilter}
              onChange={(defaultFilter) => setPreferences({ defaultFilter })}
              options={[
                { value: "전체", label: "전체" },
                { value: "알림 대상", label: "알림 대상만" },
              ]}
            />
          </div>
        </div>
      </Block>
      <p className="text-xs text-muted-foreground">업무 설정은 이 브라우저에만 저장됩니다.</p>
    </>
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
          <Input id="capacity" type="number" min={1} max={MAX_CAPACITY} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="mt-2 h-11 w-28 text-base" />
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

// ─── 데이터 ──────────────────────────────────────────────────────────────────

function DataSection() {
  const [busy, setBusy] = useState(false);
  async function exportCsv() {
    setBusy(true);
    try {
      const rows = await fetchAlertExport();
      const fmt = (v: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "");
      const csv = toCsv(
        ["알림 시각", "환자", "당시 점수", "당시 단계", "상태", "담당자", "결과", "결과 기록 시각", "결과 메모", "조치완료 시각"],
        rows.map((r) => [
          fmt(r.created_at),
          r.patients?.name,
          r.alert_score,
          r.alert_level,
          r.status,
          r.assignee?.name,
          r.outcome,
          fmt(r.outcome_at),
          r.outcome_note,
          fmt(r.resolved_at),
        ]),
      );
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `이탈방지턱_알림결과_${toDateKey(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`알림 ${rows.length}건을 내보냈습니다.`);
    } catch {
      toast.error("내보내지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Block
      title="알림 결과 내보내기 (CSV)"
      description="볼 수 있는 환자의 알림과 기록한 결과(회복·이탈·연락 불가)를 엑셀에서 열 수 있는 파일로 받습니다. 점수 기준이 맞는지 검증할 때 씁니다."
    >
      <Button onClick={exportCsv} disabled={busy} className="h-11">{busy ? "만드는 중…" : "CSV 내려받기"}</Button>
      <p className="text-xs text-muted-foreground">
        지금 데이터는 모두 가상 환자입니다. 실제 환자 데이터를 쓰게 되면 파일에 환자 이름이 들어가므로 보관과 공유에 주의해야 합니다.
      </p>
    </Block>
  );
}

// ─── 정보 ────────────────────────────────────────────────────────────────────

function InfoSection() {
  const b = RISK_CONFIG.bands;
  const f = RISK_CONFIG.formula;
  return (
    <>
      <Block title="위험 점수 기준" description="처방 기준(4주·주 5회·하루 30분)을 바탕으로 정한 초기 가정치입니다. 실제 데이터로 보정이 필요합니다.">
        <ul className="space-y-1.5 text-sm">
          <li>정상 {b["정상"][0]}–{b["정상"][1]}점 · 주의 {b["주의"][0]}–{b["주의"][1]}점 · 이탈 위험 {b["이탈 위험"][0]}–{b["이탈 위험"][1]}점</li>
          <li>치료이탈: 처방 기간 중 {RISK_CONFIG.dropoutGapDays}일 이상 연속 미접속 ({b["치료이탈"][0]}–{b["치료이탈"][1]}점으로 표시)</li>
          <li>
            점수 = 연속 미접속일 × {f.gapPerDay} + 회차 지연 × {f.behindPerSession} + 정확도 하락(%p) × {f.accuracyPerPp} + 짧은 세션 {f.shortSessionBonus}
          </li>
          <li>매일 한국 시간 오전 9시대에 자동 점검해, 상태가 새로 나빠진 환자에게 알림을 만듭니다.</li>
        </ul>
      </Block>
      <Block title="안내">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>이 서비스는 진단이나 처방 변경이 아닌 참고용 보조 정보를 제공합니다.</li>
          <li>AI 경과 요약은 점수·단계·지표 숫자만 보내 만들며, 환자 이름·나이는 보내지 않습니다.</li>
          <li>현재 화면의 모든 환자와 기록은 시연용 가상 데이터입니다.</li>
        </ul>
      </Block>
    </>
  );
}
