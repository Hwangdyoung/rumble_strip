import { describe, expect, it } from "vitest";
import { computeRisk, RISK_CONFIG, shouldAlert } from "./risk";

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
    // 마지막 접속 17일차 → 18,19,20일차 미접속
    expect(computeRisk(patient, logs, asOf).metrics.currentGap).toBe(3);
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

describe("alerts", () => {
  it("이탈 위험으로 올라가면 알림", () => {
    expect(shouldAlert({ score: 40, level: "주의" }, { score: 56, level: "이탈 위험" })).toBe(true);
  });
  it("같은 단계에서 15점 이상 오르면 알림", () => {
    expect(shouldAlert({ score: 30, level: "주의" }, { score: 45, level: "주의" })).toBe(true);
  });
  it("14점 상승은 알림 없음", () => {
    expect(shouldAlert({ score: 30, level: "주의" }, { score: 44, level: "주의" })).toBe(false);
  });
  it("이미 이탈 위험이면 소폭 상승에 알림 없음", () => {
    expect(shouldAlert({ score: 60, level: "이탈 위험" }, { score: 65, level: "이탈 위험" })).toBe(false);
  });
});

describe("미접속 처리", () => {
  it("0분 기록은 접속으로 세지 않는다", () => {
    const logs = Array.from({ length: 21 }, (_, d) => d).filter((d) => d % 7 < 5).map((d) => log(d));
    const r = computeRisk(patient, [...logs, log(24, 0)], new Date(2026, 0, 25, 23));
    expect(r.metrics.currentGap).toBe(6);
    expect(r.level).toBe("이탈 위험");
  });
});
