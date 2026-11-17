// 조원이 만든 '스타러커스 체험 게임' 코드를 가져옴(2026-11-17, AI-DB-PROJECT-main/rumble_strip-play). 내용은 그대로.
import { describe, expect, it } from "vitest";
import { DRIVE_CONFIG, moveLane, project, stepThings, type Thing } from "./drive";

const thing = (over: Partial<Thing>): Thing => ({ id: 1, lane: 1, depth: 0, kind: "rock", resolved: false, ...over });

describe("moveLane", () => {
  it("양 끝 차선 밖으로 나가지 않는다", () => {
    expect(moveLane(0, -1)).toBe(0);
    expect(moveLane(0, 1)).toBe(1);
    expect(moveLane(2, 1)).toBe(2);
  });
});

describe("stepThings", () => {
  const into = (DRIVE_CONFIG.hitFrom + 0.01) * DRIVE_CONFIG.travelMs; // 0에서 판정 구간 안까지 걸리는 시간

  it("같은 차선의 장애물에 부딪히면 한 번만 센다", () => {
    const a = stepThings([thing({})], into, 1);
    expect(a.crashed).toBe(1);
    const b = stepThings(a.things, 10, 1);
    expect(b.crashed).toBe(0);
  });

  it("다른 차선이면 부딪히지 않는다", () => {
    expect(stepThings([thing({ lane: 0 })], into, 1).crashed).toBe(0);
  });

  it("무적 시간에는 장애물을 그냥 지나친다", () => {
    expect(stepThings([thing({})], into, 1, true).crashed).toBe(0);
  });

  it("코인은 줍고 화면에서 사라진다", () => {
    const r = stepThings([thing({ kind: "coin" })], into, 1);
    expect(r.coins).toBe(1);
    expect(r.things).toHaveLength(0);
  });

  it("화면 밖으로 나간 물체는 지운다", () => {
    expect(stepThings([thing({ lane: 0, depth: 1.14 })], 100, 1).things).toHaveLength(0);
  });
});

describe("project", () => {
  it("가까울수록 아래에 있고 크다", () => {
    const far = project(0.2, 1);
    const near = project(0.9, 1);
    expect(near.y).toBeGreaterThan(far.y);
    expect(near.scale).toBeGreaterThan(far.scale);
  });

  it("가운데 차선은 화면 가운데, 양옆은 대칭", () => {
    expect(project(0.5, 1).x).toBe(50);
    expect(project(0.5, 0).x + project(0.5, 2).x).toBeCloseTo(100);
  });
});
