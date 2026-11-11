/**
 * 아이디 로그인: Supabase 인증은 이메일만 받으므로, '@'가 없는 아이디는
 * 정해진 주소를 붙여 이메일로 바꾼다. 예: admin → admin@rumble-strip.test
 * (.test는 실제 메일을 받을 수 없는 예약 주소라, 이 계정은 비밀번호 찾기 메일을 받지 못한다)
 */
export const LOGIN_ID_DOMAIN = "rumble-strip.test";

export function loginIdToEmail(input: string): string {
  const v = input.trim();
  return v.includes("@") ? v : `${v.toLowerCase()}@${LOGIN_ID_DOMAIN}`;
}

/** 아이디 계정이면 아이디만, 아니면 이메일 그대로 */
export function displayLoginId(email: string): string {
  const suffix = `@${LOGIN_ID_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}
