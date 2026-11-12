/**
 * 관리자가 만드는 의료진 계정: 입력 확인 (순수 함수, 화면과 서버 함수가 함께 쓴다).
 * 계정은 아이디 로그인용 주소(아이디@rumble-strip.test)로 만든다. 실제 메일을 받지 않으므로
 * 비밀번호를 잊으면 관리자가 Supabase에서 바꿔 준다.
 */
import { loginIdToEmail } from "./login-id";

export const NEW_ACCOUNT_ROLES = ["의사", "간호사", "상담원"] as const;
export type NewAccountRole = (typeof NEW_ACCOUNT_ROLES)[number];

export const MIN_PASSWORD = 8;

export interface NewAccountInput {
  loginId: string;
  name: string;
  role: string;
  password: string;
}

export interface NewAccount {
  loginId: string;
  email: string;
  name: string;
  role: NewAccountRole;
  password: string;
}

const LOGIN_ID_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** 고칠 점이 있으면 문장 목록, 없으면 정리된 값 */
export function checkNewAccount(input: NewAccountInput): { ok: true; value: NewAccount } | { ok: false; errors: string[] } {
  const loginId = String(input.loginId ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim();
  const role = String(input.role ?? "");
  const password = String(input.password ?? "");
  const errors: string[] = [];
  if (!LOGIN_ID_RE.test(loginId)) errors.push("아이디는 영어 소문자·숫자로 3~30자로 정해 주세요(가운데에 . _ - 사용 가능).");
  if (name.length < 1 || name.length > 30) errors.push("이름을 1~30자로 입력해 주세요.");
  if (!(NEW_ACCOUNT_ROLES as readonly string[]).includes(role)) errors.push("역할을 골라 주세요.");
  if (password.length < MIN_PASSWORD) errors.push(`처음 비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`);
  else if (password.length > 72) errors.push("비밀번호가 너무 깁니다(72자 이하).");
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { loginId, email: loginIdToEmail(loginId), name, role: role as NewAccountRole, password } };
}

/** 영어·숫자로 된 처음 비밀번호 제안 (헷갈리는 글자 0/O, 1/l/I 제외) */
export function suggestPassword(length = 10, random: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[random(chars.length)];
  return out;
}
