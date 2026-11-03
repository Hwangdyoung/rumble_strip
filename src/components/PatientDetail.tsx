import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { patientDetailQuery } from "@/lib/queries";
import { asOfFor, computeRisk, progressSummary, riskHistory, weeklySummary, RISK_CONFIG, toDateKey } from "@/lib/risk";
import { setAlertStatus, type AlertStatus } from "@/lib/queries";
import { alertStatusStyle } from "@/components/AlertsBell";
import { Sparkles } from "lucide-react";
import { LevelBadge } from "@/components/LevelBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">위험 점수</div>
            <div className="text-4xl font-bold tabular-nums">{risk.score}<span className="text-lg text-muted-foreground">/100</span></div>
          </div>
          <ActionDialog patientId={patient.id} />
        </div>
      </div>

      <div className={cn("grid min-w-0 gap-6", !panel && "lg:grid-cols-3")}>
        <section className={cn("rounded-2xl border border-teal bg-accent p-5 shadow-card", !panel && "lg:col-span-3")}>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-accent-foreground"><Sparkles className="size-5" /> AI 경과 요약</h2>
          <p className="text-lg">{progressSummary(risk)}</p>
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

      <Card title="알림">
        {data.alerts.length === 0 ? (
          <p className="text-muted-foreground">이 환자의 알림이 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {data.alerts.map((a) => <AlertRow key={a.id} alert={a} patientId={patient.id} />)}
          </ul>
        )}
      </Card>

      <Card title="조치 기록">
        {data.actions.length === 0 ? (
          <p className="text-muted-foreground">아직 기록된 조치가 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {data.actions.map((a) => (
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

function AlertRow({ alert, patientId }: { alert: { id: string; message: string; status: string; created_at: string }; patientId: string }) {
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
        <p className="text-sm text-muted-foreground">{new Date(alert.created_at).toLocaleString("ko-KR")}</p>
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
    </li>
  );
}
