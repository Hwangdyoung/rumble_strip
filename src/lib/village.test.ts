// 조원이 만든 '스타러커스 체험 게임' 코드를 가져옴(2026-11-17, AI-DB-PROJECT-main/rumble_strip-play). 내용은 그대로.
import { describe, expect, it } from "vitest";
import { earnedCoins, emptyVillage, placeBuilding, PLOT_COUNT } from "./village";

describe("placeBuilding", () => {
  it("코인을 내고 빈 땅에 짓는다", () => {
    const v = placeBuilding(emptyVillage(5), 0, "house");
    expect(v).toEqual({ coins: 1, plots: ["house", ...Array(PLOT_COUNT - 1).fill(null)] });
  });

  it("코인이 모자라면 못 짓는다", () => {
    expect(placeBuilding(emptyVillage(3), 0, "house")).toBeNull();
  });

  it("이미 지은 땅이나 없는 땅에는 못 짓는다", () => {
    const v = placeBuilding(emptyVillage(10), 2, "tree")!;
    expect(placeBuilding(v, 2, "tree")).toBeNull();
    expect(placeBuilding(v, PLOT_COUNT, "tree")).toBeNull();
  });
});

it("얻는 코인 = 주운 코인 + 기억 게임 맞힘 수", () => {
  expect(earnedCoins(4, 3)).toBe(7);
});
