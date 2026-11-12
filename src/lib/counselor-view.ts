/**
 * 상담원 화면용 데이터 모양과 변환 (순수 함수, 클라이언트에서 써도 됨).
 * 서버 함수(counselor-view.server.ts)가 risk.ts로 계산한 뒤, 여기 함수로 상담원에게 보낼 것만 고른다.
 * 점수 숫자, 정확도·반응 속도·세션 시간, 저장된 알림 문구는 보내지 않는다.
 */
import type { ContactRow } from "./contact-list";
import type { GuardianSheetInput } from "./guardian-sheet";
import type { Guide } from "./response-guide";
import type { RiskLevel } from "./risk";
import { counselorAlertMessage } from "./roles";

export interface CounselorAlert {
  id: string;
  patient_id: string;
  patient_name: string | null;
  created_at: string;
  status: string;
  outcome: string;
  outcome_at: string | null;
  outcome_note: string | null;
  alert_level: string | null;
  assignee_id: string | null;
  /** 상담원용 문구 (단계만) */
  message: string;
}

export interface CounselorPatient {
  patient: {
    id: string;
    name: string;
    age: number;
    prescription_start_date: string;
    prescription_weeks: number;
    weekly_target_days: number;
    session_target_minutes: number;
  };
  level: RiskLevel;
  /** 접속 관련 이유 (치료 경과 이유는 안내 문장으로 바뀜) */
  reasons: string[];
  lastPlayDate: string | null;
  /** 접속한 날짜 (YYYY-MM-DD) */
  playedDates: string[];
  /** 연락 도우미 (보호자에게 전해도 되는 수준의 문장) */
  guide: Guide;
  /** 보호자 안내문 인쇄용 */
  sheet: GuardianSheetInput;
  alerts: CounselorAlert[];
  actions: Array<{ id: string; action_type: string; memo: string | null; created_at: string; staff_id: string | null }>;
  followUps: Array<{ id: string; due_date: string; assignee_id: string | null; note: string }>;
}

type AlertRowLike = {
  id: string;
  patient_id: string;
  created_at: string;
  status: string;
  outcome: string;
  outcome_at: string | null;
  outcome_note: string | null;
  alert_level: string | null;
  assignee_id: string | null;
};

/** 알림 한 건을 상담원용으로: 저장된 문구·당시 점수를 빼고 단계 문구로 바꾼다 */
export function toCounselorAlert(a: AlertRowLike, patientName: string | null = null): CounselorAlert {
  return {
    id: a.id,
    patient_id: a.patient_id,
    patient_name: patientName,
    created_at: a.created_at,
    status: a.status,
    outcome: a.outcome,
    outcome_at: a.outcome_at,
    outcome_note: a.outcome_note,
    alert_level: a.alert_level,
    assignee_id: a.assignee_id,
    message: counselorAlertMessage(a.alert_level),
  };
}

/** 목록 한 줄을 상담원용으로: 점수를 빼고 이유를 접속 관련 이유로 바꾼다 */
export function toCounselorRow(row: ContactRow, reasons: string[]): ContactRow {
  return { ...row, score: null, reason: reasons[0] ?? "" };
}
