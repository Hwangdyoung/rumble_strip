import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addLogAndRecalc, patientsOverviewQuery } from "@/lib/queries";
import { toDateKey, type RiskResult } from "@/lib/risk";
import { LevelBadge } from "@/components/LevelBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({
    meta: [
      { title: "플레이 시뮬레이터 | 이탈방지턱" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "가상 플레이 기록을 넣어 위험 점수 변화를 확인합니다." },
      { property: "og:title", content: "플레이 시뮬레이터 | 이탈방지턱" },
      { property: "og:description", content: "가상 플레이 기록을 넣어 위험 점수 변화를 확인합니다." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(patientsOverviewQuery()),
  component: Simulator,
});

type Result = { before: RiskResult; after: RiskResult; alerted: boolean; label: string };

function Simulator() {
  const { data: patients } = useSuspenseQuery(patientsOverviewQuery());
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [minutes, setMinutes] = useState(30);
  const [tasks, setTasks] = useState(5);
  const [endedEarly, setEndedEarly] = useState(false);
  const [gapDays, setGapDays] = useState(3);
  const [result, setResult] = useState<Result | null>(null);

  // 선택한 환자의 마지막 기록 다음 날을 기본 날짜로
  useEffect(() => {
    if (!patientId) return;
    supabase
      .from("play_logs")
      .select("session_start")
      .eq("patient_id", patientId)
      .order("session_start", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const last = data?.[0] ? new Date(data[0].session_start) : new Date();
        const next = new Date(Math.max(last.getTime() + 86_400_000, Date.now()));
        setDate(toDateKey(next));
      });
  }, [patientId, result]);

  const patient = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId]);

  const mutation = useMutation({
    mutationFn: async (mode: "play" | "gap") => {
      if (mode === "play") {
        const r = await addLogAndRecalc(patientId, { date, minutes, tasks, endedEarly });
        return { ...r, label: `${date} · ${minutes}분 플레이 기록` };
      }
      const d = new Date(`${date}T12:00:00`);
      d.setDate(d.getDate() + gapDays - 1);
      const r = await addLogAndRecalc(patientId, { date: toDateKey(d), minutes: 0, tasks: 0, endedEarly: true });
      return { ...r, label: `${date}부터 ${gapDays}일 미접속 처리` };
    },
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries();
      if (r.alerted) toast.warning("새 알림이 생성되었습니다.");
      else toast.success("저장하고 위험 점수를 다시 계산했습니다.");
    },
    onError: () => toast.error("저장하지 못했습니다. 다시 시도해 주세요."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">플레이 시뮬레이터</h1>
        <p className="mt-1 text-muted-foreground">가상 플레이 기록을 넣어 위험 점수와 단계가 어떻게 바뀌는지 확인해 보세요.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-card">
          <div className="space-y-2">
            <Label htmlFor="patient" className="text-base">환자</Label>
            <select
              id="patient"
              value={patientId}
              onChange={(e) => { setPatientId(e.target.value); setResult(null); }}
              className="h-12 w-full rounded-md border border-input bg-card px-3 text-base"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.risk.level} · {p.risk.score}점)</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2 sm:col-span-1">
              <Label htmlFor="date" className="text-base">날짜</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min" className="text-base">플레이 시간(분)</Label>
              <Input id="min" type="number" min={1} max={180} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tasks" className="text-base">완료 과제 수</Label>
              <Input id="tasks" type="number" min={0} max={50} value={tasks} onChange={(e) => setTasks(Number(e.target.value))} className="h-12 text-base" />
            </div>
            <div className="flex items-center gap-3 pt-7">
              <Switch id="early" checked={endedEarly} onCheckedChange={setEndedEarly} />
              <Label htmlFor="early" className="text-base">중도 종료</Label>
            </div>
          </div>
          <Button className="h-12 w-full text-base" disabled={!patientId || minutes < 1 || mutation.isPending} onClick={() => mutation.mutate("play")}>
            플레이 기록 저장
          </Button>

          <div className="rounded-xl border border-dashed p-4">
            <p className="font-semibold">공백 만들기</p>
            <p className="mt-1 text-sm text-muted-foreground">위 날짜부터 접속하지 않은 날을 만듭니다.</p>
            <div className="mt-3 flex gap-2">
              <Input type="number" min={1} max={14} value={gapDays} onChange={(e) => setGapDays(Number(e.target.value))} className="h-12 w-24 text-base" aria-label="미접속 일수" />
              <Button variant="outline" className="h-12 flex-1 text-base" disabled={!patientId || gapDays < 1 || mutation.isPending} onClick={() => mutation.mutate("gap")}>
                {gapDays}일 미접속 처리
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-lg font-bold">변화 결과</h2>
          {!result ? (
            <div className="mt-4 space-y-3">
              <p className="text-muted-foreground">기록을 저장하면 이전 → 이후 비교가 여기에 표시됩니다.</p>
              {patient && (
                <div className="flex items-center gap-3 rounded-xl bg-muted p-4">
                  <span className="text-muted-foreground">현재</span>
                  <span className="text-3xl font-bold tabular-nums">{patient.risk.score}</span>
                  <LevelBadge level={patient.risk.level} />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">{result.label}</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <ScoreBox title="이전" r={result.before} />
                <ArrowRight className="size-6 text-muted-foreground" />
                <ScoreBox title="이후" r={result.after} />
              </div>
              <p className="text-base font-semibold">
                점수 {result.after.score - result.before.score >= 0 ? "+" : ""}{result.after.score - result.before.score}점
              </p>
              <ul className="space-y-1">
                {result.after.reasons.map((r) => <li key={r} className="text-muted-foreground">· {r}</li>)}
              </ul>
              {result.alerted && (
                <p className="flex items-center gap-2 rounded-lg bg-level-risk-soft px-3 py-2 text-level-risk">
                  <BellRing className="size-4" /> 알림이 생성되었습니다.
                </p>
              )}
              <Button asChild variant="outline"><Link to="/patients/$id" params={{ id: patientId }}>환자 상세 보기</Link></Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ScoreBox({ title, r }: { title: string; r: RiskResult }) {
  return (
    <div className="rounded-xl bg-muted p-4 text-center">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="my-1 text-4xl font-bold tabular-nums">{r.score}</div>
      <LevelBadge level={r.level} />
    </div>
  );
}
