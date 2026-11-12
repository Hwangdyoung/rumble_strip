/**
 * 처음 설정 코드 (SQL 010): 관리자가 계정을 만들 때 비밀번호 대신 건네는 일회용 코드.
 * 본인이 로그인 화면 '코드로 비밀번호 만들기'(/activate)에서 아이디·코드·새 비밀번호를 넣는다.
 * 순수 함수만 둔다(화면과 서버 함수가 함께 쓴다). DB 조회·저장은 staff-account.server.ts.
 */
import { MIN_PASSWORD } from "./staff-account";

/** 코드를 쓸 수 있는 시간 */
export const SETUP_CODE_HOURS = 72;
/** 이만큼 틀리면 그 코드는 무효(관리자가 다시 만들어야 함) */
export const SETUP_CODE_MAX_ATTEMPTS = 5;

/** 헷갈리는 글자(0/O, 1/I) 없는 32글자. 32개라 바이트 하위 5비트로 치우침 없이 고른다. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 8;

/** 테스트에서 글자 수(32)와 중복 없음을 확인한다 */
export const SETUP_CODE_ALPHABET = ALPHABET;

/** 8글자 코드를 4-4로 끊어 보여 준다. 예: K7QM-4XPA */
export function formatSetupCode(raw: string): string {
  const c = normalizeSetupCode(raw);
  return c.length === CODE_LEN ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** 입력한 코드 정리: 대문자로, 띄어쓰기·하이픈 제거 */
export function normalizeSetupCode(input: string): string {
  return String(input ?? "").toUpperCase().replace(/[\s-]/g, "");
}

/** 새 코드 (기본은 crypto.getRandomValues). bytes는 테스트에서 넣는다. */
export function generateSetupCode(bytes?: Uint8Array): string {
  const b = bytes ?? globalThis.crypto.getRandomValues(new Uint8Array(CODE_LEN));
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[(b[i] ?? 0) & 31];
  return formatSetupCode(out);
}

/** 아무도 모르는 임의 비밀번호 (코드를 쓰기 전까지 계정에 걸어 둔다) */
export function randomHiddenPassword(): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** 저장용 해시: SHA-256(계정 id + 정리한 코드). 계정마다 값이 달라진다. */
export async function hashSetupCode(code: string, staffId: string): Promise<string> {
  const data = new TextEncoder().encode(`${staffId}:${normalizeSetupCode(code)}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
}

/** 같은 길이 문자열 비교 (걸린 시간으로 맞는 글자 수를 짐작하지 못하게) */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function setupCodeExpiry(now: Date): Date {
  return new Date(now.getTime() + SETUP_CODE_HOURS * 3600_000);
}

export interface InviteLike {
  expires_at: string;
  used_at: string | null;
  attempts: number;
}

export type InviteState = "대기" | "사용함" | "기한 지남" | "잠김";

/** 코드 상태. '대기'만 코드를 쓸 수 있다. */
export function inviteState(inv: InviteLike, now: Date): InviteState {
  if (inv.used_at) return "사용함";
  if (inv.attempts >= SETUP_CODE_MAX_ATTEMPTS) return "잠김";
  if (new Date(inv.expires_at).getTime() <= now.getTime()) return "기한 지남";
  return "대기";
}

export interface ActivationInput {
  loginId: string;
  code: string;
  password: string;
}

/** 코드로 비밀번호 만들기 입력 확인. 고칠 점이 있으면 문장 목록. */
export function checkActivation(
  input: ActivationInput & { confirm?: string },
): { ok: true; value: ActivationInput } | { ok: false; errors: string[] } {
  const loginId = String(input.loginId ?? "").trim().toLowerCase();
  const code = normalizeSetupCode(input.code);
  const password = String(input.password ?? "");
  const errors: string[] = [];
  if (loginId.length < 3 || loginId.length > 30 || loginId.includes("@")) errors.push("아이디를 입력해 주세요(관리자에게 받은 아이디).");
  if (code.length !== CODE_LEN) errors.push("처음 설정 코드는 8글자입니다(예: K7QM-4XPA).");
  if (password.length < MIN_PASSWORD) errors.push(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`);
  else if (password.length > 72) errors.push("비밀번호가 너무 깁니다(72자 이하).");
  if (input.confirm !== undefined && input.confirm !== password) errors.push("비밀번호 확인이 같지 않습니다.");
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { loginId, code, password } };
}

/** 관리자가 본인에게 그대로 보낼 안내 문장 */
export function setupMessage(p: { name: string; loginId: string; code: string; expiresAt: Date; siteUrl: string }): string {
  const d = p.expiresAt;
  const when = `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return [
    `${p.name} 님, 이탈방지턱 계정을 만들었습니다.`,
    `1) ${p.siteUrl}/activate 에 들어갑니다.`,
    `2) 아이디 ${p.loginId}, 처음 설정 코드 ${formatSetupCode(p.code)} 를 넣고 비밀번호를 직접 정합니다.`,
    `코드는 ${when}까지, 한 번만 쓸 수 있습니다.`,
  ].join("\n");
}
