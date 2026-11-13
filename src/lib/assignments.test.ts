import { describe, expect, it } from "vitest";
import { filterPatientRows, filterStaffRows, patientRows, patientsToLink, searchByName, staffByRole, staffRows, type LinkItem, type StaffItem } from "./assignments";

const staff: StaffItem[] = [
  { id: "a", name: "관리자", role: "의사", is_admin: true },
  { id: "n1", name: "김간호", role: "간호사", is_admin: false },
  { id: "c1", name: "황도영", role: "상담원", is_admin: false },
  { id: "new", name: "새직원", role: "상담원", is_admin: false },
];
const patients = [
  { id: "p1", name: "한시우", age: 11 },
  { id: "p2", name: "강민준", age: 9 },
  { id: "p3", name: "김하늘", age: 9 },
];
const links: LinkItem[] = [
  { patient_id: "p1", staff_id: "n1", is_contact: false },
  { patient_id: "p1", staff_id: "c1", is_contact: true },
  { patient_id: "p2", staff_id: "n1", is_contact: true },
];

describe("patientRows", () => {
  it("이름 순, 담당자는 연락 담당이 먼저", () => {
    const rows = patientRows(patients, links, staff);
    expect(rows.map((r) => r.name)).toEqual(["강민준", "김하늘", "한시우"]);
    const p1 = rows.find((r) => r.id === "p1")!;
    expect(p1.contactId).toBe("c1");
    expect(p1.staff.map((s) => s.id)).toEqual(["c1", "n1"]);
  });
  it("담당자가 없으면 빈 목록", () => {
    expect(patientRows(patients, links, staff).find((r) => r.id === "p3")!.staff).toEqual([]);
  });
});

describe("filterPatientRows", () => {
  const rows = patientRows(patients, links, staff);
  it("이름 검색", () => {
    expect(filterPatientRows(rows, { query: "김", unassignedOnly: false }).map((r) => r.id)).toEqual(["p3"]);
  });
  it("담당 미배정만", () => {
    expect(filterPatientRows(rows, { query: "", unassignedOnly: true }).map((r) => r.id)).toEqual(["p3"]);
  });
});

describe("staffRows", () => {
  it("새로 가입한 사람(담당 0명, 관리자 아님)이 먼저", () => {
    const rows = staffRows(staff, links);
    expect(rows[0]!.id).toBe("new");
    expect(rows[0]!.isNew).toBe(true);
    expect(rows.find((r) => r.id === "a")!.isNew).toBe(false);
    expect(rows.find((r) => r.id === "n1")!.patientIds).toEqual(["p1", "p2"]);
  });
  it("역할·이름으로 거른다", () => {
    const rows = staffRows(staff, links);
    expect(filterStaffRows(rows, { query: "", role: "상담원" }).map((r) => r.id)).toEqual(["new", "c1"]);
    expect(filterStaffRows(rows, { query: "간호", role: "" }).map((r) => r.id)).toEqual(["n1"]);
  });
});

describe("searchByName", () => {
  it("이미 담당인 사람은 빼고 이름으로 찾는다", () => {
    expect(searchByName(staff, "", ["n1", "c1"]).map((s) => s.name)).toEqual(["관리자", "새직원"]);
    expect(searchByName(staff, "황").map((s) => s.id)).toEqual(["c1"]);
  });
});

describe("patientsToLink", () => {
  it("이미 담당인 환자와 중복은 뺀다", () => {
    expect(patientsToLink(["p1", "p2", "p3", "p3"], "n1", links)).toEqual(["p3"]);
    expect(patientsToLink(["p1", "p2"], "new", links)).toEqual(["p1", "p2"]);
  });
});

describe("staffByRole", () => {
  const people = [
    { id: "c", role: "간호사" },
    { id: "d1", role: "의사" },
    { id: "n2", role: "간호사" },
    { id: "s1", role: "상담원" },
    { id: "d2", role: "의사" },
  ];
  it("의사 → 간호사 → 상담원 순서로 묶고, 줄 안 순서는 그대로", () => {
    expect(staffByRole(people).groups).toEqual([
      { role: "의사", people: [people[1], people[4]] },
      { role: "간호사", people: [people[0], people[2]] },
      { role: "상담원", people: [people[3]] },
    ]);
    expect(staffByRole(people).hidden).toBe(0);
  });
  it("limit이면 앞에서부터만 보이고 나머지 수를 알려 준다(첫 사람 = 연락 담당은 늘 보임)", () => {
    const r = staffByRole(people, 3);
    expect(r.hidden).toBe(2);
    expect(r.groups.flatMap((g) => g.people.map((p) => p.id))).toEqual(["d1", "c", "n2"]);
  });
});

