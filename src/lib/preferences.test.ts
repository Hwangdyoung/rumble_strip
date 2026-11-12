import { beforeEach, describe, expect, it, vi } from "vitest";

async function fresh() {
  vi.resetModules();
  return import("./preferences");
}

// 이 환경(Node 25)에서는 기본 localStorage가 불완전해서, 간단한 메모리 저장소로 바꿔 끼운다
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

describe("글자 크기 설정", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    Object.defineProperty(window, "localStorage", { value: globalThis.localStorage, configurable: true });
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  });

  it("예전 '글자 크게 보기'를 켰던 사람은 110%로 이어 받는다", async () => {
    window.localStorage.setItem("rumble-strip:prefs", JSON.stringify({ largeText: true }));
    const m = await fresh();
    m.setPreferences({});
    expect(JSON.parse(window.localStorage.getItem("rumble-strip:prefs")!).textScale).toBe(110);
  });

  it("범위를 벗어나거나 단위가 안 맞으면 가까운 값으로 맞춘다", async () => {
    const m = await fresh();
    m.setPreferences({ textScale: 300 });
    expect(JSON.parse(window.localStorage.getItem("rumble-strip:prefs")!).textScale).toBe(150);
    m.setPreferences({ textScale: 103 });
    expect(JSON.parse(window.localStorage.getItem("rumble-strip:prefs")!).textScale).toBe(105);
  });

  it("html 글자 크기에 바로 적용된다", async () => {
    const m = await fresh();
    m.setPreferences({ textScale: 125 });
    expect(document.documentElement.style.fontSize).toBe("125%");
    m.setPreferences({ textScale: 100 });
    expect(document.documentElement.style.fontSize).toBe("");
  });
});
