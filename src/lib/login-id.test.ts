import { describe, expect, it } from "vitest";
import { displayLoginId, loginIdToEmail } from "./login-id";

describe("loginIdToEmail", () => {
  it("'@'가 없는 아이디에는 정해진 주소를 붙인다", () => {
    expect(loginIdToEmail("admin")).toBe("admin@rumble-strip.test");
    expect(loginIdToEmail("  Admin ")).toBe("admin@rumble-strip.test");
  });
  it("이메일은 그대로 둔다", () => {
    expect(loginIdToEmail("doctor@example.com")).toBe("doctor@example.com");
  });
});

describe("displayLoginId", () => {
  it("아이디 계정은 아이디만 보여 준다", () => {
    expect(displayLoginId("admin@rumble-strip.test")).toBe("admin");
    expect(displayLoginId("doctor@example.com")).toBe("doctor@example.com");
  });
});
