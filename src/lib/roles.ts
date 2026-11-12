/**
 * 역할별 접근 (순수 함수). 실제 차단은 DB(SQL 009)가 한다. 여기서는 어떤 화면을 그릴지만 정한다.
 *
 * - 의료진 정보(점수·플레이 원본·그래프·AI 경과 요약·알림 문구)를 보는 사람: 관리자, 의사, 간호사
 * - 상담원: 단계, 접속 관련 이유, 접속한 날짜, 연락 도우미, 연락 이력만 (서버 함수가 골라서 보냄)
 */
export type StaffLike = { role: string; is_admin: boolean } | null | undefined;

export function canSeeClinical(staff: StaffLike): boolean {
  if (!staff) return false;
  return staff.is_admin || staff.role === "의사" || staff.role === "간호사";
}

/** 상담원이 기록할 수 있는 알림 결과 (회복·이탈 판정은 의료진) */
export const LIMITED_OUTCOMES = ["미정", "연락 불가"] as const;

/** 정확도·세션 시간·반응 속도처럼 치료 경과에 가까운 이유 (상담원에게 보내지 않음) */
const CLINICAL_REASON = /정확도|세션|반응 속도/;
export const CLINICAL_REASON_NOTE = "게임 수행에 변화가 있어요 (자세한 내용은 의료진 확인)";

/**
 * risk.ts가 만든 이유 목록에서 상담원에게 보여 줄 것만 남긴다.
 * 치료 경과 관련 이유는 첫 번째 자리에 안내 문장 하나로 바꾸고 나머지는 뺀다.
 */
export function counselorReasons(reasons: string[]): string[] {
  const out: string[] = [];
  let noted = false;
  for (const r of reasons) {
    if (!CLINICAL_REASON.test(r)) out.push(r);
    else if (!noted) {
      out.push(CLINICAL_REASON_NOTE);
      noted = true;
    }
  }
  return out;
}

/** 상담원에게 보여 줄 알림 문구 (저장된 문구에는 정확도 등 수치가 들어 있어 쓰지 않음) */
export function counselorAlertMessage(level: string | null): string {
  return level ? `상태가 나빠졌습니다 (${level} 단계)` : "상태가 나빠졌습니다";
}
