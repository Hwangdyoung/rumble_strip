/**
 * 환자용 게임(/play) 서버 함수 (SQL 012, 순수 함수는 game-account.ts).
 *
 * - 로그인 없이 부른다. 대신 '로그인 없이 둘러보기'와 같은 스위치(Vercel 환경 변수 DEMO_MODE=on)일 때만 동작한다.
 * - DB는 관리자 클라이언트(service role)로만 읽고 쓴다. 화면(anon)에는 어떤 표 권한도 열지 않는다.
 * - 환자 만들기: 별명·나이·아이디·숫자 4자리 → patients(source='game', 처방 시작 = 오늘 한국 날짜) + game_accounts(숫자는 해시).
 *   만든 환자는 담당이 없어 관리자에게만 보인다(관리자가 담당 관리에서 배정).
 * - 이어서 하기: 아이디 + 숫자 4자리. 5번 틀리면 잠김(관리자에게 문의).
 * - 접속 표시(token): 무작위 값을 브라우저에 두고 DB에는 해시만 둔다. 12시간 유지.
 * - 플레이 기록 저장: 접속 표시로 환자를 찾고, 화면이 보낸 환자 id는 쓰지 않는다. checkPlayRow로 값 범위를 확인한다.
 * - 관리자 클라이언트(client.server.ts)와 process.env는 핸들러 안에서만 쓴다.
 */
import { createServerFn } from "@tanstack/react-start";
import { isDemoEnabled } from "@/lib/demo";
import { koreaNow } from "@/lib/daily-check";
import { toDateKey } from "@/lib/risk";
import {
  checkGameLogin,
  checkNewGamePatient,
  checkPlayRow,
  GAME_DAILY_LIMIT,
  GAME_PIN_MAX_ATTEMPTS,
  GAME_SESSION_HOURS,
  hashGamePin,
  hashGameToken,
  newGameToken,
  type NewGamePatientInput,
} from "@/lib/game-account";

const UNAVAILABLE = "지금은 게임을 이용할 수 없습니다.";
const RETRY = "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
const LOGIN_FAIL = "아이디 또는 숫자 4자리가 올바르지 않습니다.";

export interface GamePatient {
  name: string;
  age: number;
  prescription_start_date: string;
  prescription_weeks: number;
  weekly_target_days: number;
  session_target_minutes: number;
}
export interface GameSession {
  token: string;
  loginId: string;
  patient: GamePatient;
}
export interface GameProgress {
  patient: GamePatient;
  /** 지금까지 플레이 기록(시작 시각·분) */
  logs: Array<{ session_start: string; play_minutes: number }>;
}

function ensureEnabled() {
  if (!isDemoEnabled(process.env["DEMO_MODE"])) throw new Error(UNAVAILABLE);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Admin = Awaited<ReturnType<typeof admin>>;

async function startSession(db: Admin, patientId: string): Promise<string> {
  const token = newGameToken();
  const expires = new Date(Date.now() + GAME_SESSION_HOURS * 3600_000).toISOString();
  const { error } = await db
    .from("game_accounts")
    .update({ session_hash: await hashGameToken(token), session_expires_at: expires, attempts: 0 })
    .eq("patient_id", patientId);
  if (error) throw new Error(RETRY);
  return token;
}

async function patientOf(db: Admin, patientId: string): Promise<GamePatient> {
  const { data, error } = await db
    .from("patients")
    .select("name, age, prescription_start_date, prescription_weeks, weekly_target_days, session_target_minutes")
    .eq("id", patientId)
    .maybeSingle();
  if (error || !data) throw new Error(RETRY);
  return data;
}

/** 접속 표시로 환자 id 찾기 (없거나 만료면 null) */
async function patientIdFromToken(db: Admin, token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await db
    .from("game_accounts")
    .select("patient_id, session_expires_at")
    .eq("session_hash", await hashGameToken(token))
    .maybeSingle();
  if (!data?.session_expires_at || new Date(data.session_expires_at).getTime() < Date.now()) return null;
  return data.patient_id;
}

export const getGameStatus = createServerFn({ method: "GET" }).handler(async () => ({
  enabled: isDemoEnabled(process.env["DEMO_MODE"]),
}));

export const createGamePatient = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const r = checkNewGamePatient((d ?? {}) as NewGamePatientInput);
    if (!r.ok) throw new Error(r.errors.join(" "));
    return r.value;
  })
  .handler(async ({ data }): Promise<GameSession> => {
    ensureEnabled();
    const db = await admin();

    const { data: taken } = await db.from("game_accounts").select("patient_id").eq("login_id", data.loginId).maybeSingle();
    if (taken) throw new Error("이미 있는 아이디입니다. 다른 아이디를 정해 주세요.");

    const today = toDateKey(koreaNow());
    const dayStart = new Date(`${today}T00:00:00+09:00`).toISOString();
    const { count } = await db.from("patients").select("id", { count: "exact", head: true }).eq("source", "game").gte("created_at", dayStart);
    if ((count ?? 0) >= GAME_DAILY_LIMIT) throw new Error("오늘은 더 이상 새로 만들 수 없습니다. 내일 다시 시도해 주세요.");

    const { data: p, error: pErr } = await db
      .from("patients")
      .insert({ name: data.nickname, age: data.age, prescription_start_date: today, source: "game" })
      .select("id")
      .single();
    if (pErr || !p) {
      console.error("[game] 환자 만들기 실패", pErr?.code, pErr?.message);
      throw new Error(RETRY);
    }
    const { error: aErr } = await db.from("game_accounts").insert({ patient_id: p.id, login_id: data.loginId, pin_hash: await hashGamePin(data.pin, p.id) });
    if (aErr) {
      console.error("[game] 게임 계정 만들기 실패", aErr.code, aErr.message);
      await db.from("patients").delete().eq("id", p.id);
      throw new Error(aErr.code === "23505" ? "이미 있는 아이디입니다. 다른 아이디를 정해 주세요." : RETRY);
    }
    const token = await startSession(db, p.id);
    return { token, loginId: data.loginId, patient: await patientOf(db, p.id) };
  });

export const gameSignIn = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const r = checkGameLogin((d ?? {}) as { loginId: string; pin: string });
    if (!r.ok) throw new Error(r.errors.join(" "));
    return r.value;
  })
  .handler(async ({ data }): Promise<GameSession> => {
    ensureEnabled();
    const db = await admin();
    const { data: acc } = await db.from("game_accounts").select("patient_id, pin_hash, attempts").eq("login_id", data.loginId).maybeSingle();
    if (!acc) throw new Error(LOGIN_FAIL);
    if (acc.attempts >= GAME_PIN_MAX_ATTEMPTS) throw new Error("여러 번 틀려서 잠겼습니다. 새 아이디로 시작하거나 담당자에게 문의해 주세요.");
    if ((await hashGamePin(data.pin, acc.patient_id)) !== acc.pin_hash) {
      await db.from("game_accounts").update({ attempts: acc.attempts + 1 }).eq("patient_id", acc.patient_id);
      throw new Error(LOGIN_FAIL);
    }
    const token = await startSession(db, acc.patient_id);
    return { token, loginId: data.loginId, patient: await patientOf(db, acc.patient_id) };
  });

export const getGameProgress = createServerFn({ method: "POST" })
  .validator((d: unknown) => ({ token: (d as { token?: unknown })?.token }))
  .handler(async ({ data }): Promise<GameProgress | null> => {
    ensureEnabled();
    const db = await admin();
    const pid = await patientIdFromToken(db, data.token);
    if (!pid) return null;
    const { data: logs, error } = await db.from("play_logs").select("session_start, play_minutes").eq("patient_id", pid).order("session_start");
    if (error) throw new Error(RETRY);
    return { patient: await patientOf(db, pid), logs: logs ?? [] };
  });

export const saveGamePlay = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { token?: unknown; row?: unknown })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    ensureEnabled();
    const db = await admin();
    const pid = await patientIdFromToken(db, data.token);
    if (!pid) throw new Error("다시 들어와 주세요. 접속 시간이 지났습니다.");
    const row = checkPlayRow(data.row);
    if (!row) throw new Error("플레이 기록을 저장할 수 없습니다.");
    const { error } = await db.from("play_logs").insert({ ...row, patient_id: pid });
    if (error) {
      console.error("[game] 플레이 기록 저장 실패", error.code, error.message);
      throw new Error(RETRY);
    }
    return { ok: true };
  });

export const gameSignOut = createServerFn({ method: "POST" })
  .validator((d: unknown) => ({ token: (d as { token?: unknown })?.token }))
  .handler(async ({ data }) => {
    if (!isDemoEnabled(process.env["DEMO_MODE"])) return { ok: true };
    const db = await admin();
    const pid = await patientIdFromToken(db, data.token);
    if (pid) await db.from("game_accounts").update({ session_hash: null, session_expires_at: null }).eq("patient_id", pid);
    return { ok: true };
  });
