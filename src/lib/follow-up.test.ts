import { describe, expect, it } from "vitest";
import { defaultFollowUpDate, dueFollowUps, nextFollowUpDate } from "./follow-up";

const today = new Date(2026, 10, 12, 15);
const f = (id: string, due: string, extra: Partial<{ done_at: string | null; patient_id: string }> = {}) => ({
  id, patient_id: "p1", due_date: due, assignee_id: null, done_at: null, ...extra,
});

describe("defaultFollowUpDate", () => {
  it("단계별 기본 간격", () => {
    expect(defaultFollowUpDate("치료이탈", today)).toBe("2026-11-13");
    expect(defaultFollowUpDate("이탈 위험", today)).toBe("2026-11-14");
    expect(defaultFollowUpDate("주의", today)).toBe("2026-11-15");
    expect(defaultFollowUpDate("정상", today)).toBe("");
  });
  it("달이 바뀌어도 맞게 계산", () => {
    expect(defaultFollowUpDate("주의", new Date(2026, 10, 29))).toBe("2026-12-02");
  });
});

describe("dueFollowUps", () => {
  it("오늘까지 예정된 열린 일정만, 오래된 순, 지난 일수 포함", () => {
    const out = dueFollowUps([f("a", "2026-11-12"), f("b", "2026-11-10"), f("c", "2026-11-13"), f("d", "2026-11-09", { done_at: "x" })], today);
    expect(out.map((x) => [x.id, x.overdueDays])).toEqual([["b", 2], ["a", 0]]);
  });
});

describe("nextFollowUpDate", () => {
  it("환자별 가장 가까운 열린 예정일", () => {
    const items = [f("a", "2026-11-20"), f("b", "2026-11-15"), f("c", "2026-11-14", { done_at: "x" }), f("d", "2026-11-13", { patient_id: "p2" })];
    expect(nextFollowUpDate(items, "p1")).toBe("2026-11-15");
    expect(nextFollowUpDate(items, "p3")).toBeNull();
  });
});
