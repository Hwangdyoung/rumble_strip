import { describe, expect, it } from "vitest";
import { buildWorklist, type WorkAlert } from "./worklist";

const now = new Date(2026, 0, 10, 10);
const at = (day: number, hour = 9) => new Date(2026, 0, day, hour).toISOString();
const a = (id: string, day: number, extra: Partial<WorkAlert> = {}): WorkAlert => ({
  id, patient_id: "p" + id, patient_name: "환자" + id, created_at: at(day), status: "미확인",
  alert_level: "이탈 위험", assignee_id: null, resolved_at: null, ...extra,
});

describe("buildWorklist", () => {
  const list = buildWorklist(
    [
      a("1", 9, { assignee_id: "me" }),
      a("2", 7),
      a("3", 10, { assignee_id: "other", status: "확인" }),
      a("4", 5, { status: "조치완료", resolved_at: at(10, 8) }),
      a("5", 3, { status: "조치완료", resolved_at: at(9, 8) }),
    ],
    "me",
    now,
  );

  it("조치완료는 빼고 오래된 순으로 정렬한다", () => {
    expect(list.items.all.map((x) => x.id)).toEqual(["2", "1", "3"]);
  });

  it("탭별로 내 담당과 미지정을 나눈다", () => {
    expect(list.items.mine.map((x) => x.id)).toEqual(["1"]);
    expect(list.items.unassigned.map((x) => x.id)).toEqual(["2"]);
  });

  it("2일 이상 지난 알림은 지연", () => {
    expect(list.items.all.find((x) => x.id === "2")?.overdue).toBe(true);
    expect(list.items.all.find((x) => x.id === "1")?.overdue).toBe(false);
    expect(list.overdueCount).toBe(1);
  });

  it("담당자별 남은 건수와 오늘 처리 완료 수", () => {
    expect(list.byAssignee).toEqual(
      expect.arrayContaining([{ assigneeId: "me", count: 1 }, { assigneeId: "other", count: 1 }, { assigneeId: null, count: 1 }]),
    );
    expect(list.doneToday).toBe(1);
  });

  it("로그인 정보가 없으면 내 담당은 비어 있다", () => {
    expect(buildWorklist([a("1", 9, { assignee_id: "me" })], null, now).items.mine).toEqual([]);
  });
});
