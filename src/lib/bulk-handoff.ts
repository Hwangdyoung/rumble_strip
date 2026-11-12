/**
 * 여러 환자 한 번에 넘기기 (순수 함수). 실제 넘기기는 환자마다 DB 함수 handoff_patient(SQL 007)를 부른다.
 * 받는 사람은 그 환자의 담당자여야 한다(DB 규칙). 그래서 선택한 환자 중 받는 사람이 담당하지 않는 환자는 건너뛴다.
 */

export interface StaffLink {
  patientId: string;
  staffId: string;
}

export interface HandoffCandidate {
  staffId: string;
  /** 이 사람에게 넘길 수 있는 환자 (선택 순서 유지) */
  eligible: string[];
  /** 이 사람이 담당자가 아니라 건너뛸 환자 */
  skipped: string[];
}

/** 선택한 환자와 받는 사람으로 넘길 환자·건너뛸 환자를 나눈다 */
export function splitHandoff(selected: string[], links: StaffLink[], toStaff: string): { eligible: string[]; skipped: string[] } {
  const mine = new Set(links.filter((l) => l.staffId === toStaff).map((l) => l.patientId));
  return { eligible: selected.filter((id) => mine.has(id)), skipped: selected.filter((id) => !mine.has(id)) };
}

/**
 * 받는 사람 후보: 나를 뺀, 선택한 환자 중 한 명이라도 담당하는 사람.
 * 넘길 수 있는 환자가 많은 순으로 놓고, 같으면 들어온 순서(links 순서)를 지킨다.
 */
export function handoffCandidates(selected: string[], links: StaffLink[], myId: string | null): HandoffCandidate[] {
  const picked = new Set(selected);
  const ids: string[] = [];
  for (const l of links) {
    if (l.staffId !== myId && picked.has(l.patientId) && !ids.includes(l.staffId)) ids.push(l.staffId);
  }
  return ids
    .map((staffId) => ({ staffId, ...splitHandoff(selected, links, staffId) }))
    .sort((a, b) => b.eligible.length - a.eligible.length);
}

/** 고를 수 있는 환자: 내가 연락 담당인 환자 */
export function selectableIds(rows: Array<{ patientId: string; contactId: string | null }>, myId: string | null): string[] {
  if (!myId) return [];
  return rows.filter((r) => r.contactId === myId).map((r) => r.patientId);
}

/** 결과 안내 문장. 예: "2명을 김간호 님에게 넘겼습니다." / 실패가 있으면 이름을 덧붙인다 */
export function bulkResultText(toName: string, done: number, failedNames: string[]): string {
  const head = done > 0 ? `${done}명을 ${toName} 님에게 넘겼습니다.` : "넘기지 못했습니다.";
  return failedNames.length > 0 ? `${head} ${failedNames.join(", ")} 님은 넘기지 못했습니다. 잠시 후 다시 시도해 주세요.` : head;
}
