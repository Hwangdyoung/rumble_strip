import { describe, expect, it } from "vitest";
import { checkNewAccount, suggestPassword } from "./staff-account";

const base = { loginId: "Kim01", name: " 김간호 ", role: "간호사", password: "abcd1234" };

describe("checkNewAccount", () => {
  it("올바른 입력은 정리해서 돌려준다(아이디 소문자, 아이디 로그인 주소)", () => {
    const r = checkNewAccount(base);
    expect(r).toEqual({
      ok: true,
      value: { loginId: "kim01", email: "kim01@rumble-strip.test", name: "김간호", role: "간호사", password: "abcd1234" },
    });
  });
  it("아이디 형식이 틀리면 거절한다", () => {
    for (const loginId of ["ab", "김간호", "kim 01", "kim@x.com", "-kim", "a".repeat(31)]) {
      expect(checkNewAccount({ ...base, loginId }).ok).toBe(false);
    }
  });
  it("이름 없음, 모르는 역할, 짧은 비밀번호를 각각 알려 준다", () => {
    const r = checkNewAccount({ loginId: "kim01", name: " ", role: "관리자", password: "1234567" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
  });
});

describe("suggestPassword", () => {
  it("헷갈리는 글자 없이 정한 길이로 만든다", () => {
    const p = suggestPassword(12);
    expect(p).toHaveLength(12);
    expect(p).not.toMatch(/[0O1lI]/);
  });
});
