import { describe, expect, it } from "vitest";
import { availableDemoRoles, isDemoEnabled, isDemoRole, pickDemoAccount } from "./demo";

const rows = [
  { id: "admin", role: "의사", is_admin: true, is_demo: true, created_at: "2026-11-01" },
  { id: "doc2", role: "의사", is_admin: false, is_demo: true, created_at: "2026-11-03" },
  { id: "doc1", role: "의사", is_admin: false, is_demo: true, created_at: "2026-11-02" },
  { id: "nurse-real", role: "간호사", is_admin: false, is_demo: false, created_at: "2026-11-01" },
  { id: "counselor", role: "상담원", is_admin: false, is_demo: true, created_at: "2026-11-02" },
];

describe("isDemoEnabled", () => {
  it("on·true·1·yes만 켜짐", () => {
    for (const v of ["on", "ON", " true ", "1", "yes"]) expect(isDemoEnabled(v)).toBe(true);
    for (const v of [undefined, null, "", "off", "0", "false"]) expect(isDemoEnabled(v)).toBe(false);
  });
});

describe("pickDemoAccount", () => {
  it("관리자는 빼고, 둘러보기 계정 중 먼저 만든 계정", () => {
    expect(pickDemoAccount(rows, "의사")?.id).toBe("doc1");
    expect(pickDemoAccount(rows, "상담원")?.id).toBe("counselor");
  });
  it("둘러보기 표시가 없는 계정은 고르지 않는다", () => {
    expect(pickDemoAccount(rows, "간호사")).toBeNull();
  });
});

describe("availableDemoRoles·isDemoRole", () => {
  it("계정이 있는 역할만", () => {
    expect(availableDemoRoles(rows)).toEqual(["의사", "상담원"]);
  });
  it("역할 이름 확인", () => {
    expect(isDemoRole("간호사")).toBe(true);
    expect(isDemoRole("관리자")).toBe(false);
    expect(isDemoRole(1)).toBe(false);
  });
});
