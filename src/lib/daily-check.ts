/**
 * 매일 점검 — 무엇을 저장하고 어떤 알림을 만들지 정하는 순수 함수
 *
 * 점수 계산은 하지 않고 risk.ts(computeRisk, shouldAlert, alertMessage)를 부르기만 합니다.
 * DB 조회·저장은 queries.ts의 runDailyCheck가 맡습니다.
 * 나중에 서버 예약 작업(배포 후)도 같은 함수를 쓰면 됩니다.
 */

import {
  alertMessage,
  asOfFor,
  computeRisk,
  shouldAlert,
  toDateKey,
  type PatientLike,
  type PlayLogLike,
  type RiskLevel,
  type RiskResult,
} from "./risk";

const DAY = 86_400_000;

export interface DailyCheckPatient extends PatientLike {
  id: string;
  name: string;
}

/** risk_scores의 기존 기록 (점검·기록 구분 포함) */
export interface StoredScore {
  patient_id: string;
  score: number;
  level: string;
  calculated_at: string;
  source: string;
  check_date: string | null;
}

export type SkipReason = "처방 시작 전" | "처방 종료" | "오늘 점검 완료";

export interface DailyCheckItem {
  patientId: string;
  before: { score: number; level: RiskLevel };
  /** 비교 대상: 마지막 저장 기록이면 'stored', 기록이 없어 어제 기준으로 계산했으면 'yesterday' */
  beforeFrom: "stored" | "yesterday";
  after: RiskResult;
  /** 알림 문구 (알림 조건에 해당하지 않으면 null) */
  alertMessage: string | null;
}

export interface DailyCheckPlan {
  checkDate: string;
  items: DailyCheckItem[];
  skipped: Array<{ patientId: string; reason: SkipReason }>;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** 처방 기간 판정: 처방 시작일 ~ 시작일 + (주 × 7) - 1일 */
export function prescriptionStatus(patient: PatientLike, today: Date): "처방 시작 전" | "처방 중" | "처방 종료" {
  const todayKey = toDateKey(today);
  if (todayKey < patient.prescription_start_date) return "처방 시작 전";
  const start = parseDateKey(patient.prescription_start_date);
  const lastDay = toDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + patient.prescription_weeks * 7 - 1));
  return todayKey > lastDay ? "처방 종료" : "처방 중";
}

const LEVELS: RiskLevel[] = ["정상", "주의", "이탈 위험", "치료이탈"];
const asLevel = (l: string): RiskLevel => (LEVELS.includes(l as RiskLevel) ? (l as RiskLevel) : "정상");

/**
 * 오늘 점검 계획을 만듭니다.
 * - 처방 기간 중인 환자만 점검합니다.
 * - 같은 환자를 같은 날 두 번 점검하지 않습니다.
 * - 비교 대상은 마지막으로 저장된 점수, 없으면 어제 기준으로 계산한 점수입니다.
 */
export function planDailyCheck(input: {
  patients: DailyCheckPatient[];
  logs: Array<PlayLogLike & { patient_id: string }>;
  stored: StoredScore[];
  now: Date;
}): DailyCheckPlan {
  const checkDate = toDateKey(input.now);
  const items: DailyCheckItem[] = [];
  const skipped: DailyCheckPlan["skipped"] = [];

  for (const p of input.patients) {
    const status = prescriptionStatus(p, input.now);
    if (status !== "처방 중") {
      skipped.push({ patientId: p.id, reason: status });
      continue;
    }
    const mine = input.stored
      .filter((s) => s.patient_id === p.id)
      .sort((a, b) => (a.calculated_at < b.calculated_at ? 1 : -1));
    if (mine.some((s) => s.source === "daily" && s.check_date === checkDate)) {
      skipped.push({ patientId: p.id, reason: "오늘 점검 완료" });
      continue;
    }

    const logs = input.logs.filter((l) => l.patient_id === p.id);
    const after = computeRisk(p, logs, asOfFor(logs, input.now));
    const last = mine[0];
    let before: DailyCheckItem["before"];
    let beforeFrom: DailyCheckItem["beforeFrom"];
    if (last) {
      before = { score: last.score, level: asLevel(last.level) };
      beforeFrom = "stored";
    } else {
      const y = computeRisk(p, logs, new Date(asOfFor(logs, input.now).getTime() - DAY));
      before = { score: y.score, level: y.level };
      beforeFrom = "yesterday";
    }

    items.push({
      patientId: p.id,
      before,
      beforeFrom,
      after,
      alertMessage: shouldAlert(before, after) ? alertMessage(p.name, before, after) : null,
    });
  }

  return { checkDate, items, skipped };
}

/**
 * 한국 시간(Asia/Seoul) 기준 '지금'.
 * 반환한 Date의 연·월·일·시(getFullYear, getDate 등)가 한국 벽시계와 같습니다.
 * Vercel 서버는 UTC로 돌아서, 그대로 쓰면 '오늘 날짜'가 한국과 달라질 수 있습니다.
 * 한국에서 연 브라우저에서는 new Date()와 같습니다.
 */
export function koreaNow(at: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

/**
 * Vercel Cron 요청 확인: Authorization 헤더가 정확히 `Bearer <CRON_SECRET>`이어야 합니다.
 * 비밀 값이 설정되지 않았으면 항상 거부합니다.
 */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const given = authorization ?? "";
  // 길이가 달라도 같은 시간이 걸리도록 끝까지 비교
  let diff = given.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (given.charCodeAt(i) || 0);
  return diff === 0;
}
