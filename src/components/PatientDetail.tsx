import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { patientDetailQuery } from "@/lib/queries";
import { asOfFor, computeRisk, riskHistory, weeklySummary, summaryEvidence, CAUSE_ACTION, RISK_CONFIG, toDateKey } from "@/lib/risk";
import type { RiskResult } from "@/lib/risk";
import type { CalendarLog } from "@/lib/calendar";
import { setAlertStatus, type AlertStatus } from "@/lib/queries";
import { alertStatusStyle } from "@/components/AlertsBell";
import { AlertOutcomePicker } from "@/components/AlertOutcome";
import { suggestOutcome } from "@/lib/alert-outcome";
import { Sparkles } from "lucide-react";
import { CauseBadge, LevelBadge } from "@/components/LevelBadge";
import { PlayCalendar } from "@/components/PlayCalendar";
import { PatientStaffBadges } from "@/components/PatientStaffBadges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fetchAiSummary } from "@/lib/ai-summary.server";
import { aiInputChips, aiSummaryQueryKey, riskToAiInput, fallbackSummary } from "@/lib/ai-summary";

const ACTION_TYPES = ["전화 상담", "문자", "기타"] as const;

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-card", className)}>
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function PatientDetail({ id, panel = false }: { id: string; panel?: boolean }) {
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
  actions: Array<{ id: string; action_type: string; memo: string | null; created_at: string }>;
  alerts: Array<{ id: string; message: string; status: string; created_at: string; outcome: string; outcome_note: string | null; alert_score: number | null; alert_level: string | null }>;
}) {
  // AI 경과 요약 쿼리 — 환자 화면을 열 때만, 같은 점수·단계·날짜에 한 번만 호출
  const todayKey = toDateKey(new Date());
  const aiQueryKey = aiSummaryQueryKey(id, risk.score, risk.level, todayKey);
  const aiInput = riskToAiInput(risk, weeks);
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

      <div className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card", !panel && "sm:flex-row sm:items-center sm:justify-between")}>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold sm:text-3xl">{patient.name}</h1>
            <LevelBadge level={risk.level} />
          </div>
          <p className="mt-1 text-muted-foreground">
            {patient.age}세 · 처방 시작 {patient.prescription_start_date} · {patient.prescription_weeks}주 / 주 {patient.weekly_target_days}회 / {patient.session_target_minutes}분
          </p>
          <PatientStaffBadges patientId={patient.id} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">위험 점수</div>
            <div className="text-4xl font-bold tabular-nums">{risk.score}<span className="text-lg text-muted-foreground">/100</span></div>
          </div>
          {risk.level === "정상" ? (
            <span className="inline-flex h-12 items-center rounded-xl bg-level-normal-soft px-4 font-semibold text-level-normal">경과 관찰 중</span>
          ) : (
            <ActionDialog patientId={patient.id} />
          )}
        </div>
      </div>

      <ScoreComposition risk={risk} />

      <Card title="핵심 지표">
        <div className={cn("grid grid-cols-2 gap-3", !panel && "md:grid-cols-4")}>
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

      <div className={cn("grid min-w-0 gap-6", !panel && "lg:grid-cols-3")}>
        <section className={cn("rounded-2xl border border-teal bg-accent p-5 shadow-card", !panel && "lg:col-span-3")}>
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
              <span className="text-muted-foreground">· 권장 조치: {CAUSE_ACTION[risk.cause]}</span>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">진단이나 처방 변경이 아닌 참고용 보조 정보입니다.</p>
        </section>

        <Card title="위험 이유" className={cn("min-w-0", !panel && "lg:col-span-1")}>
          <ul className="space-y-2">
            {risk.reasons.map((r) => (
              <li key={r} className="flex gap-2 text-base"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{r}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">경과 {risk.metrics.elapsedDays}일차 기준 · 규칙 기반 초기 가정치</p>
        </Card>

        <Card title="위험 점수 추이" className={cn("min-w-0", !panel && "lg:col-span-2")}>
          <div className="h-64 w-full min-w-0">
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
                <Tooltip formatter={(v: number, _n, item) => [`${v}점 (${item.payload.level})`, "위험 점수"]} />
                <Area type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2.5} fill="url(#riskFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="최근 4주 플레이 기록">
        <div className={cn("grid min-w-0 gap-6", !panel && "md:grid-cols-2")}>
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">주별 접속 일수 (목표 {patient.weekly_target_days}일)</p>
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 13, fill: "var(--muted-foreground)" }} />
                  <YAxis domain={[0, 7]} allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <ReferenceLine y={patient.weekly_target_days} stroke="var(--teal)" strokeDasharray="4 4" />
                  <Tooltip formatter={(v: number) => [`${v}일`, "접속 일수"]} />
                  <Bar dataKey="days" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">평균 세션 시간 (목표 {patient.session_target_minutes}분)</p>
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 13, fill: "var(--muted-foreground)" }} />
                  <YAxis domain={[0, 40]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <ReferenceLine y={patient.session_target_minutes} stroke="var(--teal)" strokeDasharray="4 4" />
                  <Tooltip formatter={(v: number) => [`${v}분`, "평균 세션"]} />
                  <Bar dataKey="avgMinutes" fill="var(--teal)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>

      <Card title="플레이 캘린더">
        <PlayCalendar patient={patient} logs={logs} actions={actions} alerts={alerts} />
      </Card>

      <Card title="알림">
        {alerts.length === 0 ? (
          <p className="text-muted-foreground">이 환자의 알림이 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {alerts.map((a) => <AlertRow key={a.id} alert={a} patientId={patient.id} logs={logs} />)}
          </ul>
        )}
      </Card>

      <Card title="조치 기록">
        {actions.length === 0 ? (
          <p className="text-muted-foreground">아직 기록된 조치가 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {actions.map((a) => (
              <li key={a.id} className={cn("flex flex-col gap-1 break-words py-3", !panel && "sm:flex-row sm:gap-4")}>
                <span className="w-24 shrink-0 font-semibold text-primary">{a.action_type}</span>
                <span className="flex-1">{a.memo || "메모 없음"}</span>
                <span className="text-sm text-muted-foreground">{new Date(a.created_at).toLocaleString("ko-KR")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ActionDialog({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof ACTION_TYPES)[number]>("전화 상담");
  const [memo, setMemo] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("로그인이 필요합니다.");
      const { data: open } = await supabase.from("alerts").select("id").eq("patient_id", patientId).neq("status", "조치완료").order("created_at", { ascending: false });
      const { error } = await supabase.from("actions").insert({ patient_id: patientId, action_type: type, memo, staff_id: u.user.id, alert_id: open?.[0]?.id ?? null });
      if (error) throw error;
      if (open?.length) {
        const { error: ue } = await supabase.from("alerts").update({ status: "조치완료" }).in("id", open.map((a) => a.id));
        if (ue) throw ue;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("조치가 기록되었습니다.");
      setOpen(false);
      setMemo("");
    },
    onError: () => toast.error("저장하지 못했습니다. 다시 시도해 주세요."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12"><Plus /> 조치 기록하기</Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg" aria-describedby={undefined}>
        <DialogHeader><DialogTitle className="text-xl">조치 기록하기</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">조치 유형</Label>
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

const STATUSES: AlertStatus[] = ["미확인", "확인", "조치완료"];

function AlertRow({ alert, patientId, logs }: { alert: { id: string; message: string; status: string; created_at: string; outcome: string; outcome_note: string | null; alert_score: number | null; alert_level: string | null }; patientId: string; logs: CalendarLog[] }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (s: AlertStatus) => setAlertStatus(alert.id, s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: () => toast.error("상태를 바꾸지 못했습니다."),
  });
  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex-1">
        <p>{alert.message}</p>
        <p className="text-sm text-muted-foreground">
          {new Date(alert.created_at).toLocaleString("ko-KR")}
          {alert.alert_score != null && ` · 알림 당시 ${alert.alert_score}점${alert.alert_level ? ` (${alert.alert_level})` : ""}`}
        </p>
      </div>
      <div className="flex gap-1">
        {STATUSES.map((s) => (
          <Button
            variant="outline"
            key={s}
            disabled={m.isPending}
            onClick={() => m.mutate(s)}
            className={cn(
              "h-auto rounded-full border px-3 py-1.5 text-sm font-medium",
              alert.status === s ? cn(alertStatusStyle[s], "border-transparent") : "text-muted-foreground hover:bg-muted",
            )}
          >
            {s}
          </Button>
        ))}
      </div>
      <AlertOutcomePicker
        alertId={alert.id}
        patientId={patientId}
        outcome={alert.outcome}
        note={alert.outcome_note}
        suggestion={alert.outcome === "미정" ? suggestOutcome(alert.created_at, logs) : null}
        withNote
      />
    </li>
  );
}
