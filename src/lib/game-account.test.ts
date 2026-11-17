import { describe, expect, it } from "vitest";
import { checkGameLogin, checkNewGamePatient, checkPlayRow, hashGamePin, hashGameToken, newGameToken } from "./game-account";

describe("checkNewGamePatient", () => {
  it("올바른 입력을 정리한다", () => {
    expect(checkNewGamePatient({ nickname: "  별빛  탐험가 ", age: "9", loginId: "Star01", pin: "1234", pinConfirm: "1234" })).toEqual({
      ok: true,
      value: { nickname: "별빛 탐험가", age: 9, loginId: "star01", pin: "1234" },
    });
  });
  it("별명·나이·아이디·숫자를 각각 확인한다", () => {
    const r = checkNewGamePatient({ nickname: "", age: 20, loginId: "a!", pin: "12a4" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(4);
  });
  it("숫자 4자리 확인이 다르면 알려 준다", () => {
    const r = checkNewGamePatient({ nickname: "하늘", age: 8, loginId: "sky01", pin: "1234", pinConfirm: "4321" });
    expect(r.ok).toBe(false);
  });
});

describe("checkGameLogin", () => {
  it("아이디는 소문자로, 숫자는 4자리만", () => {
    expect(checkGameLogin({ loginId: "SKY01", pin: "0007" })).toEqual({ ok: true, value: { loginId: "sky01", pin: "0007" } });
    expect(checkGameLogin({ loginId: "sky01", pin: "12345" }).ok).toBe(false);
  });
});

describe("checkPlayRow", () => {
  const now = new Date("2026-11-17T09:00:00Z");
  const ok = {
    session_start: "2026-11-17T08:58:00Z",
    session_end: "2026-11-17T08:59:30Z",
    play_minutes: 2,
    tasks_completed: 1,
    ended_early: false,
    accuracy: 85.5,
    reaction_ms: 640,
  };
  it("정상 기록은 정리해서 돌려준다", () => {
    expect(checkPlayRow(ok, now)).toEqual({ ...ok, accuracy: 86, crashes: null, coins: null, session_start: "2026-11-17T08:58:00.000Z", session_end: "2026-11-17T08:59:30.000Z" });
  });
  it("부딪힘·코인은 0 이상 정수만 받는다", () => {
    expect(checkPlayRow({ ...ok, crashes: 6, coins: 17 }, now)).toMatchObject({ crashes: 6, coins: 17 });
    expect(checkPlayRow({ ...ok, crashes: -1 }, now)).toBeNull();
    expect(checkPlayRow({ ...ok, coins: 2.5 }, now)).toBeNull();
  });
  it("미래 시각·너무 오래전·끝이 시작보다 앞·범위 밖 값은 거절", () => {
    expect(checkPlayRow({ ...ok, session_end: "2026-11-17T09:05:00Z" }, now)).toBeNull();
    expect(checkPlayRow({ ...ok, session_start: "2026-11-17T04:00:00Z" }, now)).toBeNull();
    expect(checkPlayRow({ ...ok, session_end: "2026-11-17T08:57:00Z" }, now)).toBeNull();
    expect(checkPlayRow({ ...ok, play_minutes: 0 }, now)).toBeNull();
    expect(checkPlayRow({ ...ok, play_minutes: 61 }, now)).toBeNull();
    expect(checkPlayRow({ ...ok, accuracy: 120 }, now)).toBeNull();
    expect(checkPlayRow({ ...ok, reaction_ms: 1.5 }, now)).toBeNull();
    expect(checkPlayRow("x", now)).toBeNull();
  });
  it("정확도는 DB 칸(integer)에 맞게 반올림한다", () => {
    expect(checkPlayRow({ ...ok, accuracy: 68.4 }, now)?.accuracy).toBe(68);
  });
  it("정확도·반응 시간은 비어 있어도 된다", () => {
    expect(checkPlayRow({ ...ok, accuracy: null, reaction_ms: null }, now)?.accuracy).toBeNull();
  });
});

describe("해시와 접속 표시", () => {
  it("같은 숫자라도 환자가 다르면 해시가 다르다", async () => {
    expect(await hashGamePin("1234", "p1")).not.toBe(await hashGamePin("1234", "p2"));
    expect(await hashGamePin("1234", "p1")).toBe(await hashGamePin(" 1234 ", "p1"));
  });
  it("접속 표시는 64글자이고 매번 다르다", async () => {
    const a = newGameToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(newGameToken()).not.toBe(a);
    expect(await hashGameToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
