// 조원이 만든 '스타러커스 체험 게임' 코드를 가져옴(2026-11-17, AI-DB-PROJECT-main/rumble_strip-play). 내용은 그대로.
/**
 * 달리기(피하기) 게임 규칙. 화면·시간과 무관한 순수 함수만 둔다(테스트: drive.test.ts).
 * 길은 3차선이고, 물체는 지평선(depth 0)에서 화면 아래(depth 1)로 다가온다.
 * 기억 게임(N-back) 채점은 game.ts가 맡는다. 부딪힘·코인 수는 화면에만 쓰고 DB에는 넣지 않는다.
 */

export const DRIVE_CONFIG = {
  lanes: 3,
  /** 물체가 지평선에서 화면 아래까지 오는 데 걸리는 시간(ms) */
  travelMs: 2200,
  /** 새 물체가 나오는 간격(ms) */
  spawnEveryMs: 1000,
  /** 새 물체가 코인일 확률(나머지는 장애물) */
  coinRate: 0.4,
  /** 내 차가 있는 깊이, 부딪힘 판정 구간 */
  playerDepth: 0.82,
  hitFrom: 0.76,
  hitTo: 0.89,
  /** 부딪힌 뒤 잠깐 무적인 시간(ms) */
  invulnerableMs: 700,
  /** 지평선 높이(화면 위에서 %) */
  horizon: 30,
};

export type Lane = 0 | 1 | 2;
export type ThingKind = "rock" | "coin";

export interface Thing {
  id: number;
  lane: Lane;
  depth: number;
  kind: ThingKind;
  /** 이미 부딪혔거나 주운 물체 */
  resolved: boolean;
}

export function moveLane(lane: Lane, dir: -1 | 1): Lane {
  return Math.min(DRIVE_CONFIG.lanes - 1, Math.max(0, lane + dir)) as Lane;
}

export function spawnThing(id: number, rand: () => number = Math.random): Thing {
  return {
    id,
    lane: Math.floor(rand() * DRIVE_CONFIG.lanes) as Lane,
    depth: 0,
    kind: rand() < DRIVE_CONFIG.coinRate ? "coin" : "rock",
    resolved: false,
  };
}

/**
 * dtMs만큼 물체를 앞으로 움직이고, 내 차와 같은 차선에서 판정 구간에 들어온 물체를 처리한다.
 * 무적 시간(invulnerable)에는 장애물에 부딪히지 않는다. 코인은 항상 주울 수 있다.
 */
export function stepThings(things: Thing[], dtMs: number, playerLane: Lane, invulnerable = false) {
  let crashed = 0;
  let coins = 0;
  const next: Thing[] = [];
  for (const t of things) {
    const moved = { ...t, depth: t.depth + dtMs / DRIVE_CONFIG.travelMs };
    const inZone = moved.depth >= DRIVE_CONFIG.hitFrom && moved.depth <= DRIVE_CONFIG.hitTo;
    if (!moved.resolved && inZone && moved.lane === playerLane) {
      if (moved.kind === "coin") {
        coins += 1;
        moved.resolved = true;
      } else if (!invulnerable) {
        crashed += 1;
        moved.resolved = true;
      }
    }
    if (moved.depth <= 1.15 && !(moved.resolved && moved.kind === "coin")) next.push(moved);
  }
  return { things: next, crashed, coins };
}

/**
 * 깊이·차선을 화면 위치(%)로. 가까울수록 크고 아래에 있다(원근 흉내).
 * x, y는 화면 너비·높이 기준 %, scale은 0~1.
 */
export function project(depth: number, lane: number) {
  const t = Math.pow(Math.min(Math.max(depth, 0), 1.15), 1.8);
  const halfWidth = 6 + 44 * t;
  return {
    x: 50 + (lane - 1) * halfWidth * 0.66,
    y: DRIVE_CONFIG.horizon + (100 - DRIVE_CONFIG.horizon) * t,
    scale: 0.12 + 0.88 * t,
  };
}
