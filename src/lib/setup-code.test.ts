import { describe, expect, it } from "vitest";
import {
  checkActivation,
  formatSetupCode,
  generateSetupCode,
  hashSetupCode,
  inviteState,
  normalizeSetupCode,
  sameHash,
  SETUP_CODE_ALPHABET,
  SETUP_CODE_MAX_ATTEMPTS,
  setupCodeExpiry,
  setupMessage,
} from "./setup-code";

describe("코드 만들기", () => {
  it("글자는 32개이고 겹치지 않으며 헷갈리는 0·O·1·I가 없다", () => {
    expect(SETUP_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(SETUP_CODE_ALPHABET).size).toBe(32);
    expect(SETUP_CODE_ALPHABET).not.toMatch(/[0O1I]/);
  });
  it("8글자를 4-4로 끊어 돌려준다", () => {
    const c = generateSetupCode();
    expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(generateSetupCode(new Uint8Array([0, 1, 2, 3, 31, 32, 33, 255]))).toBe("ABCD-9AB9");
  });
  it("입력한 코드는 대문자로, 띄어쓰기·하이픈 없이 정리한다", () => {
    expect(normalizeSetupCode(" k7qm-4xpa ")).toBe("K7QM4XPA");
    expect(formatSetupCode("k7qm4xpa")).toBe("K7QM-4XPA");
  });
});

describe("해시", () => {
  it("같은 코드면 입력 모양이 달라도 같고, 계정이 다르면 다르다", async () => {
    const a = await hashSetupCode("K7QM-4XPA", "staff-1");
    expect(await hashSetupCode("k7qm4xpa", "staff-1")).toBe(a);
    expect(await hashSetupCode("K7QM-4XPA", "staff-2")).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("sameHash는 같을 때만 참", () => {
    expect(sameHash("abc", "abc")).toBe(true);
    expect(sameHash("abc", "abd")).toBe(false);
    expect(sameHash("abc", "ab")).toBe(false);
  });
});

describe("코드 상태", () => {
  const now = new Date("2026-11-12T00:00:00Z");
  const exp = setupCodeExpiry(now).toISOString();
  it("72시간 뒤가 기한이다", () => {
    expect(exp).toBe("2026-11-15T00:00:00.000Z");
  });
  it("대기·사용함·기한 지남·잠김", () => {
    expect(inviteState({ expires_at: exp, used_at: null, attempts: 0 }, now)).toBe("대기");
    expect(inviteState({ expires_at: exp, used_at: now.toISOString(), attempts: 0 }, now)).toBe("사용함");
    expect(inviteState({ expires_at: exp, used_at: null, attempts: 0 }, new Date("2026-11-15T00:00:00Z"))).toBe("기한 지남");
    expect(inviteState({ expires_at: exp, used_at: null, attempts: SETUP_CODE_MAX_ATTEMPTS }, now)).toBe("잠김");
  });
});

describe("checkActivation", () => {
  it("올바른 입력을 정리한다", () => {
    expect(checkActivation({ loginId: " Kim01 ", code: "k7qm-4xpa", password: "abcd1234", confirm: "abcd1234" })).toEqual({
      ok: true,
      value: { loginId: "kim01", code: "K7QM4XPA", password: "abcd1234" },
    });
  });
  it("짧은 코드, 짧은 비밀번호, 확인 불일치를 알려 준다", () => {
    const r = checkActivation({ loginId: "kim01", code: "K7QM", password: "abc", confirm: "abd" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
  });
});

describe("setupMessage", () => {
  it("주소·아이디·코드·기한이 들어가고 비밀번호는 없다", () => {
    const m = setupMessage({ name: "김간호", loginId: "kim01", code: "K7QM4XPA", expiresAt: new Date(2026, 10, 15, 9, 5), siteUrl: "https://example.test" });
    expect(m).toContain("https://example.test/activate");
    expect(m).toContain("kim01");
    expect(m).toContain("K7QM-4XPA");
    expect(m).toContain("11월 15일 09:05");
    expect(m).not.toContain("비밀번호:");
  });
});
