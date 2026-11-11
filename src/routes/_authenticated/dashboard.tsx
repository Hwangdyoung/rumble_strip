import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { patientsOverviewQuery } from "@/lib/queries";
import { AlertOutcomeSummary } from "@/components/AlertOutcome";
import { RISK_LEVELS, type RiskLevel } from "@/lib/risk";
import { CauseBadge, LevelBadge, levelStyles } from "@/components/LevelBadge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SplitPatientDetail } from "@/components/SplitPatientDetail";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: zodValidator(z.object({ patient: fallback(z.string(), "").optional() })),
  head: () => ({
    meta: [
      { title: "대시보드 | 이탈방지턱" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "처방 환자별 이탈 위험 점수와 단계를 한눈에 확인합니다." },
      { property: "og:title", content: "대시보드 | 이탈방지턱" },
      { property: "og:description", content: "처방 환자별 이탈 위험 점수와 단계를 한눈에 확인합니다." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(patientsOverviewQuery()),
  component: Dashboard,
});

function formatDate(key: string | null) {
  if (!key) return "기록 없음";
  const [, m, d] = key.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

/** 알림 기준 설정 (이 브라우저에만 저장됩니다. 실제 서비스에서는 threshold_setting 테이블에 이력으로 저장한다고 가정) */
const SETTINGS_KEY = "rumble-strip:alert-settings";
const MAX_CAPACITY = 8; // 예시 환자 수 기준 (실제 서비스에서는 의료진이 하루에 연락 가능한 인원)
const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

type Filter = RiskLevel | "전체" | "알림 대상";

function Dashboard() {
  const { patient: patientId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selectPatient = (id?: string) => navigate({ search: (prev) => ({ ...prev, patient: id }), resetScroll: false });
  const { data: patients } = useSuspenseQuery(patientsOverviewQuery());
  const selectedId = patients.some((p) => p.id === patientId) ? patientId : undefined;
  const [retainedId, setRetainedId] = useState(selectedId);
  useEffect(() => {
    if (selectedId) {
      setRetainedId(selectedId);
      return;
    }
    const timer = window.setTimeout(() => setRetainedId(undefined), 300);
    return () => window.clearTimeout(timer);
  }, [selectedId]);
  const displayedId = selectedId ?? retainedId;
  const [filter, setFilter] = useState<Filter>("전체");

  // 알림 기준(threshold)과 하루 처리 가능 인원
  const [threshold, setThreshold] = useState(55);
  const [capacity, setCapacity] = useState(5);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const v = JSON.parse(raw) as { threshold?: number; capacity?: number };
        if (typeof v.threshold === "number") setThreshold(clampInt(v.threshold, 0, 100));
        if (typeof v.capacity === "number") setCapacity(clampInt(v.capacity, 1, MAX_CAPACITY));
      }
    } catch {
      /* 저장값을 읽지 못하면 기본값 사용 */
    }
    setSettingsLoaded(true);
  }, []);
  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ threshold, capacity }));
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [threshold, capacity, settingsLoaded]);

  // 정상 단계는 알림 대상에서 제외하고 '경과 관찰'로 둡니다.
  const targets = patients.filter((p) => p.risk.level !== "정상" && p.risk.score >= threshold);
  const targetIds = new Set(targets.map((p) => p.id));
  const diff = targets.length - capacity;
  const applyCapacity = () => {
    // 점수 순으로 capacity번째 환자의 점수를 기준으로 삼습니다. (동점이면 더 많아질 수 있음)
    const nth = patients[Math.min(capacity, patients.length) - 1];
    setThreshold(nth ? nth.risk.score : 0);
  };

  const counts = Object.fromEntries(RISK_LEVELS.map((l) => [l, patients.filter((p) => p.risk.level === l).length]));
  const rows = filter === "전체" ? patients : filter === "알림 대상" ? targets : patients.filter((p) => p.risk.level === filter);
  const split = Boolean(selectedId);

  return (
    <div className={cn("dashboard-split", displayedId && "has-detail")} data-open={split}>
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">환자 이탈 위험 현황</h1>
          <p className="mt-1 text-muted-foreground">위험 점수가 높은 환자부터 먼저 연락해 보세요.</p>
        </div>

        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-card" aria-label="알림 기준 설정">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">오늘 연락할 환자</h2>
            <p className="text-sm text-muted-foreground">정상 단계는 알림 대상에서 제외하고 경과 관찰로 둡니다.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Kpi label="알림 대상" value={`${targets.length}명`} />
            <Kpi label="전체 환자" value={`${patients.length}명`} />
            <Kpi
              label="처리 가능 대비"
              value={diff > 0 ? `초과 ${diff}명` : diff < 0 ? `여유 ${-diff}명` : "딱 맞음"}
              tone={diff > 0 ? "over" : "ok"}
            />
          </div>

          <div className={cn("grid gap-5", !split && "md:grid-cols-[1fr_auto] md:items-end")}>
            <div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="threshold" className="text-base">알림 기준 점수</Label>
                <span className="text-xl font-bold tabular-nums">{threshold}점 이상</span>
              </div>
              <Slider
                id="threshold"
                aria-label="알림 기준 점수"
                min={0}
                max={100}
                step={1}
                value={[threshold]}
                onValueChange={([v]) => setThreshold(v ?? 0)}
                className="mt-3"
              />
              <p className="mt-2 text-sm text-muted-foreground">
                낮추면 놓치는 환자는 줄지만 알림이 늘고, 높이면 알림은 줄지만 놓칠 수 있어요.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label htmlFor="capacity" className="text-base">하루 처리 가능 인원</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  max={MAX_CAPACITY}
                  value={capacity}
                  onChange={(e) => setCapacity(clampInt(Number(e.target.value), 1, MAX_CAPACITY))}
                  className="mt-2 h-11 w-28 text-base"
                />
              </div>
              <Button variant="outline" className="h-11" onClick={applyCapacity}>기준 자동 설정</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            처리 가능 인원은 1~{MAX_CAPACITY}명 (예시 환자 {MAX_CAPACITY}명 기준)입니다. 자동 설정은 점수 순으로 그 인원째 환자의 점수를 기준으로 맞춥니다.
          </p>
        </section>

        <AlertOutcomeSummary />

        <section className={cn("grid grid-cols-2 gap-3", split ? "md:grid-cols-3" : "md:grid-cols-5")}>
          <Button variant="ghost"
            onClick={() => setFilter("전체")}
            className={cn("block h-auto whitespace-normal rounded-2xl border bg-card p-4 text-left shadow-card transition", filter === "전체" && "ring-2 ring-primary")}
          >
            <div className="text-sm font-medium text-muted-foreground">전체 환자</div>
            <div className="mt-1 text-3xl font-bold">{patients.length}<span className="ml-1 text-base font-medium text-muted-foreground">명</span></div>
          </Button>
          {RISK_LEVELS.map((l) => (
            <Button variant="ghost"
              key={l}
              onClick={() => setFilter(l)}
              className={cn(
                "block h-auto whitespace-normal rounded-2xl border border-l-4 bg-card p-4 text-left shadow-card transition",
                levelStyles[l].card,
                filter === l && "ring-2 ring-primary",
              )}
            >
              <div className="text-sm font-medium text-muted-foreground">{l}</div>
              <div className="mt-1 text-3xl font-bold">{counts[l]}<span className="ml-1 text-base font-medium text-muted-foreground">명</span></div>
            </Button>
          ))}
        </section>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="단계별 필터">
          {(["전체", "알림 대상", ...RISK_LEVELS] as const).map((l) => (
            <Button variant="outline"
              key={l}
              role="tab"
              aria-selected={filter === l}
              onClick={() => setFilter(l)}
              className={cn(
                "h-auto rounded-full border px-4 py-2 text-sm font-medium transition",
                filter === l ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
              )}
            >
              {l}
            </Button>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
          {!split && (
            <div className="hidden grid-cols-[1.3fr_0.7fr_1fr_1fr_0.9fr_2.1fr_auto] gap-4 border-b bg-muted px-5 py-3 text-sm font-semibold text-muted-foreground md:grid">
              <span>환자</span><span>위험 점수</span><span>단계</span><span>추정 원인</span><span>최근 접속</span><span>주요 이유</span><span />
            </div>
          )}
          {rows.length === 0 && <p className="p-8 text-center text-muted-foreground">해당 조건의 환자가 없습니다.</p>}
          <ul className="divide-y">
            {rows.map((p) => (
              <li key={p.id}>
                <Button
                  variant="ghost"
                  onClick={() => selectPatient(p.id)}
                  data-patient-id={p.id}
                  aria-label={`${p.name} 환자 상세 보기`}
                  aria-expanded={patientId === p.id}
                  className={cn(
                    "grid h-auto w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 whitespace-normal rounded-none px-5 py-4 text-left text-base font-normal transition hover:bg-muted",
                    split ? "md:grid-cols-[1fr_auto_auto]" : "md:grid-cols-[1.3fr_0.7fr_1fr_1fr_0.9fr_2.1fr_auto]",
                    patientId === p.id && "bg-secondary ring-2 ring-inset ring-primary",
                  )}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {p.name}
                      {targetIds.has(p.id) && (
                        <span className="rounded-full bg-level-risk-soft px-2 py-0.5 text-xs font-semibold text-level-risk">알림 대상</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{p.age}세</div>
                  </div>
                  <div className="text-right md:text-left">
                    <span className="text-2xl font-bold tabular-nums">{p.risk.score}</span>
                    <span className="text-sm text-muted-foreground"> /100</span>
                  </div>
                  <div><LevelBadge level={p.risk.level} /></div>
                  {!split && (
                    <>
                      <div><CauseBadge cause={p.risk.cause} /></div>
                      <div className="text-right text-sm text-muted-foreground md:text-left md:text-base md:text-foreground">
                        {formatDate(p.risk.metrics.lastPlayDate)}
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground md:col-span-1 md:text-base">
                        {p.risk.reasons.slice(0, 2).join(", ")}
                      </div>
                    </>
                  )}
                  <ChevronRight className={cn("hidden size-5 text-muted-foreground", !split && "md:block")} />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {displayedId && <SplitPatientDetail patientId={displayedId} closing={!split} onClose={() => selectPatient()} />}
    </div>
  );
}

function Kpi({ label, value, tone = "ok" }: { label: string; value: string; tone?: "ok" | "over" }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", tone === "over" && "text-level-risk")}>{value}</div>
    </div>
  );
}
