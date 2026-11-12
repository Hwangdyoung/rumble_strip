import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { completeFollowUps, createFollowUp, myStaffQuery, patientDetailQuery, recordContact, staffListQuery } from "@/lib/queries";
import { canSeeClinical } from "@/lib/roles";
import { CounselorPatientDetail } from "@/components/CounselorPatientDetail";
import { asOfFor, computeRisk, riskHistory, weeklySummary, summaryEvidence, CAUSE_ACTION, RISK_CONFIG, toDateKey } from "@/lib/risk";
import type { RiskLevel, RiskResult } from "@/lib/risk";
import type { CalendarLog } from "@/lib/calendar";
import { ResponseGuide } from "@/components/ResponseGuide";
import { ACTION_MEMO_TEMPLATE, buildGuide } from "@/lib/response-guide";
import { defaultFollowUpDate } from "@/lib/follow-up";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import { CauseBadge, LevelBadge } from "@/components/LevelBadge";
import { PlayCalendar } from "@/components/PlayCalendar";
import { PatientContact } from "@/components/PatientContact";
import { ContactHistory } from "@/components/ContactHistory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fetchAiSummary } from "@/lib/ai-summary.server";
import { aiInputChips, aiSummaryQueryKey, riskToAiInput, fallbackSummary } from "@/lib/ai-summary";

const ACTION_TYPES = ["전화 상담", "문자", "기타"] as const;
// 그래프 툴팁: 다크 모드에서도 읽히도록 테마 색을 쓴다
const TOOLTIP_STYLE = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" };

const TABS = [
  { id: "guide", label: "연락 도우미" },
  { id: "overview", label: "경과 요약" },
  { id: "charts", label: "그래프" },
  { id: "calendar", label: "캘린더" },
  { id: "history", label: "연락 이력" },
] as const;
type TabId = (typeof TABS)[number]["id"];
/** 다른 환자를 눌러도 보던 탭을 유지한다 (새로고침하면 처음 탭) */
let lastTab: TabId = "guide";

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-card", className)}>
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function PatientDetail({ id, panel = false }: { id: string; panel?: boolean }) {
  // 역할별 화면: 상담원은 서버가 골라 보낸 정보만 쓰는 화면 (SQL 009에서 원본·점수·알림을 DB가 막음)
  const me = useQuery(myStaffQuery());
  if (me.isPending) return <p className="py-12 text-center text-muted-foreground" role="status">환자 정보를 불러오는 중…</p>;
  if (!canSeeClinical(me.data?.staff)) return <CounselorPatientDetail id={id} panel={panel} />;
  return <ClinicalPatientDetail id={id} panel={panel} />;
}

function ClinicalPatientDetail({ id, panel }: { id: string; panel: boolean }) {
  const { data, isPending, isError, refetch } = useQuery(patientDetailQuery(id));
  if (isPending) return <p className="py-12 text-center text-muted-foreground" role="status">환자 정보를 불러오는 중…</p>;
  if (isError) return <div className="space-y-4 py-12 text-center"><p>환자 정보를 불러오지 못했습니다.</p><Button variant="outline" onClick={() => refetch()}>다시 시도</Button></div>;
  const patient = data?.patient;
  if (!patient) return <p className="py-12 text-center text-muted-foreground">환자를 찾을 수 없습니다.</p>;
  const asOf = asOfFor(data.logs);
  const risk = computeRisk(patient, data.logs, asOf);
  const history = riskHistory(patient, data.logs, asOf);
  const actionDates = [...new Set(data.actions.map((a) => toDateKey(new Date(a.created_at)).slice(5)))];
  const weeks = weeklySummary(patient, data.logs);

  return (
    <PatientDetailContent
      id={id}
      panel={panel}
      patient={patient}
      risk={risk}
      history={history}
      actionDates={actionDates}
      weeks={weeks}
      asOf={asOf}
      logs={data.logs}
      actions={data.actions}
      alerts={data.alerts}
      followUps={data.followUps}
    />
  );
}

function PatientDetailContent({
  id,
  panel,
  patient,
  risk,
  history,
  actionDates,
  weeks,
  asOf,
  logs,
  actions,
  alerts,
  followUps,
}: {
  id: string;
  panel: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patient: any;
  risk: RiskResult;
  history: ReturnType<typeof riskHistory>;
  actionDates: string[];
  weeks: ReturnType<typeof weeklySummary>;
  asOf: Date;
  logs: CalendarLog[];
  actions: Array<{ id: string; action_type: string; memo: string | null; created_at: string; staff_id?: string | null }>;
  followUps: Array<{ id: string; due_date: string; assignee_id: string | null; note: string }>;
  alerts: Array<{ id: string; message: string; status: string; created_at: string; outcome: string; outcome_note: string | null; alert_score: number | null; alert_level: string | null; assignee_id: string | null }>;
}) {
  // AI 경과 요약 쿼리 — 환자 화면을 열 때만, 같은 점수·단계·날짜에 한 번만 호출
  const todayKey = toDateKey(new Date());
  const aiQueryKey = aiSummaryQueryKey(id, risk.score, risk.level, todayKey);
  const aiInput = riskToAiInput(risk, weeks);
  // 대응 가이드: 단계·원인·지표로 할 일과 연락 문장을 만든다 (점수 계산은 risk.ts 결과를 그대로 씀)
  const { data: me } = useQuery(myStaffQuery());
  const guide = buildGuide({
    risk,
    patientName: patient.name,
    weeklyTargetDays: patient.weekly_target_days,
    sessionTargetMinutes: patient.session_target_minutes,
    unreachable: alerts.some((a) => a.status !== "조치완료" && a.outcome === "연락 불가"),
    staffName: me?.staff?.name ?? null,
  });
  const [tab, setTab] = useState<TabId>(lastTab);
  const [slideDir, setSlideDir] = useState<"left" | "right">("left");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const historyCount = alerts.length + actions.length;
  const goTab = (next: TabId) => {
    if (next === tab) return;
    setSlideDir(TABS.findIndex((t) => t.id === next) > tabIndex ? "left" : "right");
    setTab(next);
    lastTab = next;
    // 아래로 내려 본 상태면 새 탭의 처음(탭 바로 아래)으로 올린다
    const el = sentinelRef.current;
    const sc = el?.closest(".overflow-y-auto");
    if (el && sc) {
      const d = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      if (d < 0) sc.scrollTop += d;
    }
  };
  const [actionOpen, setActionOpen] = useState(false);
  const [actionPreset, setActionPreset] = useState<ActionPreset | null>(null);
  const openActionWith = (kind: "call" | "sms") => {
    setActionPreset(kind === "call" ? { type: "전화 상담", memo: ACTION_MEMO_TEMPLATE.call } : { type: "문자", memo: ACTION_MEMO_TEMPLATE.sms(guide.sms) });
    setActionOpen(true);
  };
  const aiSummaryQuery = useQuery({
    queryKey: aiQueryKey,
    queryFn: async () => {
      const result = await fetchAiSummary({ data: aiInput });
      return result.summary;
    },
    // 3초 안에 응답 없으면 오류 처리 → fallback
    networkMode: "always",
    retry: false,
    staleTime: 1000 * 60 * 60 * 24, // 24시간 캐시
    gcTime: 1000 * 60 * 60 * 24,
  });

  return (
    <div className="space-y-6">
      {!panel && <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> 대시보드로
      </Link>}

      {/* 맨 위: 누구인지, 왜 연락해야 하는지, 누가 언제 연락하는지 */}
      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-card">
        <div className={cn("flex flex-col gap-4", !panel && "sm:flex-row sm:items-start sm:justify-between")}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold sm:text-3xl">{patient.name}</h1>
              <LevelBadge level={risk.level} />
              <span className="text-lg font-bold tabular-nums">{risk.score}<span className="text-sm font-normal text-muted-foreground">/100</span></span>
            </div>
            <p className="mt-1 font-medium">{risk.reasons[0]}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {patient.age}세 · 처방 시작 {patient.prescription_start_date} · {patient.prescription_weeks}주 / 주 {patient.weekly_target_days}회 / {patient.session_target_minutes}분
              {followUps[0] && <> · <span className="font-medium text-foreground">다음 연락 {Number(followUps[0].due_date.slice(5, 7))}/{Number(followUps[0].due_date.slice(8))}</span></>}
            </p>
          </div>
          {risk.level === "정상" ? (
            <span className="inline-flex h-12 shrink-0 items-center rounded-xl bg-level-normal-soft px-4 font-semibold text-level-normal">경과 관찰 중</span>
          ) : (
            <ActionDialog
              patientId={patient.id}
              open={actionOpen}
              onOpenChange={(v) => {
                setActionOpen(v);
                if (!v) setActionPreset(null);
              }}
              preset={actionPreset}
              level={risk.level}
              openFollowUps={followUps}
            />
          )}
        </div>
        <PatientContact patientId={patient.id} />
      </div>

      {/* 아래: 탭으로 나눠 한 번에 한 화면씩 (옆으로 넘김) */}
      <div ref={sentinelRef} aria-hidden />
      <div
        role="tablist"
        aria-label="환자 상세 보기"
        className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 shadow-card"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          const next = (tabIndex + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
          goTab(TABS[next]!.id);
          (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="patient-tabpanel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => goTab(t.id)}
            className={cn(
              "flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
            {t.id === "history" && historyCount > 0 && <span className="ml-1 tabular-nums opacity-80">{historyCount}</span>}
          </button>
        ))}
      </div>

      <div
        key={tab}
        id="patient-tabpanel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        data-dir={slideDir}
        className="tab-slide @container space-y-6"
      >
        {tab === "guide" && (
      <ResponseGuide
            guide={guide}
            sheet={{
              patientName: patient.name,
              age: patient.age,
              prescriptionStartDate: patient.prescription_start_date,
              prescriptionWeeks: patient.prescription_weeks,
              weeklyTargetDays: patient.weekly_target_days,
              sessionTargetMinutes: patient.session_target_minutes,
              adherence: risk.metrics.adherence,
              recentDays: risk.metrics.recentDays,
              currentGap: risk.metrics.currentGap,
              sessionsDone: risk.metrics.sessionsDone,
              sessionsExpected: risk.metrics.sessionsExpected,
              weeks,
              notes: guide.plainSummary,
              staffName: me?.staff?.name ?? null,
              nextContactDate: followUps[0]?.due_date ?? null,
            }}
            normal={risk.level === "정상"}
            onRecord={openActionWith}
          />
        )}

        {tab === "overview" && (
          <>
      <section className="rounded-2xl border border-teal bg-accent p-5 shadow-card">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-accent-foreground">
          <Sparkles className="size-5" /> AI 경과 요약
        </h2>
        {/* AI 요약 텍스트: 로딩 중 / 성공 / 실패(폴백) */}
        {aiSummaryQuery.isPending ? (
          <p className="text-lg text-muted-foreground animate-pulse">AI 요약을 생성하는 중…</p>
        ) : (
          <div className="flex flex-wrap items-start gap-2">
            <p className="text-lg flex-1">
            {aiSummaryQuery.isError
              ? fallbackSummary(risk)
              : (aiSummaryQuery.data ?? fallbackSummary(risk))}
            </p>
            <span className="shrink-0 mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {aiSummaryQuery.isError ? "규칙 기반 요약" : "AI가 생성한 요약"}
            </span>
          </div>
        )}
        {!aiSummaryQuery.isPending && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            {aiSummaryQuery.isError ? "요약에 쓰인 수치" : "AI에 전달한 수치"}
            </p>
            <ul className="flex flex-wrap gap-1.5" aria-label="요약 근거 수치">
            {(aiSummaryQuery.isError ? summaryEvidence(risk).map((e) => e.chip) : aiInputChips(aiInput)).map((c) => (
              <li key={c} className="rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium tabular-nums">{c}</li>
            ))}
            </ul>
          </div>
        )}
        {risk.cause && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-base">
            <span className="font-semibold">추정 원인</span> <CauseBadge cause={risk.cause} />
            <span className="text-muted-foreground">· 권장 조치: {CAUSE_ACTION[risk.cause]} 연락 순서와 문장은 '연락 도우미' 탭에 있습니다.</span>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">진단이나 처방 변경이 아닌 참고용 보조 정보입니다.</p>
      </section>
            <div className="grid gap-6 @xl:grid-cols-2">
              <Card title="핵심 지표">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="연속 미접속" value={`${risk.metrics.currentGap}일`} hint={risk.metrics.lastPlayDate ? `마지막 접속 ${risk.metrics.lastPlayDate.slice(5)}` : "기록 없음"} />
          <Stat label="진행 회차" value={`${risk.metrics.sessionsDone}/${risk.metrics.sessionsExpected}회`} hint="처방 기준 대비" />
          <Stat
            label="최근 정확도"
            value={risk.metrics.recentAccuracy == null ? "—" : `${Math.round(risk.metrics.recentAccuracy)}%`}
            hint={risk.metrics.accuracyDrop >= 1 ? `처음 대비 -${Math.round(risk.metrics.accuracyDrop)}%p` : undefined}
          />
          <Stat
            label="평균 세션"
            value={risk.metrics.recentAvgMinutes == null ? "—" : `${Math.round(risk.metrics.recentAvgMinutes)}분`}
            hint={`목표 ${patient.session_target_minutes}분`}
          />
        </div>
              </Card>
              <Card title="위험 이유">
          <ul className="space-y-2">
            {risk.reasons.map((r) => (
              <li key={r} className="flex gap-2 text-base"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{r}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">경과 {risk.metrics.elapsedDays}일차 기준 · 규칙 기반 초기 가정치</p>
              </Card>
            </div>
            <ScoreComposition risk={risk} />
          </>
        )}

        {tab === "charts" && (
          <>
            <Card title="위험 점수 추이">
          <div className="h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={20} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <ReferenceLine y={RISK_CONFIG.bands["주의"][0]} stroke="var(--level-caution)" strokeDasharray="4 4" />
                <ReferenceLine y={RISK_CONFIG.bands["이탈 위험"][0]} stroke="var(--level-risk)" strokeDasharray="4 4" />
                <ReferenceLine y={RISK_CONFIG.bands["치료이탈"][0]} stroke="var(--level-dropout)" strokeDasharray="4 4" />
                {actionDates.map((d) => (
                  <ReferenceLine key={d} x={d} stroke="var(--teal)" strokeWidth={2} label={{ value: "조치", position: "insideTopRight", fill: "var(--teal)", fontSize: 12 }} />
                ))}
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--muted-foreground)" }} formatter={(v: number, _n, item) => [`${v}점 (${item.payload.level})`, "위험 점수"]} />
                <Area type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2.5} fill="url(#riskFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
            </Card>
            <Card title="최근 4주 플레이 기록">
              <div className="grid min-w-0 gap-6 @lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">주별 접속 일수 (목표 {patient.weekly_target_days}일)</p>
            <div className="h-44 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 13, fill: "var(--muted-foreground)" }} />
                  <YAxis domain={[0, 7]} allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <ReferenceLine y={patient.weekly_target_days} stroke="var(--teal)" strokeDasharray="4 4" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--muted-foreground)" }} formatter={(v: number) => [`${v}일`, "접속 일수"]} />
                  <Bar dataKey="days" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">평균 세션 시간 (목표 {patient.session_target_minutes}분)</p>
            <div className="h-44 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 13, fill: "var(--muted-foreground)" }} />
                  <YAxis domain={[0, 40]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <ReferenceLine y={patient.session_target_minutes} stroke="var(--teal)" strokeDasharray="4 4" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "var(--muted-foreground)" }} formatter={(v: number) => [`${v}분`, "평균 세션"]} />
                  <Bar dataKey="avgMinutes" fill="var(--teal)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
            </Card>
          </>
        )}

        {tab === "calendar" && (
          <Card title="플레이 캘린더">
            <PlayCalendar patient={patient} logs={logs} actions={actions} alerts={alerts} />
          </Card>
        )}

        {tab === "history" && (
          <Card title="연락 이력">
            <FollowUpList patientId={patient.id} items={followUps} />
            <ContactHistory patientId={patient.id} alerts={alerts} actions={actions} logs={logs} />
          </Card>
        )}

        {/* 앞뒤 탭으로 넘기기 */}
        <div className="flex items-center justify-between gap-2 border-t pt-4">
          {tabIndex > 0 ? (
            <Button variant="ghost" onClick={() => goTab(TABS[tabIndex - 1]!.id)}>
              <ChevronLeft className="size-4" /> {TABS[tabIndex - 1]!.label}
            </Button>
          ) : <span />}
          {tabIndex < TABS.length - 1 && (
            <Button variant="ghost" onClick={() => goTab(TABS[tabIndex + 1]!.id)}>
              {TABS[tabIndex + 1]!.label} <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreComposition({ risk }: { risk: RiskResult }) {
  const b = RISK_CONFIG.bands;
  const thresholds = [
    { level: "정상" as const, range: `${b["정상"][0]}–${b["정상"][1]}점` },
    { level: "주의" as const, range: `${b["주의"][0]}–${b["주의"][1]}점` },
    { level: "이탈 위험" as const, range: `${b["이탈 위험"][0]}–${b["이탈 위험"][1]}점` },
    { level: "치료이탈" as const, range: `${RISK_CONFIG.dropoutGapDays}일 이상 연속 미접속 (${b["치료이탈"][0]}–${b["치료이탈"][1]}점 표시)` },
  ];
  return (
    <Card title="점수 구성">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">항목</th>
              <th scope="col" className="py-2 pr-3 font-medium">계산식</th>
              <th scope="col" className="py-2 text-right font-medium">점수</th>
            </tr>
          </thead>
          <tbody>
            {risk.breakdown.map((item) => (
              <tr key={item.key} className={cn("border-b", item.points === 0 && "text-muted-foreground")}>
                <td className="py-2 pr-3 font-medium">{item.label}</td>
                <td className="py-2 pr-3 tabular-nums">{item.detail}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{item.points}점</td>
              </tr>
            ))}
            {risk.adjustment && (
              <tr className="border-b">
                <td className="py-2 pr-3 font-medium">단계 구간 보정</td>
                <td className="py-2 pr-3">{risk.adjustment.reason}</td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {risk.adjustment.points > 0 ? "+" : ""}{risk.adjustment.points}점
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2} className="pt-2 text-left font-bold">합계 (위험 점수)</th>
              <td className="pt-2 text-right text-base font-bold tabular-nums">{risk.score}점</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="단계 기준">
        {thresholds.map((t) => (
          <li key={t.level} className={cn(t.level === risk.level && "font-semibold text-foreground")}>
            {t.level} {t.range}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        처방 기준(4주·주 5회·하루 30분) 기반 초기 가정치, 실제 데이터로 보정 필요
      </p>
    </Card>
  );
}

/** 이 환자의 다음 연락 예정 (완료 처리 가능) */
export function FollowUpList({ patientId, items }: { patientId: string; items: Array<{ id: string; due_date: string; assignee_id: string | null; note: string }> }) {
  const qc = useQueryClient();
  const { data: staff = [] } = useQuery(staffListQuery());
  const m = useMutation({
    mutationFn: (id: string) => completeFollowUps([id]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("예정된 연락을 완료로 표시했습니다.");
    },
    onError: () => toast.error("완료 처리하지 못했습니다."),
  });
  if (items.length === 0) return null;
  const today = toDateKey(new Date());
  return (
    <ul className="mb-4 space-y-2" aria-label="다음 연락 예정">
      {items.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent px-4 py-2.5">
          <span>
            <span className="font-semibold">다음 연락 예정 {Number(f.due_date.slice(5, 7))}월 {Number(f.due_date.slice(8))}일</span>
            {f.due_date < today && <span className="ml-2 rounded-full bg-level-risk-soft px-1.5 py-0.5 text-xs font-semibold text-level-risk">지남</span>}
            {f.due_date === today && <span className="ml-2 rounded-full bg-level-caution-soft px-1.5 py-0.5 text-xs font-semibold text-level-caution-ink">오늘</span>}
            <span className="ml-2 text-sm text-muted-foreground">{staff.find((s) => s.id === f.assignee_id)?.name ?? "담당 미정"}</span>
          </span>
          <Button variant="outline" size="sm" disabled={m.isPending} onClick={() => m.mutate(f.id)}>완료</Button>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export type ActionPreset = { type: (typeof ACTION_TYPES)[number]; memo: string };

export function ActionDialog({
  patientId,
  open: openProp,
  onOpenChange,
  preset,
  level,
  openFollowUps = [],
  limited = false,
}: {
  patientId: string;
  /** 상담원: 알림을 직접 읽지 못하므로 DB 함수 record_contact로 기록 */
  limited?: boolean;
  /** 다음 연락 예정일 기본값을 정하는 데 씀 */
  level: RiskLevel;
  /** 이 환자의 열린 다음 연락 일정 */
  openFollowUps?: Array<{ id: string; due_date: string }>;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** 대응 가이드에서 열면 유형과 메모 틀을 미리 채운다 */
  preset?: ActionPreset | null;
}) {
  const qc = useQueryClient();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInnerOpen(v));
  const [type, setType] = useState<(typeof ACTION_TYPES)[number]>("전화 상담");
  const [memo, setMemo] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [completeOpen, setCompleteOpen] = useState(true);
  useEffect(() => {
    if (!open) return;
    if (preset) {
      setType(preset.type);
      setMemo(preset.memo);
    }
    setNextDate(defaultFollowUpDate(level));
    setCompleteOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset]);
  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("로그인이 필요합니다.");
      if (limited) {
        const alertId = await recordContact(patientId, type, memo);
        if (completeOpen) await completeFollowUps(openFollowUps.map((f) => f.id));
        if (nextDate) await createFollowUp({ patientId, alertId, dueDate: nextDate, assigneeId: u.user.id });
        return;
      }
      const { data: open } = await supabase.from("alerts").select("id").eq("patient_id", patientId).neq("status", "조치완료").order("created_at", { ascending: false });
      const { error } = await supabase.from("actions").insert({ patient_id: patientId, action_type: type, memo, staff_id: u.user.id, alert_id: open?.[0]?.id ?? null });
      if (error) throw error;
      if (open?.length) {
        const { error: ue } = await supabase.from("alerts").update({ status: "조치완료", resolved_at: new Date().toISOString() }).in("id", open.map((a) => a.id));
        if (ue) throw ue;
      }
      // 예정돼 있던 연락은 이번 조치로 끝냄, 새 예정일이 있으면 만든다
      if (completeOpen) await completeFollowUps(openFollowUps.map((f) => f.id));
      if (nextDate) await createFollowUp({ patientId, alertId: open?.[0]?.id ?? null, dueDate: nextDate, assigneeId: u.user.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success(nextDate ? `조치를 기록하고 ${Number(nextDate.slice(5, 7))}월 ${Number(nextDate.slice(8))}일에 다시 연락하도록 잡았습니다.` : "조치가 기록되었습니다.");
      setOpen(false);
      setMemo("");
    },
    onError: () => toast.error("저장하지 못했습니다. 다시 시도해 주세요."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 shrink-0"><Plus /> 연락 기록하기</Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg" aria-describedby={undefined}>
        <DialogHeader><DialogTitle className="text-xl">연락 기록하기</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">연락 방법</Label>
            <div className="flex gap-2">
              {ACTION_TYPES.map((t) => (
                <Button
                  variant="outline"
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "h-auto flex-1 rounded-xl border px-3 py-3 font-medium transition",
                    type === t ? "border-primary bg-secondary text-secondary-foreground ring-2 ring-primary" : "hover:bg-muted",
                  )}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo" className="text-base">메모</Label>
            <Textarea id="memo" rows={4} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 보호자와 통화, 다음 주 재접속 약속" className="text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="next-date" className="text-base">다음 연락 예정일</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input id="next-date" type="date" value={nextDate} min={toDateKey(new Date())} onChange={(e) => setNextDate(e.target.value)} className="h-11 w-44 text-base" />
              {nextDate && <Button type="button" variant="ghost" size="sm" onClick={() => setNextDate("")}>예정 없음</Button>}
            </div>
            <p className="text-xs text-muted-foreground">단계에 맞춰 기본 날짜가 정해집니다. 그날 대시보드에 '오늘 다시 연락'으로 표시됩니다.</p>
          </div>
          {openFollowUps.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={completeOpen} onChange={(e) => setCompleteOpen(e.target.checked)} className="size-4" />
              예정된 연락 {openFollowUps.length}건도 함께 완료
            </label>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="h-11">
            {mutation.isPending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
