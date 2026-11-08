import { describe, expect, it } from "vitest";
import { computeRisk, RISK_CONFIG, shouldAlert } from "./risk";

const patient = {
  prescription_start_date: "2026-01-01",
  prescription_weeks: 4,
  weekly_target_days: 5,
  session_target_minutes: 30,
};
const log = (day: number, minutes = 30, accuracy?: number) => ({
  session_start: new Date(2026, 0, 1 + day, 18).toISOString(),
  play_minutes: minutes,
  accuracy,
});
const asOf = new Date(2026, 0, 21, 23); // day 20
const days = (n: number) => Array.from({ length: n }, (_, d) => d);

describe("risk levels", () => {
  it("주 5일 30분 사용은 정상이고 원인이 없다", () => {
    const logs = days(21).filter((d) => d % 7 < 5).map((d) => log(d));
    const r = computeRisk(patient, logs, asOf);
    expect(r.level).toBe("정상");
    expect(r.cause).toBeNull();
  });

  it("접속이 줄어 회차가 지연되면 주의", () => {
    const logs = [...days(14).filter((d) => d % 7 < 5).map((d) => log(d)), log(16), log(19)];
    const r = computeRisk(patient, logs, asOf);
    expect(r.level).toBe("주의");
  });

  it("4일 연속 미접속은 이탈 위험이고 원인은 단순 미접속", () => {
    const logs = days(17).filter((d) => d % 7 < 5).map((d) => log(d));
    const r = computeRisk(patient, logs, asOf);
    expect(r.metrics.currentGap).toBe(4);
    expect(r.level).toBe("이탈 위험");
    expect(r.cause).toBe("단순 미접속");
  });

  it("처방 기간 중 7일 연속 미접속은 치료이탈", () => {
    const logs = [log(0), log(1), log(2), log(10)];
    expect(computeRisk(patient, logs, asOf).level).toBe("치료이탈");
  });

  it("다시 접속하면 치료이탈에서 내려간다", () => {
    const logs = [log(0), log(1), log(2), log(10), log(20)];
    const r = computeRisk(patient, logs, asOf);
    expect(r.metrics.currentGap).toBe(0);
    expect(r.level).not.toBe("치료이탈");
  });

  it("점수는 단계 구간 안에 있다", () => {
    const r = computeRisk(patient, [log(0)], asOf);
    const [lo, hi] = RISK_CONFIG.bands[r.level];
    expect(r.score).toBeGreaterThanOrEqual(lo);
    expect(r.score).toBeLessThanOrEqual(hi);
  });
});

describe("점수식과 원인", () => {
  it("미접속 2일 + 회차 1회 지연 + 정확도 12%p 하락 + 짧은 세션 = 64점", () => {
    const early = [0, 1, 2, 3, 4, 7, 8, 9, 10].map((d) => log(d, 30, 90));
    const late = [11, 14, 15, 16, 18].map((d) => log(d, 15, 78));
    const r = computeRisk(patient, [...early, ...late], asOf);
    expect(r.breakdown.map((b) => b.points)).toEqual([28, 8, 18, 10]);
    expect(r.rawScore).toBe(64);
    expect(r.score).toBe(64);
    expect(r.level).toBe("이탈 위험");
    expect(r.cause).toBe("난이도 과다");
  });

  it("정확도는 높은데 세션이 짧으면 난이도 낮음", () => {
    const logs = [
      ...[0, 1, 2, 3, 4, 7, 8, 9].map((d) => log(d, 30, 90)),
      ...[14, 16, 18].map((d) => log(d, 12, 90)),
    ];
    const r = computeRisk(patient, logs, asOf);
    expect(r.metrics.shortSession).toBe(true);
    expect(r.cause).toBe("난이도 낮음");
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
    const logs = days(21).filter((d) => d % 7 < 5).map((d) => log(d));
    const r = computeRisk(patient, [...logs, log(24, 0)], new Date(2026, 0, 25, 23));
    expect(r.metrics.currentGap).toBe(6);
    expect(r.level).toBe("이탈 위험");
  });
});