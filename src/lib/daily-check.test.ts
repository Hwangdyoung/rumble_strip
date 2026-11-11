import { describe, expect, it } from "vitest";
import { isAuthorizedCron, koreaNow, planDailyCheck, prescriptionStatus, type StoredScore } from "./daily-check";

const patient = {
  id: "p1",
  name: "가상환자",
  prescription_start_date: "2026-01-01",
  prescription_weeks: 4,
  weekly_target_days: 5,
  session_target_minutes: 30,
};
const log = (day: number, minutes = 30) => ({
  patient_id: "p1",
  session_start: new Date(2026, 0, 1 + day, 18).toISOString(),
  play_minutes: minutes,
});
const steady = (until: number) => Array.from({ length: until + 1 }, (_, d) => d).filter((d) => d % 7 < 5).map((d) => log(d));
const now = (day: number) => new Date(2026, 0, 1 + day, 9);
const stored = (score: number, level: string, extra: Partial<StoredScore> = {}): StoredScore => ({
  patient_id: "p1",
  score,
  level,
  calculated_at: new Date(2026, 0, 15).toISOString(),
  source: "daily",
  check_date: "2026-01-15",
  ...extra,
});

describe("prescriptionStatus", () => {
  it("처방 시작 전·처방 중·처방 종료를 구분한다", () => {
    expect(prescriptionStatus(patient, new Date(2025, 11, 31))).toBe("처방 시작 전");
    expect(prescriptionStatus(patient, now(0))).toBe("처방 중");
    expect(prescriptionStatus(patient, now(27))).toBe("처방 중");
    expect(prescriptionStatus(patient, now(28))).toBe("처방 종료");
  });
});

describe("planDailyCheck", () => {
  it("마지막 점검이 정상이었는데 오래 미접속해 이탈 위험 이상이 되면 알림", () => {
    const plan = planDailyCheck({ patients: [patient], logs: steady(10), stored: [stored(10, "정상")], now: now(16) });
    const item = plan.items[0]!;
    expect(item.beforeFrom).toBe("stored");
    expect(["이탈 위험", "치료이탈"]).toContain(item.after.level);
    expect(item.alertMessage).not.toBeNull();
  });

  it("꾸준히 하고 있으면 기록만 하고 알림은 없다", () => {
    const plan = planDailyCheck({ patients: [patient], logs: steady(16), stored: [stored(0, "정상")], now: now(16) });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.alertMessage).toBeNull();
  });

  it("이미 높은 단계로 저장돼 있으면 같은 이유로 다시 알리지 않는다", () => {
    const plan = planDailyCheck({ patients: [patient], logs: steady(10), stored: [stored(100, "치료이탈")], now: now(18) });
    expect(plan.items[0]!.alertMessage).toBeNull();
  });

  it("저장 기록이 없으면 어제 기준 점수와 비교한다", () => {
    const plan = planDailyCheck({ patients: [patient], logs: steady(16), stored: [], now: now(16) });
    expect(plan.items[0]!.beforeFrom).toBe("yesterday");
  });

  it("오늘 이미 점검한 환자와 처방이 끝난 환자는 건너뛴다", () => {
    const today = planDailyCheck({
      patients: [patient],
      logs: steady(16),
      stored: [stored(0, "정상", { check_date: "2026-01-17" })],
      now: now(16),
    });
    expect(today.items).toHaveLength(0);
    expect(today.skipped).toEqual([{ patientId: "p1", reason: "오늘 점검 완료" }]);

    const ended = planDailyCheck({ patients: [patient], logs: steady(10), stored: [], now: now(40) });
    expect(ended.items).toHaveLength(0);
    expect(ended.skipped[0]!.reason).toBe("처방 종료");
  });

  it("시뮬레이터 등으로 생긴 'record' 기록은 오늘 점검으로 치지 않는다", () => {
    const plan = planDailyCheck({
      patients: [patient],
      logs: steady(16),
      stored: [stored(0, "정상", { source: "record", check_date: null, calculated_at: new Date(2026, 0, 17, 8).toISOString() })],
      now: now(16),
    });
    expect(plan.items).toHaveLength(1);
  });
});

describe("koreaNow", () => {
  it("UTC 기준 시각을 한국 날짜·시간으로 바꾼다", () => {
    // 2026-01-14 23:30 UTC = 2026-01-15 08:30 KST
    const k = koreaNow(new Date(Date.UTC(2026, 0, 14, 23, 30)));
    expect([k.getFullYear(), k.getMonth() + 1, k.getDate(), k.getHours(), k.getMinutes()]).toEqual([2026, 1, 15, 8, 30]);
  });
});

describe("isAuthorizedCron", () => {
  it("Bearer + 비밀 값이 정확히 같을 때만 통과", () => {
    expect(isAuthorizedCron("Bearer abc1234567890xyz", "abc1234567890xyz")).toBe(true);
    expect(isAuthorizedCron("Bearer wrong", "abc1234567890xyz")).toBe(false);
    expect(isAuthorizedCron("abc1234567890xyz", "abc1234567890xyz")).toBe(false);
    expect(isAuthorizedCron(null, "abc1234567890xyz")).toBe(false);
  });

  it("비밀 값이 설정되지 않았으면 항상 거부", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
  });
});
