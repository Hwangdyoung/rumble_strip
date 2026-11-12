import { describe, expect, it } from "vitest";
import { buildGuide, UNREACHABLE_STEPS, type GuideInput } from "./response-guide";

const metrics = {
  elapsedDays: 20, recentDays: 2, currentGap: 4, maxGap: 4, adherence: 0.64, sessionChange: 0, weeklyDeclineStreak: 0,
  lastPlayDate: "2026-01-16", sessionsDone: 12, sessionsExpected: 14, sessionsBehind: 2, accuracyDrop: 0,
  recentAccuracy: 80, recentAvgMinutes: 28, shortSession: false, reactionChange: null,
};
const base: GuideInput = {
  risk: { level: "이탈 위험", cause: "단순 미접속", metrics },
  patientName: "이도윤",
  weeklyTargetDays: 5,
  sessionTargetMinutes: 30,
  staffName: "박간호",
};

describe("buildGuide", () => {
  it("단계 할 일에 추정 원인에 맞는 확인 항목을 끼워 넣는다", () => {
    const g = buildGuide(base);
    expect(g.steps[0]).toContain("오늘 안에");
    expect(g.steps.some((s) => s.includes("생활 속 어려움"))).toBe(true);
  });

  it("전화 문장에 환자 이름, 담당자, 실제 미접속일이 들어간다", () => {
    const g = buildGuide(base);
    expect(g.callScript[0]).toContain("이도윤 보호자님");
    expect(g.callScript[0]).toContain("박간호");
    expect(g.callScript[1]).toContain("4일 동안");
  });

  it("보호자 설명에는 점수를 쓰지 않는다", () => {
    const g = buildGuide(base);
    expect(g.plainSummary.join(" ")).not.toMatch(/점수|\/100|위험/);
    expect(g.plainSummary[0]).toContain("64%");
  });

  it("진단·처방·약물 표현을 쓰지 않는다", () => {
    for (const level of ["정상", "주의", "이탈 위험", "치료이탈"] as const) {
      for (const cause of ["난이도 과다", "난이도 낮음", "단순 미접속", null] as const) {
        const g = buildGuide({ ...base, risk: { level, cause, metrics } });
        const all = [g.headline, ...g.steps, ...g.callScript, g.sms, ...g.plainSummary].join(" ");
        expect(all).not.toMatch(/진단|처방 변경|약물|복용|용량/);
      }
    }
  });

  it("연락 불가로 기록되면 다음 단계를 보여 주고, 아니면 비운다", () => {
    expect(buildGuide({ ...base, unreachable: true }).unreachableSteps).toEqual(UNREACHABLE_STEPS);
    expect(buildGuide(base).unreachableSteps).toEqual([]);
  });

  it("담당자 이름이 없으면 빈칸 표시", () => {
    expect(buildGuide({ ...base, staffName: null }).callScript[0]).toContain("[담당자 이름]");
  });
});
