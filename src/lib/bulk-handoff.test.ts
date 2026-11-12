import { describe, expect, it } from "vitest";
import { bulkResultText, handoffCandidates, selectableIds, splitHandoff } from "./bulk-handoff";

// 나(me)는 p1·p2·p3 담당. a는 p1·p2, b는 p3, c는 선택 안 한 p9만.
const links = [
  { patientId: "p1", staffId: "me" },
  { patientId: "p2", staffId: "me" },
  { patientId: "p3", staffId: "me" },
  { patientId: "p3", staffId: "b" },
  { patientId: "p1", staffId: "a" },
  { patientId: "p2", staffId: "a" },
  { patientId: "p9", staffId: "c" },
];

describe("splitHandoff", () => {
  it("받는 사람이 담당하는 환자만 넘기고 나머지는 건너뛴다", () => {
    expect(splitHandoff(["p1", "p2", "p3"], links, "a")).toEqual({ eligible: ["p1", "p2"], skipped: ["p3"] });
    expect(splitHandoff(["p1", "p3"], links, "b")).toEqual({ eligible: ["p3"], skipped: ["p1"] });
  });
});

describe("handoffCandidates", () => {
  it("나를 빼고, 선택한 환자를 담당하는 사람만, 넘길 수 있는 환자가 많은 순", () => {
    const c = handoffCandidates(["p1", "p2", "p3"], links, "me");
    expect(c.map((x) => x.staffId)).toEqual(["a", "b"]);
    expect(c[0]).toEqual({ staffId: "a", eligible: ["p1", "p2"], skipped: ["p3"] });
  });
  it("아무도 함께 담당하지 않으면 빈 목록", () => {
    expect(handoffCandidates(["p1"], links.filter((l) => l.staffId !== "a"), "me")).toEqual([]);
  });
});

describe("selectableIds", () => {
  it("내가 연락 담당인 환자만", () => {
    const rows = [
      { patientId: "p1", contactId: "me" },
      { patientId: "p2", contactId: "a" },
      { patientId: "p3", contactId: null },
    ];
    expect(selectableIds(rows, "me")).toEqual(["p1"]);
    expect(selectableIds(rows, null)).toEqual([]);
  });
});

describe("bulkResultText", () => {
  it("성공·일부 실패·전부 실패", () => {
    expect(bulkResultText("김간호", 2, [])).toBe("2명을 김간호 님에게 넘겼습니다.");
    expect(bulkResultText("김간호", 1, ["강민준"])).toContain("강민준 님은 넘기지 못했습니다");
    expect(bulkResultText("김간호", 0, ["강민준"])).toMatch(/^넘기지 못했습니다\./);
  });
});
