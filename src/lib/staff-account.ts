/**
 * 관리자가 만드는 의료진 계정: 입력 확인 (순수 함수, 화면과 서버 함수가 함께 쓴다).
 * 계정은 아이디 로그인용 주소(아이디@rumble-strip.test)로 만든다. 실제 메일을 받지 않는다.
 * 비밀번호는 관리자가 정하지 않는다. 관리자는 '처음 설정 코드'(setup-code.ts)를 건네고 본인이 비밀번호를 만든다.
 * 비밀번호를 잊으면 관리자가 코드를 다시 만들어 준다.
 */
import { loginIdToEmail } from "./login-id";

export const NEW_ACCOUNT_ROLES = ["의사", "간호사", "상담원"] as const;
export type NewAccountRole = (typeof NEW_ACCOUNT_ROLES)[number];

export const MIN_PASSWORD = 8;

export interface NewAccountInput {
  loginId: string;
  name: string;
  role: string;
}

export interface NewAccount {
  loginId: string;
  email: string;
  name: string;
  role: NewAccountRole;
}

const LOGIN_ID_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** 고칠 점이 있으면 문장 목록, 없으면 정리된 값 */
export function checkNewAccount(input: NewAccountInput): { ok: true; value: NewAccount } | { ok: false; errors: string[] } {
  const loginId = String(input.loginId ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim();
  const role = String(input.role ?? "");
  const errors: string[] = [];
  if (!LOGIN_ID_RE.test(loginId)) errors.push("아이디는 영문 소문자와 숫자 3~30자로 입력하세요.");
  if (name.length < 1 || name.length > 30) errors.push("이름을 입력하세요(30자 이내).");
  if (!(NEW_ACCOUNT_ROLES as readonly string[]).includes(role)) errors.push("역할을 선택하세요.");
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { loginId, email: loginIdToEmail(loginId), name, role: role as NewAccountRole } };
}
