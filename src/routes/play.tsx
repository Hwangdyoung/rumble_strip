import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LogOut, Pause, Play, RotateCcw, X } from "lucide-react";
import { toDateKey } from "@/lib/risk";
import {
  GAME_CONFIG,
  judge,
  makeBlock,
  prescriptionProgress,
  summarize,
  toPlayLog,
  type PlayLogInsert,
  type Response,
  type SessionSummary,
  type Trial,
} from "@/lib/game";
import { DRIVE_CONFIG, moveLane, spawnThing, stepThings, type Lane, type Thing } from "@/lib/drive";
import { earnedCoins, emptyVillage, placeBuilding, type BuildingId, type VillageState } from "@/lib/village";
import { checkGameLogin, checkNewGamePatient, GAME_MAX_AGE, GAME_MIN_AGE } from "@/lib/game-account";
import {
  createGamePatient,
  gameSignIn,
  gameSignOut,
  getGameProgress,
  getGameStatus,
  saveGamePlay,
  type GamePatient,
  type GameProgress,
} from "@/lib/game-account.server";
import { DriveScene } from "@/components/DriveScene";
import { GameSymbol } from "@/components/GameSymbol";
import { Village } from "@/components/Village";
import { Logo } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 환자용 게임 화면 (조원이 만든 게임을 가져와 2026-11-17 저장 방식으로 바꿈, SQL 012).
 * - 처음: 별명·나이·아이디·숫자 4자리로 환자를 만든다(patients.source='game', 담당 없음 → 관리자에게만 보임).
 *   다음부터: 아이디 + 숫자 4자리로 이어서 한다. 접속 표시는 이 브라우저에 12시간 남는다.
 * - 달리기: 좌우로 움직여 장애물을 피하고 코인을 줍는다(drive.ts).
 * - 동시에 오른쪽 위 '기억 그림'이 1개 전 그림과 같으면 탭한다(N-back, game.ts). 정확도·반응 시간은 여기서 나온다.
 * - 게임이 끝나면 play_logs에 한 줄을 저장한다(서버 함수 saveGamePlay). 의료진 대시보드의 점수·캘린더에 반영된다.
 * - 모은 코인과 마을은 이 기기에만 저장한다(DB 칸 없음).
 * - 로그인 화면 왼쪽 위 '게임 해 보기'로 들어온다. DEMO_MODE=on일 때만 동작한다.
 */
export const Route = createFileRoute("/play")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "게임 | 이탈방지턱" },
      { name: "description", content: "스타러커스 체험 게임. 플레이 기록이 의료진 화면에 반영됩니다." },
    ],
  }),
  component: PlayPage,
});

/** 한 번에 1개 전 그림과 비교, 한 과제(20문항, 약 1분)로 끝난다 */
const N_BACK = 1 as const;

const TOKEN_KEY = "rumble-game-token";
const villageKey = (loginId: string) => `rumble-game-village:${loginId}`;

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* 저장이 막힌 브라우저면 이번 화면에서만 유지 */
  }
}
function loadVillage(loginId: string): VillageState {
  try {
    const v = JSON.parse(readStore(villageKey(loginId)) ?? "null") as VillageState | null;
    if (v && typeof v.coins === "number" && Array.isArray(v.plots)) return v;
  } catch {
    /* 깨진 값이면 새 마을 */
  }
  return emptyVillage(0);
}

type Phase = "home" | "playing" | "paused" | "confirmQuit" | "done";
type Feedback = "hit" | "falseAlarm" | "miss" | null;
type DriveStats = { crashes: number; roadCoins: number };
type SaveState = "saving" | "saved" | "failed" | "none";
type Result = { row: PlayLogInsert | null; summary: SessionSummary; drive: DriveStats; earned: number };
type Session = { token: string; loginId: string };

function PlayPage() {
  const status = useQuery({ queryKey: ["game-status"], queryFn: () => getGameStatus(), retry: false });
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [loginId, setLoginId] = useState<string | null>(null);

  // 이 브라우저에 남은 접속 표시가 있으면 이어서
  useEffect(() => {
    const raw = readStore(TOKEN_KEY);
    try {
      const s = raw ? (JSON.parse(raw) as Session) : null;
      if (s?.token && s.loginId) {
        setSession(s);
        setLoginId(s.loginId);
      }
    } catch {
      writeStore(TOKEN_KEY, null);
    }
    setChecking(false);
  }, []);

  const progress = useQuery({
    queryKey: ["game-progress", session?.token],
    queryFn: () => getGameProgress({ data: { token: session!.token } }),
    enabled: Boolean(session),
    retry: false,
  });
  // 접속 표시가 만료됐으면 처음 화면으로
  useEffect(() => {
    if (session && progress.isSuccess && progress.data === null) {
      writeStore(TOKEN_KEY, null);
      setSession(null);
    }
  }, [session, progress.isSuccess, progress.data]);

  const enter = (s: Session) => {
    writeStore(TOKEN_KEY, JSON.stringify(s));
    setLoginId(s.loginId);
    setSession(s);
  };
  const leave = async () => {
    if (session) await gameSignOut({ data: { token: session.token } }).catch(() => undefined);
    writeStore(TOKEN_KEY, null);
    setSession(null);
  };

  let body;
  if (checking || status.isPending) body = <p className="py-12 text-center text-muted-foreground" role="status">불러오는 중…</p>;
  else if (!status.data?.enabled) body = <Unavailable />;
  else if (!session) body = <GameStart onEnter={enter} />;
  else if (!progress.data) body = progress.isError ? <LoadFailed onRetry={() => progress.refetch()} /> : <p className="py-12 text-center text-muted-foreground" role="status">불러오는 중…</p>;
  else body = <Game key={session.loginId} session={session} progress={progress.data} onSaved={() => progress.refetch()} />;

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-2 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            {session && loginId ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">아이디 {loginId}</span>
                <Button variant="outline" size="sm" onClick={leave}>
                  <LogOut /> 나가기
                </Button>
              </>
            ) : (
              <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                의료진 로그인
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">{body}</main>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="space-y-3 py-12 text-center">
      <p className="text-lg font-semibold">지금은 게임을 이용할 수 없습니다.</p>
      <Link to="/auth" className="text-primary underline-offset-4 hover:underline">로그인 화면으로 돌아가기</Link>
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-3 py-12 text-center">
      <p>기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <Button variant="outline" onClick={onRetry}>다시 시도</Button>
    </div>
  );
}

/** 처방 진행 (DB의 플레이 기록 기준. 위험 점수는 보여 주지 않는다) */
function progressStatus(patient: GamePatient, logs: GameProgress["logs"]) {
  const todayKey = toDateKey(new Date());
  const days = logs.map((l) => toDateKey(new Date(l.session_start)));
  const progress = prescriptionProgress(patient, days);
  const todayMinutes = logs.filter((l) => toDateKey(new Date(l.session_start)) === todayKey).reduce((a, l) => a + l.play_minutes, 0);
  return { progress, todayMinutes, target: patient.session_target_minutes };
}

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");

/** 첫 화면: 처음이에요(환자 만들기) / 이어서 할게요(아이디 + 숫자 4자리) */
function GameStart({ onEnter }: { onEnter: (s: Session) => void }) {
  const [mode, setMode] = useState<"new" | "back">("new");
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#0f1630]">
          <GameSymbol id="rocket" className="size-10" />
        </span>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">스타러커스 체험 게임</h1>
          <p className="mt-1 text-muted-foreground">달리면서 기억 그림을 맞히고, 모은 코인으로 마을을 꾸며요.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl border bg-card p-1 shadow-card sm:w-fit" role="tablist" aria-label="시작 방법">
        {(["new", "back"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {m === "new" ? "처음이에요" : "이어서 할게요"}
          </button>
        ))}
      </div>
      {mode === "new" ? <NewPatientForm onEnter={onEnter} /> : <SignInForm onEnter={onEnter} />}
      <p className="text-xs text-muted-foreground">
        체험용 게임입니다. 플레이 기록은 의료진 화면의 예시 데이터로 쓰이며, 진단이나 처방에 쓰이지 않습니다.
      </p>
    </div>
  );
}

function FormErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-lg bg-level-risk-soft px-3 py-2 text-sm text-level-risk" role="alert">
      {errors.map((e) => <li key={e}>{e}</li>)}
    </ul>
  );
}

function NewPatientForm({ onEnter }: { onEnter: (s: Session) => void }) {
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const m = useMutation({
    mutationFn: (v: { nickname: string; age: number; loginId: string; pin: string }) => createGamePatient({ data: v }),
    onSuccess: (s) => onEnter({ token: s.token, loginId: s.loginId }),
    onError: (e) => setErrors([errText(e)]),
  });
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = checkNewGamePatient({ nickname, age, loginId, pin, pinConfirm });
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    m.mutate(r.value);
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="g-nick" className="text-base">별명</Label>
          <Input id="g-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} placeholder="예: 별빛탐험가" className="h-12 text-base" />
          <p className="text-xs text-muted-foreground">실명 대신 별명을 써 주세요.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-age" className="text-base">나이</Label>
          <Input id="g-age" type="number" inputMode="numeric" min={GAME_MIN_AGE} max={GAME_MAX_AGE} value={age} onChange={(e) => setAge(e.target.value)} placeholder={`${GAME_MIN_AGE}~${GAME_MAX_AGE}`} className="h-12 text-base" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-id" className="text-base">아이디</Label>
          <Input id="g-id" value={loginId} onChange={(e) => setLoginId(e.target.value)} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="예: star01" className="h-12 text-base" />
          <p className="text-xs text-muted-foreground">영문 소문자와 숫자 3~20자. 다음에 이어서 할 때 써요.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-pin" className="text-base">숫자 4자리</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input id="g-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="숫자 4자리" className="h-12 text-base" autoComplete="new-password" />
            <Input type="password" inputMode="numeric" maxLength={4} value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value)} placeholder="한 번 더" aria-label="숫자 4자리 확인" className="h-12 text-base" autoComplete="new-password" />
          </div>
        </div>
      </div>
      <FormErrors errors={errors} />
      <Button type="submit" disabled={m.isPending} className="h-12 w-full text-base">
        {m.isPending ? "만드는 중…" : "시작하기"}
      </Button>
    </form>
  );
}

function SignInForm({ onEnter }: { onEnter: (s: Session) => void }) {
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const m = useMutation({
    mutationFn: (v: { loginId: string; pin: string }) => gameSignIn({ data: v }),
    onSuccess: (s) => onEnter({ token: s.token, loginId: s.loginId }),
    onError: (e) => setErrors([errText(e)]),
  });
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = checkGameLogin({ loginId, pin });
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    m.mutate(r.value);
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-card sm:max-w-md sm:p-6">
      <div className="space-y-2">
        <Label htmlFor="b-id" className="text-base">아이디</Label>
        <Input id="b-id" value={loginId} onChange={(e) => setLoginId(e.target.value)} autoCapitalize="none" autoComplete="username" spellCheck={false} className="h-12 text-base" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="b-pin" className="text-base">숫자 4자리</Label>
        <Input id="b-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" className="h-12 text-base" />
      </div>
      <FormErrors errors={errors} />
      <Button type="submit" disabled={m.isPending} className="h-12 w-full text-base">
        {m.isPending ? "확인 중…" : "이어서 하기"}
      </Button>
    </form>
  );
}

function Game({ session, progress, onSaved }: { session: Session; progress: GameProgress; onSaved: () => void }) {
  const patient = progress.patient;
  // 마을·코인은 이 기기에만 저장 (아이디별)
  const [village, setVillage] = useState<VillageState>(() => loadVillage(session.loginId));
  useEffect(() => writeStore(villageKey(session.loginId), JSON.stringify(village)), [session.loginId, village]);
  const onBuild = useCallback((plot: number, id: BuildingId) => setVillage((v) => placeBuilding(v, plot, id) ?? v), []);
  const [save, setSave] = useState<SaveState>("none");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveRow = useCallback(
    async (row: PlayLogInsert & { crashes: number; coins: number }) => {
      setSave("saving");
      setSaveError(null);
      try {
        const { patient_id: _ignored, ...rest } = row;
        await saveGamePlay({ data: { token: session.token, row: rest } });
        setSave("saved");
        onSaved();
      } catch (e) {
        setSave("failed");
        setSaveError(errText(e));
      }
    },
    [session.token, onSaved],
  );
  const onPlayed = useCallback(
    (row: PlayLogInsert | null, earned: number, drive: DriveStats) => {
      setVillage((v) => ({ ...v, coins: v.coins + earned }));
      if (row) void saveRow({ ...row, crashes: drive.crashes, coins: drive.roadCoins });
      else setSave("none");
    },
    [saveRow],
  );
  const [phase, setPhase] = useState<Phase>("home");
  const [view, setView] = useState<{ trial: Trial | null; key: number }>({ trial: null, key: 0 });
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [trialNo, setTrialNo] = useState(0);
  const [combo, setCombo] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [, setFrame] = useState(0); // 달리기 화면 다시 그리기용

  // 기억 게임(N-back) 진행 상태
  const r = useRef({
    block: [] as Trial[],
    idx: 0,
    responses: [] as Response[],
    pressedRt: null as number | null,
    onsetAt: 0,
    activeMs: 0,
    activeSince: 0,
    startedAt: new Date(),
    timers: [] as number[],
    playing: false,
    key: 0,
    combo: 0,
  });
  // 달리기 진행 상태
  const d = useRef({
    things: [] as Thing[],
    lane: 1 as Lane,
    nextId: 1,
    sinceSpawn: 0,
    crashes: 0,
    roadCoins: 0,
    invulnerableMs: 0,
    flashMs: 0,
  });

  const clearTimers = () => {
    r.current.timers.forEach((t) => window.clearTimeout(t));
    r.current.timers = [];
  };
  const later = (fn: () => void, ms: number) => r.current.timers.push(window.setTimeout(fn, ms));

  const finish = useCallback(
    (endedEarly: boolean) => {
      const s = r.current;
      clearTimers();
      if (s.playing) s.activeMs += performance.now() - s.activeSince;
      s.playing = false;
      setView({ trial: null, key: ++s.key });
      const summary = summarize(s.responses);
      const row = toPlayLog({
        patientId: "game", // 저장할 때 서버가 접속 표시로 환자를 정한다
        startedAt: s.startedAt,
        endedAt: new Date(),
        activeMs: s.activeMs,
        blocksCompleted: endedEarly ? 0 : 1,
        endedEarly,
        summary,
      });
      const drive = { crashes: d.current.crashes, roadCoins: d.current.roadCoins };
      const earned = earnedCoins(drive.roadCoins, summary.hits);
      onPlayed(row, earned, drive);
      setResult({ row, summary, drive, earned });
      setPhase("done");
    },
    [onPlayed],
  );

  // 기억 그림 한 문항: 그림 보여주기 → 빈 칸 → 판정 → 다음 문항. 20문항이 끝나면 종료
  const runTrial = useCallback(() => {
    const s = r.current;
    if (s.idx >= s.block.length) {
      finish(false);
      return;
    }
    const trial = s.block[s.idx]!;
    s.pressedRt = null;
    s.onsetAt = performance.now();
    setTrialNo(s.idx + 1);
    setFeedback(null);
    setView({ trial, key: ++s.key });
    later(() => setView({ trial: null, key: ++s.key }), GAME_CONFIG.stimulusMs);
    later(() => {
      const outcome = judge(trial, s.pressedRt);
      if (outcome) s.responses.push({ outcome, rtMs: outcome === "hit" || outcome === "falseAlarm" ? s.pressedRt : null });
      if (outcome === "miss") {
        setFeedback("miss");
        s.combo = 0;
        setCombo(0);
      }
      s.idx += 1;
      later(runTrial, outcome === "miss" ? 350 : 0);
    }, GAME_CONFIG.stimulusMs + GAME_CONFIG.gapMs);
  }, [finish]);

  const start = () => {
    clearTimers();
    Object.assign(r.current, {
      block: makeBlock(N_BACK),
      idx: 0,
      responses: [],
      activeMs: 0,
      activeSince: performance.now(),
      startedAt: new Date(),
      playing: true,
      combo: 0,
    });
    Object.assign(d.current, { things: [], lane: 1, sinceSpawn: 0, crashes: 0, roadCoins: 0, invulnerableMs: 0, flashMs: 0 });
    setTrialNo(0);
    setCombo(0);
    setResult(null);
    setPhase("playing");
    later(runTrial, 800);
  };

  const pause = useCallback((next: Phase = "paused") => {
    const s = r.current;
    if (!s.playing) return;
    clearTimers();
    s.activeMs += performance.now() - s.activeSince;
    s.playing = false;
    setView({ trial: null, key: ++s.key });
    setFeedback(null);
    setPhase(next);
  }, []);

  const resume = () => {
    const s = r.current;
    s.activeSince = performance.now();
    s.playing = true;
    setPhase("playing");
    later(runTrial, 500); // 멈췄던 문항을 처음부터 다시 보여줌
  };

  const tap = useCallback(() => {
    const s = r.current;
    if (!s.playing || s.pressedRt !== null) return;
    const trial = s.block[s.idx];
    if (!trial || !trial.scored) return;
    s.pressedRt = Math.round(performance.now() - s.onsetAt);
    if (trial.isTarget) {
      s.combo += 1;
      setFeedback("hit");
    } else {
      s.combo = 0;
      setFeedback("falseAlarm");
    }
    setCombo(s.combo);
  }, []);

  const steer = useCallback((dir: -1 | 1) => {
    if (!r.current.playing) return;
    d.current.lane = moveLane(d.current.lane, dir);
    setFrame((f) => f + 1);
  }, []);

  // 달리기: 화면이 그려질 때마다 물체를 움직이고 부딪힘·코인을 센다(멈춘 동안은 돌지 않음)
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const g = d.current;
      g.sinceSpawn += dt;
      if (g.sinceSpawn >= DRIVE_CONFIG.spawnEveryMs) {
        g.sinceSpawn = 0;
        g.things.push(spawnThing(g.nextId++));
      }
      g.invulnerableMs = Math.max(0, g.invulnerableMs - dt);
      g.flashMs = Math.max(0, g.flashMs - dt);
      const step = stepThings(g.things, dt, g.lane, g.invulnerableMs > 0);
      g.things = step.things;
      g.roadCoins += step.coins;
      if (step.crashed) {
        g.crashes += step.crashed;
        g.invulnerableMs = DRIVE_CONFIG.invulnerableMs;
        g.flashMs = 200;
      }
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // 키보드: ←/→(또는 A/D) = 이동, 스페이스·엔터 = 같아요, Esc = 일시정지. 다른 창으로 가면 자동 일시정지
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        tap();
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        steer(-1);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        steer(1);
      } else if (e.key === "Escape") pause();
    };
    const onHide = () => document.hidden && pause();
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [phase, tap, steer, pause]);

  useEffect(() => () => clearTimers(), []);

  const status = progressStatus(patient, progress.logs);

  if (phase === "home") {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{patient.name}님, 안녕하세요!</h1>
          <p className="mt-1 text-muted-foreground">달리면서 기억 그림을 맞히고, 모은 코인으로 마을을 꾸며요.</p>
        </div>

        <section className="grid grid-cols-3 gap-2 rounded-2xl border bg-card p-4 text-center shadow-card">
          <Stat label="처방" value={`${status.progress.dayNumber}일차`} sub={`${status.progress.totalDays}일 중`} />
          <Stat label={`${status.progress.weekNumber}주차`} value={`${status.progress.playedThisWeek} / ${status.progress.weeklyTarget}일`} sub="이번 주 플레이" />
          <Stat label="오늘" value={`${status.todayMinutes} / ${status.target}분`} sub={status.todayMinutes >= status.target ? "오늘 목표를 채웠어요" : "오늘도 해 볼까요?"} />
        </section>

        <Village state={village} onBuild={onBuild} />

        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="font-semibold">달리기 방법 <span className="text-sm font-normal text-muted-foreground">· 한 번에 {GAME_CONFIG.trialsPerBlock}문항(약 1분)</span></h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            <HowTo step="1" text="◀ ▶ 버튼이나 방향키로 움직여 빨간 가시를 피하고 코인을 주워요." />
            <HowTo step="2" text="오른쪽 위 '기억 그림'이 하나씩 바뀌어요." />
            <HowTo step="3" text="바로 전(1개 전) 그림과 같으면 파란 손 버튼이나 스페이스바를 눌러요." />
          </ol>
        </section>

        <Button onClick={start} className="h-14 w-full text-lg">
          <Play /> 달리기 시작
        </Button>
      </div>
    );
  }

  if (phase === "done" && result) {
    return <Done result={result} save={save} saveError={saveError} onRetry={() => result.row && saveRow({ ...result.row, crashes: result.drive.crashes, coins: result.drive.roadCoins })} onAgain={start} onHome={() => setPhase("home")} />;
  }

  // 플레이 · 일시정지 · 그만두기 확인
  const g = d.current;
  return (
    <div className="space-y-3">
      <DriveScene
        name={patient.name}
        coins={village.coins + g.roadCoins}
        trialNo={trialNo}
        totalTrials={GAME_CONFIG.trialsPerBlock}
        things={g.things}
        lane={g.lane}
        symbol={phase === "playing" ? (view.trial?.symbol ?? null) : null}
        symbolKey={view.key}
        feedback={feedback}
        combo={combo}
        crashed={g.flashMs > 0}
        invulnerable={g.invulnerableMs > 0}
        active={phase === "playing"}
        onLeft={() => steer(-1)}
        onRight={() => steer(1)}
        onTap={tap}
        overlay={
          phase === "paused" ? (
            <Panel title="잠깐 멈췄어요" resumeLabel="이어서 하기" onResume={resume} onQuit={() => finish(true)} />
          ) : phase === "confirmQuit" ? (
            <Panel title="그만할까요?" resumeLabel="계속하기" onResume={resume} onQuit={() => finish(true)} />
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">←/→ 이동 · 스페이스 = 1개 전과 같아요 · Esc 잠깐 멈춤</p>
        {phase === "playing" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => pause()}><Pause /> 잠깐 멈춤</Button>
            <Button variant="outline" size="sm" onClick={() => pause("confirmQuit")}><X /> 그만하기</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function HowTo({ step, text }: { step: string; text: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{step}</span>
      <span className="text-sm">{text}</span>
    </li>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Panel({ title, resumeLabel, onResume, onQuit }: { title: string; resumeLabel: string; onResume: () => void; onQuit: () => void }) {
  return (
    <div className="w-64 space-y-3 rounded-2xl bg-[#1d2340] p-5 text-center text-white shadow-xl">
      <p className="text-xl font-bold">{title}</p>
      <p className="text-sm text-white/80">그만하면 지금까지 한 만큼 기록돼요.</p>
      <Button onClick={onResume} className="h-12 w-full text-base"><Play /> {resumeLabel}</Button>
      <Button onClick={onQuit} variant="outline" className="h-11 w-full text-foreground">그만하기</Button>
    </div>
  );
}

/** 결과: 저장 여부와 이번 판 기록 (환자 화면이라 점수·단계는 보여 주지 않는다) */
function Done({
  result,
  save,
  saveError,
  onRetry,
  onAgain,
  onHome,
}: {
  result: Result;
  save: SaveState;
  saveError: string | null;
  onRetry: () => void;
  onAgain: () => void;
  onHome: () => void;
}) {
  const { row, summary, drive, earned } = result;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5 shadow-card">
        <div>
          <p className="text-2xl font-bold">도착했어요!</p>
          <p className="mt-1 text-muted-foreground">마을에서 쓸 코인을 얻었어요.</p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-[#FFF4CC] px-4 py-2 text-xl font-bold text-[#7a4b00]">
          <span className="inline-block size-5 rounded-full border-2 border-[#B57F00] bg-[#FFD84D]" aria-hidden="true" />+{earned}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-4 text-center shadow-card sm:grid-cols-4">
        <Stat label="플레이" value={row ? `${row.play_minutes}분` : "-"} sub="멈춘 시간 빼고" />
        <Stat label="기억 그림" value={`${summary.hits}개`} sub={`${summary.scoredTrials}문항 중 맞힘`} />
        <Stat label="주운 코인" value={`${drive.roadCoins}개`} sub={`부딪힘 ${drive.crashes}번`} />
        <Stat label="반응 속도" value={row?.reaction_ms ? `${(row.reaction_ms / 1000).toFixed(2)}초` : "-"} sub="맞힌 그림 평균" />
      </section>

      <div role="status" className="rounded-xl border bg-card px-4 py-3 text-sm shadow-card">
        {save === "saving" && <span className="text-muted-foreground">기록을 저장하는 중…</span>}
        {save === "saved" && <span className="font-semibold text-level-normal">오늘 기록을 저장했어요.</span>}
        {save === "none" && <span className="text-muted-foreground">기억 그림 문항을 하나도 풀지 않아 저장할 기록이 없어요.</span>}
        {save === "failed" && (
          <span className="flex flex-wrap items-center gap-3 text-level-risk">
            {saveError ?? "기록을 저장하지 못했어요."}
            <Button size="sm" variant="outline" onClick={onRetry}>다시 저장</Button>
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={onHome} className="h-12 text-base">마을로 가기</Button>
        <Button onClick={onAgain} variant="outline" className="h-12 text-base"><RotateCcw /> 한 번 더 달리기</Button>
      </div>
    </div>
  );
}
