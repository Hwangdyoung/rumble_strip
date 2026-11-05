import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { patientsOverviewQuery } from "@/lib/queries";
import { RISK_LEVELS, type RiskLevel } from "@/lib/risk";
import { LevelBadge, levelStyles } from "@/components/LevelBadge";
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

function Dashboard() {
  const { patient: patientId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selectPatient = (id?: string) => navigate({ search: (prev) => ({ ...prev, patient: id }), resetScroll: false });
  const { data: patients } = useSuspenseQuery(patientsOverviewQuery());
  const [filter, setFilter] = useState<RiskLevel | "전체">("전체");
  const counts = Object.fromEntries(RISK_LEVELS.map((l) => [l, patients.filter((p) => p.risk.level === l).length]));
  const rows = filter === "전체" ? patients : patients.filter((p) => p.risk.level === filter);
  const split = Boolean(patientId);

  return (
    <div className={cn("flex flex-col gap-6 md:flex-row md:items-start")}>
      <div className={cn("min-w-0 flex-1 space-y-6 transition-all duration-300 motion-reduce:transition-none", split && "md:w-2/5 md:flex-none")}>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">환자 이탈 위험 현황</h1>
          <p className="mt-1 text-muted-foreground">위험 점수가 높은 환자부터 먼저 연락해 보세요.</p>
        </div>

        <section className={cn("grid grid-cols-2 gap-3", split ? "md:grid-cols-3" : "md:grid-cols-5")}>
          <button
            onClick={() => setFilter("전체")}
            className={cn("rounded-2xl border bg-card p-4 text-left shadow-card transition", filter === "전체" && "ring-2 ring-primary")}
          >
            <div className="text-sm font-medium text-muted-foreground">전체 환자</div>
            <div className="mt-1 text-3xl font-bold">{patients.length}<span className="ml-1 text-base font-medium text-muted-foreground">명</span></div>
          </button>
          {RISK_LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setFilter(l)}
              className={cn(
                "rounded-2xl border border-l-4 bg-card p-4 text-left shadow-card transition",
                levelStyles[l].card,
                filter === l && "ring-2 ring-primary",
              )}
            >
              <div className="text-sm font-medium text-muted-foreground">{l}</div>
              <div className="mt-1 text-3xl font-bold">{counts[l]}<span className="ml-1 text-base font-medium text-muted-foreground">명</span></div>
            </button>
          ))}
        </section>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="단계별 필터">
          {(["전체", ...RISK_LEVELS] as const).map((l) => (
            <button
              key={l}
              role="tab"
              aria-selected={filter === l}
              onClick={() => setFilter(l)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                filter === l ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
          {!split && (
            <div className="hidden grid-cols-[1.2fr_0.8fr_1fr_0.9fr_2.4fr_auto] gap-4 border-b bg-muted px-5 py-3 text-sm font-semibold text-muted-foreground md:grid">
              <span>환자</span><span>위험 점수</span><span>단계</span><span>최근 접속</span><span>주요 이유</span><span />
            </div>
          )}
          {rows.length === 0 && <p className="p-8 text-center text-muted-foreground">해당 단계의 환자가 없습니다.</p>}
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
                    split ? "md:grid-cols-[1fr_auto_auto]" : "md:grid-cols-[1.2fr_0.8fr_1fr_0.9fr_2.4fr_auto]",
                    patientId === p.id && "bg-secondary ring-2 ring-inset ring-primary",
                  )}
                >
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-muted-foreground">{p.age}세</div>
                  </div>
                  <div className="text-right md:text-left">
                    <span className="text-2xl font-bold tabular-nums">{p.risk.score}</span>
                    <span className="text-sm text-muted-foreground"> /100</span>
                  </div>
                  <div><LevelBadge level={p.risk.level} /></div>
                  {!split && (
                    <>
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

      {patientId && <SplitPatientDetail patientId={patientId} onClose={() => selectPatient()} />}
    </div>
  );
}
