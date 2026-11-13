/**
 * 관리자 '담당 관리' 화면용 순수 함수. 의료진·환자가 많아져도 쓰도록 검색·필터·여러 명 배정을 계산한다.
 * DB에 쓰는 일은 queries.ts가 한다.
 */
export interface StaffItem {
  id: string;
  name: string;
  role: string;
  is_admin: boolean;
  /** '로그인 없이 둘러보기' 계정 (SQL 011) */
  is_demo?: boolean;
}
export interface PatientItem {
  id: string;
  name: string;
  age: number;
}
export interface LinkItem {
  patient_id: string;
  staff_id: string;
  is_contact: boolean;
}

export interface PatientRow extends PatientItem {
  /** 담당자 (연락 담당이 먼저, 그다음 이름 순) */
  staff: StaffItem[];
  contactId: string | null;
}

export interface StaffRow extends StaffItem {
  patientIds: string[];
  /** 아직 담당 환자가 없고 관리자도 아님: 새 계정이라 배정을 기다리는 사람 */
  isNew: boolean;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "ko");
const norm = (s: string) => s.trim().toLowerCase();

/** 환자 한 줄 = 환자 + 담당자 이름표 */
export function patientRows(patients: PatientItem[], links: LinkItem[], staff: StaffItem[]): PatientRow[] {
  const staffById = new Map(staff.map((s) => [s.id, s]));
  return [...patients].sort(byName).map((p) => {
    const mine = links.filter((l) => l.patient_id === p.id);
    const contactId = mine.find((l) => l.is_contact)?.staff_id ?? null;
    const list = mine
      .map((l) => staffById.get(l.staff_id))
      .filter((s): s is StaffItem => Boolean(s))
      .sort((a, b) => Number(b.id === contactId) - Number(a.id === contactId) || byName(a, b));
    return { ...p, staff: list, contactId };
  });
}

export interface PatientFilter {
  query: string;
  unassignedOnly: boolean;
}

export function filterPatientRows(rows: PatientRow[], f: PatientFilter): PatientRow[] {
  const q = norm(f.query);
  return rows.filter((r) => (!q || norm(r.name).includes(q)) && (!f.unassignedOnly || r.staff.length === 0));
}

/** 의료진 한 줄 = 의료진 + 담당 환자. 새로 가입한 사람이 먼저, 그다음 이름 순 */
export function staffRows(staff: StaffItem[], links: LinkItem[]): StaffRow[] {
  return staff
    .map((s) => {
      const patientIds = links.filter((l) => l.staff_id === s.id).map((l) => l.patient_id);
      return { ...s, patientIds, isNew: patientIds.length === 0 && !s.is_admin };
    })
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || byName(a, b));
}

export interface StaffFilter {
  query: string;
  /** "" = 전체 */
  role: string;
}

export function filterStaffRows<T extends StaffItem>(rows: T[], f: StaffFilter): T[] {
  const q = norm(f.query);
  return rows.filter((r) => (!q || norm(r.name).includes(q)) && (!f.role || r.role === f.role));
}

/** 이름 검색 (이미 담당인 사람 등 exclude 제외) */
export function searchByName<T extends { id: string; name: string }>(items: T[], query: string, exclude: Iterable<string> = []): T[] {
  const ex = new Set(exclude);
  const q = norm(query);
  return items.filter((i) => !ex.has(i.id) && (!q || norm(i.name).includes(q))).sort(byName);
}

/** 여러 환자에 한 사람을 배정할 때 새로 연결해야 하는 환자만 (이미 담당이면 뺀다) */
export function patientsToLink(patientIds: string[], staffId: string, links: LinkItem[]): string[] {
  const have = new Set(links.filter((l) => l.staff_id === staffId).map((l) => l.patient_id));
  return [...new Set(patientIds)].filter((id) => !have.has(id));
}

const ROLE_ORDER = ["의사", "간호사", "상담원"];

/**
 * 환자별 탭의 담당 의료진 표시: 역할별 줄로 묶는다(의사 → 간호사 → 상담원 → 그 밖).
 * 줄 안에서는 들어온 순서를 지킨다(patientRows가 연락 담당을 먼저 둠).
 * limit을 주면 앞에서부터 그 수만 보여 주고 나머지 수를 hidden으로 돌려준다(연락 담당은 늘 보임).
 */
export function staffByRole<T extends { role: string }>(staff: T[], limit?: number): { groups: Array<{ role: string; people: T[] }>; hidden: number } {
  const visible = limit === undefined ? staff : staff.slice(0, Math.max(0, limit));
  const roles = [...new Set(visible.map((s) => s.role))].sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a);
    const ib = ROLE_ORDER.indexOf(b);
    return (ia < 0 ? ROLE_ORDER.length : ia) - (ib < 0 ? ROLE_ORDER.length : ib) || a.localeCompare(b, "ko");
  });
  return {
    groups: roles.map((role) => ({ role, people: visible.filter((s) => s.role === role) })),
    hidden: staff.length - visible.length,
  };
}

