import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, Info, RotateCcw, Trash2 } from "lucide-react";
import { myStaffQuery, patientDetailQuery, patientsOverviewQuery } from "@/lib/queries";
import { canSeeClinical } from "@/lib/roles";
import { asOfFor, computeRisk, shouldAlert, toDateKey, type PlayLogLike, type RiskResult } from "@/lib/risk";
import { LevelBadge } from "@/components/LevelBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({
    meta: [
      { title: "시뮬레이터 | 이탈방지턱" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "가정한 플레이 기록으로 위험 점수가 어떻게 바뀌는지 미리 봅니다. 저장되지 않습니다." },
      { property: "og:title", content: "시뮬레이터 | 이탈방지턱" },
      { property: "og:description", content: "가정한 플레이 기록으로 위험 점수가 어떻게 바뀌는지 미리 봅니다. 저장되지 않습니다." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(patientsOverviewQuery()),
  component: SimulatorPage,
});

const DAY = 86_400_000;

/** 가정 한 단계: 하루 플레이, 또는 N일 미접속 */
type Step =
  | { id: number; kind: "play"; minutes: number; accuracy: number; reaction: number }
  | { id: number; kind: "gap"; days: number };

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return toDateKey(new Date(y!, m! - 1, d! + n));
};
const shortDate = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;

/** 가정 단계들을 날짜 순서대로 펼쳐 가상 기록과 마지막 날짜를 만듭니다. (DB에 저장하지 않음) */
function expandSteps(startDate: string, steps: Step[]) {
  let cursor = startDate;
  const logs: PlayLogLike[] = [];
  const rows: Array<{ id: number; label: string }> = [];
  for (const s of steps) {
    if (s.kind === "play") {
      logs.push({ session_start: new Date(`${cursor}T18:00:00`).toISOString(), play_minutes: s.minutes, accuracy: s.accuracy, reaction_ms: s.reaction });
      rows.push({ id: s.id, label: `${shortDate(cursor)} · ${s.minutes}분 플레이 (정확도 ${s.accuracy}%, 반응 ${s.reaction}ms)` });
      cursor = addDays(cursor, 1);
    } else {
      const end = addDays(cursor, s.days - 1);
      rows.push({ id: s.id, label: `${shortDate(cursor)}~${shortDate(end)} · ${s.days}일 미접속` });
      cursor = addDays(cursor, s.days);
    }
  }
  const lastDay = steps.length > 0 ? addDays(cursor, -1) : null;
  return { logs, rows, lastDay };
}

/** 시뮬레이터는 실제 환자 기록을 바탕으로 점수를 미리 보는 의료진용 도구라 상담원에게는 열지 않는다 */
function SimulatorPage() {
  const { data: me, isPending } = useQuery(myStaffQuery());
  if (isPending) return <p className="py-12 text-center text-muted-foreground" role="status">불러오는 중…</p>;
  if (!canSeeClinical(me?.staff))
    return (
      <div className="space-y-3 py-12 text-center">
        <p className="font-semibold">의료진만 사용할 수 있는 화면입니다.</p>
        <p className="text-muted-foreground">연락 업무는 대시보드에서 확인해 주세요.</p>
        <Link to="/dashboard" className="text-primary underline-offset-2 hover:underline">대시보드로</Link>
      </div>
    );
  return <Simulator />;
}

function Simulator() {
  const { data: patients } = useSuspenseQuery(patientsOverviewQuery());
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const detail = useQuery(patientDetailQuery(patientId));
  const [startDate, setStartDate] = useState(toDateKey(new Date()));
  const [minutes, setMinutes] = useState(30);
  const [accuracy, setAccuracy] = useState(80);
  const [reaction, setReaction] = useState(650);
  const [gapDays, setGapDays] = useState(3);
  const [steps, setSteps] = useState<Step[]>([]);
  const [nextId, setNextId] = useState(1);

  const patient = detail.data?.patient ?? null;
  const baseLogs = useMemo(() => detail.data?.logs ?? [], [detail.data]);
  const now = useMemo(() => asOfFor(baseLogs), [baseLogs]);

  // 환자를 바꾸면 가정 초기화
  useEffect(() => setSteps([]), [patientId]);
  // 시작일 기본값: 그 환자의 현재 기준일 다음 날 (기록을 다시 불러와도 사용자가 고친 날짜는 유지)
  const loaded = detail.isSuccess;
  useEffect(() => {
    if (loaded) setStartDate(toDateKey(new Date(now.getTime() + DAY)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, loaded]);

  const current: RiskResult | null = patient ? computeRisk(patient, baseLogs, now) : null;
  const sim = expandSteps(startDate, steps);
  const after: RiskResult | null =
    patient && sim.lastDay
      ? computeRisk(patient, [...baseLogs, ...sim.logs], new Date(`${sim.lastDay}T23:00:00`))
      : null;
  const wouldAlert = current && after ? shouldAlert(current, after) : false;

  const add = (step: Omit<Extract<Step, { kind: "play" }>, "id"> | Omit<Extract<Step, { kind: "gap" }>, "id">) => {
    setSteps((s) => [...s, { ...step, id: nextId } as Step]);
    setNextId((n) => n + 1);
  };
  const playValid = minutes >= 1 && minutes <= 180 && accuracy >= 0 && accuracy <= 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">시뮬레이터 · 위험 점수 미리보기</h1>
        <p className="mt-1 text-muted-foreground">앞으로 이렇게 되면 위험 점수와 단계가 어떻게 바뀌는지 미리 봅니다.</p>
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <Info className="size-4 shrink-0" /> 가정일 뿐 저장되지 않습니다. 대시보드, 환자 기록, 알림은 바뀌지 않습니다.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-card">
          {patients.length === 0 && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">담당 환자가 없어 미리 볼 환자가 없습니다. 관리자에게 배정을 요청하세요.</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2 sm:col-span-1">
              <Label htmlFor="patient" className="text-base">환자</Label>
              <select
                id="patient"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="h-12 w-full rounded-md border border-input bg-card px-3 text-base"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.risk.level} · {p.risk.score}점)</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-2 sm:col-span-1">
              <Label htmlFor="start" className="text-base">가정 시작일</Label>
              <Input id="start" type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} className="h-12 text-base" />
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <p className="font-semibold">하루 플레이 추가</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="min" className="text-sm">시간(분)</Label>
                <Input id="min" type="number" min={1} max={180} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-11 text-base" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="acc" className="text-sm">정확도(%)</Label>
                <Input id="acc" type="number" min={0} max={100} value={accuracy} onChange={(e) => setAccuracy(Number(e.target.value))} className="h-11 text-base" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rt" className="text-sm">반응(ms)</Label>
                <Input id="rt" type="number" min={200} max={3000} step={10} value={reaction} onChange={(e) => setReaction(Number(e.target.value))} className="h-11 text-base" />
              </div>
            </div>
            <Button className="mt-3 h-11 w-full" disabled={!patient || !playValid} onClick={() => add({ kind: "play", minutes, accuracy, reaction })}>
              하루 플레이 추가
            </Button>
          </div>

          <div className="rounded-xl border border-dashed p-4">
            <p className="font-semibold">미접속 추가</p>
            <div className="mt-3 flex gap-2">
              <Input type="number" min={1} max={28} value={gapDays} onChange={(e) => setGapDays(Number(e.target.value))} className="h-11 w-24 text-base" aria-label="미접속 일수" />
              <Button variant="outline" className="h-11 flex-1" disabled={!patient || gapDays < 1 || gapDays > 28} onClick={() => add({ kind: "gap", days: gapDays })}>
                {gapDays}일 미접속 추가
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="font-semibold">가정 순서</p>
              <Button variant="ghost" size="sm" disabled={steps.length === 0} onClick={() => setSteps([])}>
                <RotateCcw className="size-4" /> 초기화
              </Button>
            </div>
            {sim.rows.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">위에서 플레이나 미접속을 추가하면 순서대로 쌓입니다.</p>
            ) : (
              <ol className="mt-2 space-y-1">
                {sim.rows.map((r, i) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                    <span>{i + 1}. {r.label}</span>
                    <Button variant="ghost" size="icon" className="size-7" aria-label={`${i + 1}번 가정 빼기`} onClick={() => setSteps((s) => s.filter((x) => x.id !== r.id))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-lg font-bold">변화 미리보기</h2>
          {!current ? (
            <p className="mt-4 text-muted-foreground">{detail.isError ? "환자 기록을 불러오지 못했습니다." : "환자 기록을 불러오는 중…"}</p>
          ) : !after ? (
            <div className="mt-4 space-y-3">
              <p className="text-muted-foreground">가정을 추가하면 지금 → 가정 후 비교가 여기에 표시됩니다.</p>
              <div className="flex items-center gap-3 rounded-xl bg-muted p-4">
                <span className="text-muted-foreground">지금</span>
                <span className="text-3xl font-bold tabular-nums">{current.score}</span>
                <LevelBadge level={current.level} />
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">{sim.lastDay && `${shortDate(sim.lastDay)}까지 가정한 결과`}</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <ScoreBox title="지금" r={current} />
                <ArrowRight className="size-6 text-muted-foreground" />
                <ScoreBox title="가정 후" r={after} />
              </div>
              <p className="text-base font-semibold">
                점수 {after.score - current.score >= 0 ? "+" : ""}{after.score - current.score}점
              </p>
              {after.cause && <p className="text-sm">추정 원인: <span className="font-semibold">{after.cause}</span></p>}
              <ul className="space-y-1 rounded-xl bg-muted p-3 text-sm">
                {after.breakdown.map((b) => (
                  <li key={b.key} className={b.points === 0 ? "flex justify-between text-muted-foreground" : "flex justify-between"}>
                    <span>{b.label} ({b.detail})</span>
                    <span className="font-semibold tabular-nums">{b.points}점</span>
                  </li>
                ))}
                {after.adjustment && (
                  <li className="flex justify-between">
                    <span>단계 구간 보정 ({after.adjustment.reason})</span>
                    <span className="font-semibold tabular-nums">{after.adjustment.points > 0 ? "+" : ""}{after.adjustment.points}점</span>
                  </li>
                )}
              </ul>
              <ul className="space-y-1">
                {after.reasons.slice(0, 4).map((r) => <li key={r} className="text-muted-foreground">· {r}</li>)}
              </ul>
              {wouldAlert && (
                <p className="flex items-center gap-2 rounded-lg bg-level-risk-soft px-3 py-2 text-level-risk">
                  <BellRing className="size-4 shrink-0" /> 이렇게 되면 매일 점검에서 알림 대상이 됩니다. 미리보기라 실제 알림은 만들어지지 않습니다.
                </p>
              )}
            </div>
          )}
          {patient && (
            <Button asChild variant="outline" className="mt-4">
              <Link to="/dashboard" search={{ patient: patientId }}>환자 상세 보기</Link>
            </Button>
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
