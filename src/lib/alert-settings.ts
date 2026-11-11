/**
 * 알림 기준(알림 기준 점수, 하루 처리 가능 인원). 이 브라우저에만 저장된다.
 * 대시보드는 읽기만 하고, 설정 화면에서 바꾼다.
 */
import { useEffect, useState } from "react";

const SETTINGS_KEY = "rumble-strip:alert-settings";
export const MAX_CAPACITY = 8; // 예시 환자 수 기준 (실제 서비스에서는 의료진이 하루에 연락 가능한 인원)
export const DEFAULT_THRESHOLD = 55;
export const DEFAULT_CAPACITY = 5;

export const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

export function useAlertSettings() {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const v = JSON.parse(raw) as { threshold?: number; capacity?: number };
        if (typeof v.threshold === "number") setThreshold(clampInt(v.threshold, 0, 100));
        if (typeof v.capacity === "number") setCapacity(clampInt(v.capacity, 1, MAX_CAPACITY));
      }
    } catch {
      /* 저장값을 읽지 못하면 기본값 사용 */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ threshold, capacity }));
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [threshold, capacity, loaded]);

  return {
    threshold,
    capacity,
    setThreshold: (v: number) => setThreshold(clampInt(v, 0, 100)),
    setCapacity: (v: number) => setCapacity(clampInt(v, 1, MAX_CAPACITY)),
  };
}
