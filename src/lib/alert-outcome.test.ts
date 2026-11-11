import { describe, expect, it } from "vitest";
import { outcomeStats, suggestOutcome } from "./alert-outcome";

const at = (day: number, hour = 18) => new Date(2026, 0, day, hour).toISOString();

describe("suggestOutcome", () => {
  const created = at(10, 9);

  it("알림 후 7일 안에 플레이 기록이 있으면 회복 제안", () => {
    const s = suggestOutcome(created, [{ session_start: at(13), play_minutes: 20 }]);
    expect(s?.outcome).toBe("회복");
    expect(s?.daysAfter).toBe(3);
  });

  it("7일이 지난 기록, 알림 이전 기록, 0분 기록은 제안하지 않는다", () => {
    expect(
      suggestOutcome(created, [
        { session_start: at(18), play_minutes: 20 },
        { session_start: at(9), play_minutes: 20 },
        { session_start: at(11), play_minutes: 0 },
      ]),
    ).toBeNull();
  });
});

describe("outcomeStats", () => {
  it("미정은 비율 계산에서 빼고, 단계별 회복 비율을 센다", () => {
    const s = outcomeStats([
      { outcome: "회복", alert_level: "주의" },
      { outcome: "이탈", alert_level: "주의" },
      { outcome: "회복", alert_level: "이탈 위험" },
      { outcome: "연락 불가", alert_level: null },
      { outcome: "미정", alert_level: "치료이탈" },
    ]);
    expect(s.total).toBe(5);
    expect(s.recorded).toBe(4);
    expect(s.counts).toEqual({ 회복: 2, 이탈: 1, "연락 불가": 1 });
    expect(s.rates.회복).toBe(0.5);
    expect(s.byLevel).toEqual([
      { level: "주의", recorded: 2, recovered: 1, rate: 0.5 },
      { level: "이탈 위험", recorded: 1, recovered: 1, rate: 1 },
      { level: "단계 미기록", recorded: 1, recovered: 0, rate: 0 },
    ]);
  });

  it("기록이 없으면 비율은 null", () => {
    expect(outcomeStats([{ outcome: "미정", alert_level: "주의" }]).rates.회복).toBeNull();
  });
});
