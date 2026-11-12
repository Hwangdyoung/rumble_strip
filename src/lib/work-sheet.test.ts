import { describe, expect, it } from "vitest";
import { buildWorkSheetHtml } from "./work-sheet";

describe("buildWorkSheetHtml", () => {
  it("알림·다시 연락 표와 보관 주의 문구, 지연 표시", () => {
    const html = buildWorkSheetHtml({
      title: "admin 담당",
      alerts: [{ patient: "이도윤", level: "이탈 위험", status: "확인", assignee: "admin", ageDays: 3, overdue: true, handoffNote: "박간호 · 인계" }],
      followUps: [{ patient: "한시우", dueDate: "2026-11-11", overdueDays: 1, assignee: "admin" }],
    });
    expect(html).toContain("처리할 알림 (1건)");
    expect(html).toContain("오늘 다시 연락 (1건)");
    expect(html).toContain("폐기");
    expect(html).toContain("지연");
    expect(html).toContain("11/11");
    expect(html).toContain("넘겨받음: 박간호 · 인계");
  });
  it("비어 있으면 안내 문장", () => {
    const html = buildWorkSheetHtml({ title: "전체", alerts: [], followUps: [] });
    expect(html).toContain("처리할 알림이 없습니다.");
    expect(html).toContain("오늘 다시 연락할 환자가 없습니다.");
  });
});
