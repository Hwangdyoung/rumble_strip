/**
 * 환자용 게임(/play) 계정과 기록 확인 (순수 함수, SQL 012). 서버 처리는 game-account.server.ts.
 * 방문자는 별명·나이·아이디·숫자 4자리로 환자를 만들고, 다음에는 아이디+숫자 4자리로 이어서 한다.
 * 실명 대신 별명을 쓰게 하고, 그 밖의 개인정보는 받지 않는다.
 */

export const GAME_MIN_AGE = 6;
export const GAME_MAX_AGE = 12;
export const GAME_PIN_MAX_ATTEMPTS = 5;
/** 하루(한국 날짜)에 게임으로 만들 수 있는 환자 수 상한 (장난으로 대량 생성되는 것 막기) */
export const GAME_DAILY_LIMIT = 300;
/** 이어서 하기 접속 표시가 유지되는 시간 */
export const GAME_SESSION_HOURS = 12;

const LOGIN_ID_RE = /^[a-z0-9]{3,20}$/;
const PIN_RE = /^\d{4}$/;

export interface NewGamePatientInput {
  nickname: string;
  age: number | string;
  loginId: string;
  pin: string;
}

export interface NewGamePatient {
  nickname: string;
  age: number;
  loginId: string;
  pin: string;
}

type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function checkNewGamePatient(input: NewGamePatientInput & { pinConfirm?: string }): Checked<NewGamePatient> {
  const nickname = String(input.nickname ?? "").trim().replace(/\s+/g, " ");
  const age = Number(input.age);
  const loginId = String(input.loginId ?? "").trim().toLowerCase();
  const pin = String(input.pin ?? "").trim();
  const errors: string[] = [];
  if (nickname.length < 1 || nickname.length > 12) errors.push("별명을 1~12자로 입력하세요.");
  if (!Number.isInteger(age) || age < GAME_MIN_AGE || age > GAME_MAX_AGE) errors.push(`나이는 ${GAME_MIN_AGE}~${GAME_MAX_AGE}세로 입력하세요.`);
  if (!LOGIN_ID_RE.test(loginId)) errors.push("아이디는 영문 소문자와 숫자 3~20자로 입력하세요.");
  if (!PIN_RE.test(pin)) errors.push("숫자 4자리를 입력하세요.");
  else if (input.pinConfirm !== undefined && input.pinConfirm.trim() !== pin) errors.push("숫자 4자리가 서로 다릅니다.");
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { nickname, age, loginId, pin } };
}

export function checkGameLogin(input: { loginId: string; pin: string }): Checked<{ loginId: string; pin: string }> {
  const loginId = String(input.loginId ?? "").trim().toLowerCase();
  const pin = String(input.pin ?? "").trim();
  const errors: string[] = [];
  if (!LOGIN_ID_RE.test(loginId)) errors.push("아이디를 입력하세요.");
  if (!PIN_RE.test(pin)) errors.push("숫자 4자리를 입력하세요.");
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { loginId, pin } };
}

export interface GamePlayRow {
  session_start: string;
  session_end: string;
  play_minutes: number;
  tasks_completed: number;
  ended_early: boolean;
  accuracy: number | null;
  reaction_ms: number | null;
}

/**
 * 저장 전 플레이 기록 확인. 시각은 지금 기준 3시간 안, 끝 ≥ 시작, 미래 아님(1분 여유).
 * 플레이 1~60분, 과제 0~10개, 정확도 0~100, 반응 시간 0~10초. 맞으면 정리된 값, 아니면 null.
 * 정확도는 정수로 반올림한다: 사용자 Supabase의 play_logs.accuracy 칸이 integer라 68.4 같은 값은 거절된다(2026-11-17 22P02로 확인).
 */
export function checkPlayRow(row: unknown, now: Date = new Date()): GamePlayRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Partial<Record<keyof GamePlayRow, unknown>>;
  const start = new Date(String(r.session_start));
  const end = new Date(String(r.session_end));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const t = now.getTime();
  if (end.getTime() < start.getTime()) return null;
  if (end.getTime() > t + 60_000 || start.getTime() < t - 3 * 3600_000) return null;
  const minutes = Number(r.play_minutes);
  const tasks = Number(r.tasks_completed);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) return null;
  if (!Number.isInteger(tasks) || tasks < 0 || tasks > 10) return null;
  const acc = r.accuracy === null || r.accuracy === undefined ? null : Number(r.accuracy);
  const rt = r.reaction_ms === null || r.reaction_ms === undefined ? null : Number(r.reaction_ms);
  if (acc !== null && (!Number.isFinite(acc) || acc < 0 || acc > 100)) return null;
  if (rt !== null && (!Number.isInteger(rt) || rt < 0 || rt > 10_000)) return null;
  return {
    session_start: start.toISOString(),
    session_end: end.toISOString(),
    play_minutes: minutes,
    tasks_completed: tasks,
    ended_early: Boolean(r.ended_early),
    accuracy: acc === null ? null : Math.round(acc),
    reaction_ms: rt,
  };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
}

/** 숫자 4자리 저장용 해시: SHA-256(환자 id + 숫자) */
export function hashGamePin(pin: string, patientId: string) {
  return sha256Hex(`${patientId}:pin:${pin.trim()}`);
}

/** 접속 표시(브라우저에 둠) 저장용 해시 */
export function hashGameToken(token: string) {
  return sha256Hex(`game-session:${token}`);
}

export function newGameToken(): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
