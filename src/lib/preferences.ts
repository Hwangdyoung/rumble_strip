/**
 * 화면·업무 개인 설정 (이 브라우저에만 저장).
 * 설정 화면에서 바꾸면 같은 화면의 다른 컴포넌트에도 바로 반영된다(useSyncExternalStore).
 * 알림 기준 점수·처리 가능 인원은 기존 저장 위치를 그대로 쓰려고 alert-settings.ts에 따로 둔다.
 */
import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
export type FirstTab = "last" | "alerts" | "contact" | "outcomes";
export type DefaultFilter = "전체" | "알림 대상";

export interface Preferences {
  theme: ThemePref;
  /** 글자 크기 (%, 100 = 기본) */
  textScale: number;
  reduceMotion: boolean;
  /** 알림 후 며칠이 지나면 '지연'으로 볼지 */
  overdueDays: number;
  /** 대시보드 '오늘 업무' 첫 탭 ('last' = 마지막에 본 탭) */
  firstTab: FirstTab;
  /** 대시보드 환자 목록 기본 필터 */
  defaultFilter: DefaultFilter;
  /** 내가 하루에 처리할 수 있는 알림 수 (넘으면 경고만) */
  myAlertCapacity: number;
  /** '처리할 알림' 정렬 */
  alertSort: "oldest" | "score";
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  textScale: 100,
  reduceMotion: false,
  overdueDays: 2,
  firstTab: "last",
  defaultFilter: "전체",
  myAlertCapacity: 5,
  alertSort: "oldest",
};

export const PREFS_KEY = "rumble-strip:prefs";
export const TEXT_SCALE_MIN = 80;
export const TEXT_SCALE_MAX = 150;
export const TEXT_SCALE_STEP = 5;
const clampScale = (v: number) =>
  Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, Math.round(v / TEXT_SCALE_STEP) * TEXT_SCALE_STEP));
const listeners = new Set<() => void>();
let cache: Preferences | null = null;

function read(): Preferences {
  if (cache) return cache;
  let v: Partial<Preferences> & { largeText?: boolean } = {};
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(PREFS_KEY) : null;
    if (raw) v = JSON.parse(raw) as Partial<Preferences>;
  } catch {
    /* 못 읽으면 기본값 */
  }
  cache = {
    theme: v.theme === "light" || v.theme === "dark" ? v.theme : "system",
    // 예전 '글자 크게 보기'(켜기/끄기)를 쓰던 사람은 110%로 이어 받는다
    textScale: typeof v.textScale === "number" ? clampScale(v.textScale) : v.largeText === true ? 110 : 100,
    reduceMotion: v.reduceMotion === true,
    overdueDays: Number.isInteger(v.overdueDays) && v.overdueDays! >= 1 && v.overdueDays! <= 7 ? v.overdueDays! : 2,
    firstTab: (["last", "alerts", "contact", "outcomes"] as const).includes(v.firstTab as FirstTab) ? (v.firstTab as FirstTab) : "last",
    defaultFilter: v.defaultFilter === "알림 대상" ? "알림 대상" : "전체",
    myAlertCapacity: Number.isInteger(v.myAlertCapacity) && v.myAlertCapacity! >= 1 && v.myAlertCapacity! <= 50 ? v.myAlertCapacity! : 5,
    alertSort: v.alertSort === "score" ? "score" : "oldest",
  };
  return cache;
}

export function setPreferences(patch: Partial<Preferences>) {
  cache = { ...read(), ...patch };
  cache.textScale = clampScale(cache.textScale);
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(cache));
  } catch {
    /* 저장 실패는 무시 (이번 화면에서는 반영됨) */
  }
  applyPreferences(cache);
  listeners.forEach((l) => l());
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => DEFAULT_PREFERENCES,
  );
}

/** html 요소에 다크 모드·글자 크기·움직임 설정을 적용한다 */
export function applyPreferences(p: Preferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = p.theme === "dark" || (p.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  // rem 단위(대부분의 글자·간격)와 본문 기본 글자(styles.css의 --text-scale)를 함께 키운다
  root.style.fontSize = p.textScale === 100 ? "" : `${p.textScale}%`;
  root.style.setProperty("--text-scale", String(p.textScale / 100));
  if (p.reduceMotion) root.dataset["motion"] = "reduce";
  else delete root.dataset["motion"];
}

/** 시스템 다크 모드가 바뀌면 '시스템 따라감' 설정일 때 다시 적용 */
export function watchSystemTheme() {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const on = () => applyPreferences(read());
  mq.addEventListener("change", on);
  return () => mq.removeEventListener("change", on);
}

/**
 * 첫 화면이 그려지기 전에 실행할 스크립트(깜빡임 방지). __root.tsx의 <head>에 넣는다.
 * 위 applyPreferences와 같은 규칙이다.
 */
export const PREFS_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}");var r=document.documentElement;var d=p.theme==="dark"||(p.theme!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)r.classList.add("dark");r.style.colorScheme=d?"dark":"light";var t=typeof p.textScale==="number"?p.textScale:(p.largeText===true?110:100);t=Math.min(${TEXT_SCALE_MAX},Math.max(${TEXT_SCALE_MIN},t));if(t!==100)r.style.fontSize=t+"%";r.style.setProperty("--text-scale",String(t/100));if(p.reduceMotion===true)r.dataset.motion="reduce";}catch(e){}})();`;
