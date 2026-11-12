import { describe, expect, it } from "vitest";
import { lightestStaff, sortWorkload, workloadText, type Workload } from "./workload";

const w = (staffId: string, todo: number, patients: number, name = staffId): Workload => ({
  staffId,
  name,
  role: "간호사",
  patients,
  newWorse: todo,
  followDue: 0,
  todo,
});

describe("workloadText", () => {
  it("맡은 환자와 오늘 할 일을 보여 준다", () => {
    expect(workloadText(w("a", 2, 5))).toBe("맡은 환자 5 · 오늘 할 일 2");
  });
  it("정보가 없으면 그렇게 말한다", () => {
    expect(workloadText(undefined)).toBe("업무량 정보 없음");
  });
});

describe("lightestStaff", () => {
  const list = [w("a", 3, 5), w("b", 1, 6), w("c", 1, 2), w("d", 0, 9)];

  it("후보 중 오늘 할 일이 가장 적은 사람", () => {
    expect(lightestStaff(list, ["a", "b"])).toEqual(["b"]);
  });
  it("오늘 할 일이 같으면 맡은 환자가 적은 사람", () => {
    expect(lightestStaff(list, ["a", "b", "c"])).toEqual(["c"]);
  });
  it("후보가 아닌 사람은 고르지 않는다", () => {
    expect(lightestStaff(list, ["a", "b"])).not.toContain("d");
  });
  it("후보가 한 명이면 표시하지 않는다", () => {
    expect(lightestStaff(list, ["a"])).toEqual([]);
  });
  it("모두 같으면 표시하지 않는다", () => {
    expect(lightestStaff([w("a", 1, 3), w("b", 1, 3)], ["a", "b"])).toEqual([]);
  });
  it("공동 최소는 모두 표시한다", () => {
    expect(lightestStaff([w("a", 1, 3), w("b", 1, 3), w("c", 2, 3)], ["a", "b", "c"])).toEqual(["a", "b"]);
  });
  it("업무량 정보가 없는 후보는 빼고 비교한다", () => {
    expect(lightestStaff(list, ["a", "zzz"])).toEqual([]);
  });
});

describe("sortWorkload", () => {
  it("오늘 할 일 많은 순, 같으면 맡은 환자 많은 순", () => {
    expect(sortWorkload([w("a", 1, 2), w("b", 3, 1), w("c", 1, 5)]).map((x) => x.staffId)).toEqual(["b", "c", "a"]);
  });
});
