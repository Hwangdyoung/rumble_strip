// 조원이 만든 '스타러커스 체험 게임' 코드를 가져옴(2026-11-17, AI-DB-PROJECT-main/rumble_strip-play). 내용은 그대로.
import { describe, expect, it } from "vitest";
import {
  GAME_CONFIG,
  judge,
  makeBlock,
  prescriptionProgress,
  seededRandom,
  summarize,
  toPlayLog,
  toPlayMinutes,
  type Response,
} from "./game";

describe("makeBlock", () => {
  it("처음 N개는 채점하지 않고 정답이 될 수 없다", () => {
    const block = makeBlock(2, seededRandom(1));
    expect(block).toHaveLength(GAME_CONFIG.trialsPerBlock);
    expect(block.slice(0, 2).every((t) => !t.scored && !t.isTarget)).toBe(true);
  });

  it("정답 문항은 N개 전 그림과 같고, 아닌 문항은 다르다", () => {
    for (const n of [1, 2] as const) {
      const block = makeBlock(n, seededRandom(7), 200);
      block.forEach((t, i) => {
        if (i < n) return;
        if (t.isTarget) expect(t.symbol).toBe(block[i - n]!.symbol);
        else expect(t.symbol).not.toBe(block[i - n]!.symbol);
      });
    }
  });

  it("정답 비율이 설정값 근처다", () => {
    const block = makeBlock(1, seededRandom(3), 2000);
    const rate = block.filter((t) => t.isTarget).length / block.filter((t) => t.scored).length;
    expect(rate).toBeGreaterThan(GAME_CONFIG.targetRate - 0.05);
    expect(rate).toBeLessThan(GAME_CONFIG.targetRate + 0.05);
  });
});

describe("judge / summarize", () => {
  it("네 가지 판정을 구분한다", () => {
    const t = { symbol: "star" as const, isTarget: true, scored: true };
    const f = { symbol: "moon" as const, isTarget: false, scored: true };
    expect(judge(t, 500)).toBe("hit");
    expect(judge(t, null)).toBe("miss");
    expect(judge(f, 400)).toBe("falseAlarm");
    expect(judge(f, null)).toBe("correctReject");
    expect(judge({ ...t, scored: false }, 300)).toBeNull();
  });

  it("정확도와 평균 반응 시간을 계산한다", () => {
    const rs: Response[] = [
      { outcome: "hit", rtMs: 600 },
      { outcome: "hit", rtMs: 800 },
      { outcome: "miss", rtMs: null },
      { outcome: "correctReject", rtMs: null },
      { outcome: "falseAlarm", rtMs: 300 },
    ];
    const s = summarize(rs);
    expect(s.accuracy).toBe(60);
    expect(s.reactionMs).toBe(700); // 오답으로 누른 300ms는 평균에 넣지 않음
    expect(s.falseAlarms).toBe(1);
  });

  it("채점 문항이 없으면 정확도·반응 시간이 없다", () => {
    expect(summarize([])).toMatchObject({ accuracy: null, reactionMs: null, scoredTrials: 0 });
  });
});

describe("toPlayLog", () => {
  const base = {
    patientId: "p1",
    startedAt: new Date("2026-11-12T09:00:00Z"),
    endedAt: new Date("2026-11-12T09:03:00Z"),
    activeMs: 150_000,
    blocksCompleted: 2,
    endedEarly: false,
  };

  it("세션 결과를 play_logs 한 줄로 바꾼다", () => {
    const row = toPlayLog({ ...base, summary: summarize([{ outcome: "hit", rtMs: 650 }, { outcome: "correctReject", rtMs: null }]) });
    expect(row).toEqual({
      patient_id: "p1",
      session_start: "2026-11-12T09:00:00.000Z",
      session_end: "2026-11-12T09:03:00.000Z",
      play_minutes: 3,
      tasks_completed: 2,
      ended_early: false,
      accuracy: 100,
      reaction_ms: 650,
    });
  });

  it("채점한 문항이 없으면 저장하지 않는다", () => {
    expect(toPlayLog({ ...base, summary: summarize([]) })).toBeNull();
  });

  it("1분 미만도 1분으로 남긴다", () => {
    expect(toPlayMinutes(20_000)).toBe(1);
    expect(toPlayMinutes(29 * 60_000 + 40_000)).toBe(30);
  });
});

describe("prescriptionProgress", () => {
  const patient = { prescription_start_date: "2026-11-02", prescription_weeks: 4, weekly_target_days: 5 };

  it("처방 일차와 이번 주 플레이 일수를 센다", () => {
    const p = prescriptionProgress(patient, ["2026-11-09", "2026-11-10", "2026-11-10", "2026-11-05"], new Date(2026, 10, 12));
    expect(p).toMatchObject({ dayNumber: 11, weekNumber: 2, playedThisWeek: 2, status: "active", playedToday: false });
  });

  it("처방 전·후를 구분한다", () => {
    expect(prescriptionProgress(patient, [], new Date(2026, 10, 1)).status).toBe("before");
    expect(prescriptionProgress(patient, [], new Date(2026, 10, 30)).status).toBe("ended");
  });
});
