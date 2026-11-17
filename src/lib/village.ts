// 조원이 만든 '스타러커스 체험 게임' 코드를 가져옴(2026-11-17, AI-DB-PROJECT-main/rumble_strip-play). 내용은 그대로.
/**
 * 마을 꾸미기 규칙(순수 함수, 테스트: village.test.ts).
 * 게임에서 모은 코인으로 빈 땅에 건물을 짓는다. 테스트 화면 전용이라 DB에 저장하지 않는다.
 */

export const BUILDINGS = [
  { id: "tree", name: "나무", cost: 1 },
  { id: "carrot", name: "당근밭", cost: 2 },
  { id: "house", name: "집", cost: 4 },
  { id: "windmill", name: "풍차", cost: 6 },
] as const;

export type BuildingId = (typeof BUILDINGS)[number]["id"];

export const PLOT_COUNT = 6;

export interface VillageState {
  coins: number;
  plots: (BuildingId | null)[];
}

export function emptyVillage(coins = 0): VillageState {
  return { coins, plots: Array.from({ length: PLOT_COUNT }, () => null) };
}

export function buildingCost(id: BuildingId) {
  return BUILDINGS.find((b) => b.id === id)!.cost;
}

/** 빈 땅에 건물을 짓는다. 코인이 모자라거나 이미 지은 땅이면 null */
export function placeBuilding(state: VillageState, plot: number, id: BuildingId): VillageState | null {
  if (plot < 0 || plot >= state.plots.length || state.plots[plot] !== null) return null;
  const cost = buildingCost(id);
  if (state.coins < cost) return null;
  const plots = [...state.plots];
  plots[plot] = id;
  return { coins: state.coins - cost, plots };
}

/** 게임 한 판에서 얻는 코인: 길에서 주운 코인 + 기억 게임에서 맞힌 수 */
export function earnedCoins(roadCoins: number, memoryHits: number) {
  return roadCoins + memoryHits;
}
