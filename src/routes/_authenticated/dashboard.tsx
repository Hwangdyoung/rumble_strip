import { createFileRoute, Link } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { patientsOverviewQuery, worklistQuery } from "@/lib/queries";
import { AlertOutcomeSummary } from "@/components/AlertOutcome";
import { DailyCheckStatus } from "@/components/DailyCheck";
import { useAlertSettings } from "@/lib/alert-settings";
import { usePreferences } from "@/lib/preferences";
import { TodayPanel } from "@/components/TodayPanel";
import { TodayWorklist } from "@/components/TodayWorklist";
import { RISK_LEVELS, type RiskLevel } from "@/lib/risk";
import { CauseBadge, LevelBadge } from "@/components/LevelBadge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  const prefs = usePreferences();
  const [filter, setFilter] = useState<Filter>(prefs.defaultFilter);

  // 알림 기준(threshold)과 하루 처리 가능 인원: 설정 화면에서 바꾸고 여기서는 읽기만 한다 (이 브라우저에 저장)
  const { threshold, capacity } = useAlertSettings();

  // 정상 단계는 알림 대상에서 제외하고 '경과 관찰'로 둡니다.
  const targets = patients.filter((p) => p.risk.level !== "정상" && p.risk.score >= threshold);
  const targetIds = new Set(targets.map((p) => p.id));
  const diff = targets.length - capacity;

  const counts = Object.fromEntries(RISK_LEVELS.map((l) => [l, patients.filter((p) => p.risk.level === l).length]));
  const rows = filter === "전체" ? patients : filter === "알림 대상" ? targets : patients.filter((p) => p.risk.level === filter);
  const split = Boolean(selectedId);
  const { data: worklist } = useQuery(worklistQuery());
  const openAlertCount = worklist ? worklist.filter((a) => a.status !== "조치완료").length : undefined;

  return (
    <div className={cn("dashboard-split", displayedId && "has-detail")} data-open={split}>
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">환자 이탈 위험 현황</h1>
          <p className="mt-1 text-muted-foreground">위험 점수가 높은 환자부터 먼저 연락해 보세요.</p>
        </div>

        <TodayPanel
          title="오늘 업무"
          collapsed={split}
          initialTabId={prefs.firstTab}
          headerRight={<DailyCheckStatus inline />}
          tabs={[
            {
              id: "alerts",
              label: "처리할 알림",
              badge: openAlertCount,
              content: <TodayWorklist embedded />,
            },
            {
              id: "contact",
              label: "연락할 환자",
              badge: targets.length,
              content: (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      알림 기준 <b className="tabular-nums">{threshold}점 이상</b> · 처리 가능 {capacity}명
                      {diff > 0 ? <span className="font-semibold text-level-risk"> · {diff}명 초과</span> : <span className="text-muted-foreground"> · 여유 {-diff}명</span>}
                    </p>
                    <Link to="/settings" search={{ section: "work" }} className="text-sm font-medium text-primary underline-offset-2 hover:underline">기준 바꾸기</Link>
                  </div>
                  {targets.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">지금 기준으로 연락할 환자가 없습니다.</p>
                  ) : (
                    <ul className="divide-y">
                      {targets.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => selectPatient(p.id)}
                            className={cn("grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted", patientId === p.id && "bg-secondary")}
                          >
                            <span className="min-w-0">
                              <span className="font-semibold">{p.name}</span>
                              <span className="ml-2 text-sm text-muted-foreground">{p.risk.reasons.slice(0, 1).join("")}</span>
                            </span>
                            <span className="text-lg font-bold tabular-nums">{p.risk.score}</span>
                            <LevelBadge level={p.risk.level} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">정상 단계는 알림 대상에서 제외하고 경과 관찰로 둡니다. 점수가 높은 순입니다.</p>
                </div>
              ),
            },
            { id: "outcomes", label: "알림 결과", content: <AlertOutcomeSummary embedded /> },
          ]}
        />

        <div className={cn("gap-2", split ? "grid grid-cols-3" : "flex flex-wrap")} role="tablist" aria-label="단계별 필터">
          {(["전체", "알림 대상", ...RISK_LEVELS] as const).map((l) => (
            <Button variant="outline"
              key={l}
              role="tab"
              aria-selected={filter === l}
              onClick={() => setFilter(l)}
              className={cn(
                "h-auto rounded-full border text-sm font-medium transition",
                split ? "w-full px-2 py-2" : "px-4 py-2",
                filter === l ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
              )}
            >
              {l}
              <span className={cn("tabular-nums", filter === l ? "opacity-80" : "text-muted-foreground")}>
                {l === "전체" ? patients.length : l === "알림 대상" ? targets.length : counts[l]}
              </span>
            </Button>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
          {!split && (
            <div className="hidden grid-cols-[1.3fr_0.7fr_1fr_1fr_0.9fr_2.1fr_auto] gap-4 border-b bg-muted px-5 py-3 text-sm font-semibold text-muted-foreground md:grid">
              <span>환자</span><span>위험 점수</span><span>단계</span><span>추정 원인</span><span>최근 접속</span><span>주요 이유</span><span />
            </div>
          )}
          {patients.length === 0 ? (
            <div className="space-y-1 p-8 text-center">
              <p className="font-semibold">담당 환자가 없습니다.</p>
              <p className="text-muted-foreground">관리자에게 담당 환자 배정을 요청하세요. 배정되면 이 목록에 나타납니다.</p>
            </div>
          ) : (
            rows.length === 0 && <p className="p-8 text-center text-muted-foreground">해당 조건의 환자가 없습니다.</p>
          )}
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
