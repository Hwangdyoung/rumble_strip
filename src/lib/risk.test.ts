import { describe, expect, it } from "vitest";
import { computeRisk, RISK_CONFIG } from "./risk";

const patient = {
  prescription_start_date: "2026-01-01",
  prescription_weeks: 4,
  weekly_target_days: 5,
  session_target_minutes: 30,
};
const log = (day: number, minutes = 30) => ({
  session_start: new Date(2026, 0, 1 + day, 18).toISOString(),
  play_minutes: minutes,
});
const asOf = new Date(2026, 0, 21, 23); // day 20

describe("risk levels", () => {
  it("주 5일 30분 사용은 정상", () => {
    const logs = Array.from({ length: 21 }, (_, d) => d).filter((d) => d % 7 < 5).map((d) => log(d));
    const r = computeRisk(patient, logs, asOf);
    expect(r.level).toBe("정상");
  });

  it("최근 7일 중 3일 사용은 주의", () => {
    const logs = [
      ...Array.from({ length: 14 }, (_, d) => d).filter((d) => d % 7 < 5).map((d) => log(d)),
      log(14), log(16), log(19),
    ];
    expect(computeRisk(patient, logs, asOf).level).toBe("주의");
  });

  it("최근 7일 중 2일 사용은 이탈 위험", () => {
    const logs = [
      ...Array.from({ length: 14 }, (_, d) => d).filter((d) => d % 7 < 5).map((d) => log(d)),
      log(16), log(19),
    ];
    expect(computeRisk(patient, logs, asOf).level).toBe("이탈 위험");
  });

  it("3일 연속 미접속은 이탈 위험", () => {
    const logs = Array.from({ length: 18 }, (_, d) => d).filter((d) => d % 7 < 5).map((d) => log(d));
    // days 18,19,20 none; days 15,16 played (15%7=1, 16%7=2)
    expect(computeRisk(patient, logs, asOf).metrics.currentGap).toBe(4);
    expect(computeRisk(patient, logs, asOf).level).toBe("이탈 위험");
  });

  it("처방 기간 중 7일 연속 미접속은 치료이탈", () => {
    const logs = [log(0), log(1), log(2), log(10)];
    expect(computeRisk(patient, logs, asOf).level).toBe("치료이탈");
  });

  it("점수는 단계 구간 안에 있다", () => {
    const r = computeRisk(patient, [log(0)], asOf);
    const [lo, hi] = RISK_CONFIG.bands[r.level];
    expect(r.score).toBeGreaterThanOrEqual(lo);
    expect(r.score).toBeLessThanOrEqual(hi);
  });
});
