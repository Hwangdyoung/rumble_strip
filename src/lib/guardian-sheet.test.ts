import { describe, expect, it } from "vitest";
import { buildGuardianSheetHtml, type GuardianSheetInput } from "./guardian-sheet";

const input: GuardianSheetInput = {
  patientName: "이도윤<script>",
  age: 11,
  prescriptionStartDate: "2026-10-19",
  prescriptionWeeks: 4,
  weeklyTargetDays: 5,
  sessionTargetMinutes: 30,
  adherence: 0.64,
  recentDays: 2,
  currentGap: 4,
  sessionsDone: 12,
  sessionsExpected: 14,
  weeks: [
    { week: "1주차", days: 5, avgMinutes: 30 },
    { week: "2주차", days: 4, avgMinutes: 28 },
    { week: "3주차", days: 2, avgMinutes: 25 },
    { week: "4주차", days: 0, avgMinutes: 0 },
  ],
  notes: ["처방 기준 대비 64% 사용했어요.", "4일째 사용 기록이 없어요.", "꾸준히 사용하는 것이 가장 중요해요."],
  staffName: "박간호",
  printedAt: new Date(2026, 10, 12),
};

describe("buildGuardianSheetHtml", () => {
  const html = buildGuardianSheetHtml(input);

  it("아이 정보, 사용 현황, 주별 표, 문의 칸이 들어간다", () => {
    expect(html).toContain("2026년 10월 19일");
    expect(html).toContain("64%");
    expect(html).toContain("12/14회");
    expect(html).toContain("4일");
    expect(html.match(/<tr><th>\d주차<\/th>/g)).toHaveLength(4);
    expect(html).toContain("박간호");
    expect(html).toContain("다음 연락 예정");
  });

  it("점수나 위험 단계를 쓰지 않는다", () => {
    expect(html).not.toMatch(/위험|점수|\/100/);
  });

  it("이름 등 글자는 HTML로 해석되지 않게 바꾼다", () => {
    expect(html).not.toContain("이도윤<script>");
    expect(html).toContain("이도윤&lt;script&gt;");
  });
});
