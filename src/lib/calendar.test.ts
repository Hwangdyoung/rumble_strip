import { describe, expect, it } from "vitest";
import { buildMonth, playIntensity, prescriptionEndKey, riskOnDay, weekProgress, type CalendarLog } from "./calendar";

const patient = {
  prescription_start_date: "2026-10-05", // 월요일
  prescription_weeks: 4,
  weekly_target_days: 5,
  session_target_minutes: 30,
};

const log = (date: string, minutes: number): CalendarLog => ({
  session_start: `${date}T18:00:00`,
  play_minutes: minutes,
  tasks_completed: 5,
  ended_early: false,
});

describe("play calendar", () => {
  it("marks days inside the prescription window and dims days outside it", () => {
    expect(prescriptionEndKey(patient)).toBe("2026-11-01"); // 4주 = 10/05~11/01
    const cells = buildMonth(patient, [], new Set(), new Set(), 2026, 9, "2026-10-20").filter(Boolean);
    const byKey = new Map(cells.map((c) => [c!.key, c!]));
    expect(byKey.get("2026-10-04")!.inWindow).toBe(false); // 시작 전
    expect(byKey.get("2026-10-05")!.inWindow).toBe(true); // 시작일
    expect(byKey.get("2026-11-01")!.inWindow).toBe(true); // 마지막 날
  });

  it("sums played minutes per day and flags missed in-window days", () => {
    const logs = [log("2026-10-06", 20), log("2026-10-06", 15)];
    const cells = buildMonth(patient, logs, new Set(), new Set(), 2026, 9, "2026-10-20").filter(Boolean);
    const byKey = new Map(cells.map((c) => [c!.key, c!]));
    expect(byKey.get("2026-10-06")!.minutes).toBe(35);
    expect(byKey.get("2026-10-06")!.sessions).toBe(2);
    const missed = byKey.get("2026-10-07")!;
    expect(missed.inWindow).toBe(true);
    expect(missed.minutes).toBe(0); // 미접속
  });

  it("marks action and alert days and today", () => {
    const cells = buildMonth(patient, [], new Set(["2026-10-08"]), new Set(["2026-10-09"]), 2026, 9, "2026-10-09").filter(Boolean);
    const byKey = new Map(cells.map((c) => [c!.key, c!]));
    expect(byKey.get("2026-10-08")!.hasAction).toBe(true);
    expect(byKey.get("2026-10-09")!.hasAlert).toBe(true);
    expect(byKey.get("2026-10-09")!.isToday).toBe(true);
    expect(byKey.get("2026-10-10")!.isFuture).toBe(true);
  });

  it("counts distinct played days in the current week against the 5-day target", () => {
    const now = new Date(2026, 9, 21); // 2026-10-21 수요일
    const logs = [log("2026-10-19", 30), log("2026-10-19", 10), log("2026-10-21", 30), log("2026-10-12", 30)];
    const p = weekProgress(logs, patient.weekly_target_days, now);
    expect(p.days).toBe(2); // 월·수 (같은 날 두 세션은 1일)
    expect(p.target).toBe(5);
  });

  it("scales teal intensity with minutes and caps at the target", () => {
    expect(playIntensity(0, 30)).toBe(0);
    expect(playIntensity(30, 30)).toBe(1);
    expect(playIntensity(60, 30)).toBe(1);
    expect(playIntensity(15, 30)).toBeCloseTo(0.625);
  });

  it("computes the risk score for a specific day from logs up to that day", () => {
    const logs = [log("2026-10-05", 30), log("2026-10-06", 30)];
    const early = riskOnDay(patient, logs, "2026-10-06");
    const late = riskOnDay(patient, logs, "2026-10-20");
    expect(late.score).toBeGreaterThan(early.score); // 공백이 길어지면 점수 상승
  });
});
