import { describe, expect, it } from "vitest";
import { buildWorkSheetHtml } from "./work-sheet";

describe("buildWorkSheetHtml", () => {
  it("연락할 환자 표, 표시, 보관 주의 문구", () => {
    const html = buildWorkSheetHtml({
      title: "admin 담당",
      rows: [{ patient: "이도윤", level: "이탈 위험", reason: "4일 연속 미접속", status: "연락 전", contact: "admin", badges: ["새로 나빠짐"] }],
    });
    expect(html).toContain("오늘 연락할 환자 (1명)");
    expect(html).toContain("4일 연속 미접속");
    expect(html).toContain("새로 나빠짐");
    expect(html).toContain("폐기");
  });
  it("비어 있으면 안내 문장", () => {
    expect(buildWorkSheetHtml({ title: "전체", rows: [] })).toContain("오늘 연락할 환자가 없습니다.");
  });
});
