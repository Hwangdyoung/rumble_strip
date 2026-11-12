import { describe, expect, it } from "vitest";
import { buildContactList, contactSummary, matchFilter, type ContactInput } from "./contact-list";
import type { RiskLevel, RiskResult } from "./risk";

const now = new Date(2026, 10, 12, 15);
const risk = (level: RiskLevel, score: number, reason = "이유"): RiskResult => ({ level, score, reasons: [reason] }) as unknown as RiskResult;
const pat = (id: string, level: RiskLevel, score: number) => ({ id, name: "환자" + id, age: 9, risk: risk(level, score) });
const base: ContactInput = { patients: [], threshold: 55, alerts: [], followUps: [], lastActionAt: {}, contactOf: {}, now };
const iso = (d: number, h = 9) => new Date(2026, 10, d, h).toISOString();

describe("buildContactList", () => {
  it("기준 이상인 위험 환자는 알림이 없어도 모두 들어간다 (정상 제외)", () => {
    const rows = buildContactList({ ...base, patients: [pat("1", "이탈 위험", 79), pat("2", "이탈 위험", 60), pat("3", "주의", 40), pat("4", "정상", 10)] });
    expect(rows.map((r) => r.patientId)).toEqual(["1", "2"]);
  });

  it("새로 나빠짐과 오늘 다시 연락은 기준 아래여도 들어간다", () => {
    const rows = buildContactList({
      ...base,
      patients: [pat("1", "주의", 40), pat("2", "주의", 35)],
      alerts: [{ id: "a", patient_id: "1", created_at: iso(12), status: "미확인", outcome: "미정", outcome_at: null }],
      followUps: [{ patient_id: "2", due_date: "2026-11-11" }],
    });
    const byId = Object.fromEntries(rows.map((r) => [r.patientId, r]));
    expect(byId["1"]?.newWorseAt).toBe(iso(12));
    expect(byId["2"]?.status).toBe("다시 연락");
    expect(byId["2"]?.followDue?.overdueDays).toBe(1);
  });

  it("상태: 연락 전 → 연락함 → 연락 예정, 연락 불가", () => {
    const rows = buildContactList({
      ...base,
      patients: [pat("1", "이탈 위험", 70), pat("2", "이탈 위험", 70), pat("3", "이탈 위험", 70), pat("4", "이탈 위험", 70)],
      alerts: [
        { id: "a", patient_id: "4", created_at: iso(10), status: "조치완료", outcome: "연락 불가", outcome_at: iso(11) },
      ],
      followUps: [{ patient_id: "3", due_date: "2026-11-14" }],
      lastActionAt: { "2": iso(12, 10), "3": iso(12, 10), "4": iso(10, 12) },
    });
    const st = Object.fromEntries(rows.map((r) => [r.patientId, r.status]));
    expect(st).toEqual({ "1": "연락 전", "2": "연락함", "3": "연락 예정", "4": "연락 불가" });
  });

  it("손이 가야 하는 줄이 먼저, 그 안에서 새로 나빠짐·단계·점수 순", () => {
    const rows = buildContactList({
      ...base,
      patients: [pat("1", "이탈 위험", 79), pat("2", "치료이탈", 85), pat("3", "이탈 위험", 60), pat("4", "이탈 위험", 90)],
      alerts: [{ id: "a", patient_id: "3", created_at: iso(12), status: "미확인", outcome: "미정", outcome_at: null }],
      lastActionAt: { "4": iso(12, 10) },
    });
    expect(rows.map((r) => r.patientId)).toEqual(["3", "2", "1", "4"]);
  });

  it("전체 보기면 정상 환자도 '경과 관찰'로 맨 뒤에", () => {
    const rows = buildContactList({ ...base, includeAll: true, patients: [pat("1", "정상", 10), pat("2", "이탈 위험", 70)] });
    expect(rows.map((r) => [r.patientId, r.status, r.inToday])).toEqual([["2", "연락 전", true], ["1", "경과 관찰", false]]);
  });

  it("요약 숫자와 걸러 보기", () => {
    const rows = buildContactList({
      ...base,
      includeAll: true,
      patients: [pat("1", "이탈 위험", 70), pat("2", "주의", 40), pat("3", "정상", 5)],
      alerts: [{ id: "a", patient_id: "1", created_at: iso(12), status: "미확인", outcome: "미정", outcome_at: null }],
      followUps: [{ patient_id: "2", due_date: "2026-11-12" }],
      contactOf: { "2": "s1" },
    });
    expect(contactSummary(rows)).toEqual({ new: 1, todo: 1, follow: 1, unassigned: 1 });
    expect(rows.filter((r) => matchFilter(r, "unassigned")).map((r) => r.patientId)).toEqual(["1", "3"]);
  });

  it("연락 담당을 붙인다", () => {
    const rows = buildContactList({ ...base, patients: [pat("1", "이탈 위험", 70)], contactOf: { "1": "s1" } });
    expect(rows[0]?.contactId).toBe("s1");
  });
});
