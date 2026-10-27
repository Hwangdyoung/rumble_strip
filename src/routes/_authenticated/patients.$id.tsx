import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { patientDetailQuery } from "@/lib/queries";
import { computeRisk, riskHistory, weeklySummary, RISK_CONFIG } from "@/lib/risk";
import { LevelBadge } from "@/components/LevelBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  head: () => ({
    meta: [
      { title: "환자 상세 | 이탈방지턱" },
      { name: "description", content: "환자의 위험 점수 추이, 플레이 기록, 조치 기록을 확인합니다." },
      { property: "og:title", content: "환자 상세 | 이탈방지턱" },
      { property: "og:description", content: "환자의 위험 점수 추이, 플레이 기록, 조치 기록을 확인합니다." },
    ],
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(patientDetailQuery(params.id));
    if (!data.patient) throw notFound();
  },
  component: PatientPage,
});

const ACTION_TYPES = ["전화 상담", "문자", "기타"] as const;

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-card", className)}>
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function PatientPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(patientDetailQuery(id));
  const patient = data.patient!;
  const risk = computeRisk(patient, data.logs);
  const history = riskHistory(patient, data.logs);
  const weeks = weeklySummary(patient, data.logs);

  return (
    <div className="space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> 대시보드로
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold sm:text-3xl">{patient.name}</h1>
            <LevelBadge level={risk.level} />
          </div>
          <p className="mt-1 text-muted-foreground">
            {patient.age}세 · 처방 시작 {patient.prescription_start_date} · {patient.prescription_weeks}주 / 주 {patient.weekly_target_days}회 / {patient.session_target_minutes}분
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">위험 점수</div>
            <div className="text-4xl font-bold tabular-nums">{risk.score}<span className="text-lg text-muted-foreground">/100</span></div>
          </div>
          <ActionDialog patientId={patient.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="위험 이유" className="lg:col-span-1">
          <ul className="space-y-2">
            {risk.reasons.map((r) => (
              <li key={r} className="flex gap-2 text-base"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{r}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">경과 {risk.metrics.elapsedDays}일차 기준 · 규칙 기반 초기 가정치</p>
        </Card>

        <Card title="위험 점수 추이" className="lg:col-span-2">
          <div className="h-64">
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
                <Tooltip formatter={(v: number, _n, item) => [`${v}점 (${item.payload.level})`, "위험 점수"]} />
                <Area type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2.5} fill="url(#riskFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="최근 4주 플레이 기록">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">주별 접속 일수 (목표 {patient.weekly_target_days}일)</p>
            <div className="h-56">
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
            <div className="h-56">
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

      <Card title="조치 기록">
        {data.actions.length === 0 ? (
          <p className="text-muted-foreground">아직 기록된 조치가 없습니다.</p>
        ) : (
          <ul className="divide-y">
            {data.actions.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
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
      const { error } = await supabase.from("actions").insert({ patient_id: patientId, action_type: type, memo, staff_id: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
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
      <DialogContent>
        <DialogHeader><DialogTitle className="text-xl">조치 기록하기</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">조치 유형</Label>
            <div className="flex gap-2">
              {ACTION_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-3 font-medium transition",
                    type === t ? "border-primary bg-secondary text-secondary-foreground ring-2 ring-primary" : "hover:bg-muted",
                  )}
                >
                  {t}
                </button>
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
