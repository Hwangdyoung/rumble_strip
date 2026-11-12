import { describe, expect, it } from "vitest";
import { CLINICAL_REASON_NOTE, canSeeClinical, counselorAlertMessage, counselorReasons } from "./roles";

describe("canSeeClinical", () => {
  it("의사·간호사·관리자는 볼 수 있다", () => {
    expect(canSeeClinical({ role: "의사", is_admin: false })).toBe(true);
    expect(canSeeClinical({ role: "간호사", is_admin: false })).toBe(true);
    expect(canSeeClinical({ role: "상담원", is_admin: true })).toBe(true);
  });
  it("상담원과 정보 없는 계정은 못 본다", () => {
    expect(canSeeClinical({ role: "상담원", is_admin: false })).toBe(false);
    expect(canSeeClinical(null)).toBe(false);
    expect(canSeeClinical(undefined)).toBe(false);
  });
});

describe("counselorReasons", () => {
  it("접속 관련 이유는 그대로 둔다", () => {
    expect(counselorReasons(["5일 연속 미접속", "처방 대비 2회 지연", "최근 7일 중 2일 접속"])).toEqual([
      "5일 연속 미접속",
      "처방 대비 2회 지연",
      "최근 7일 중 2일 접속",
    ]);
  });
  it("정확도·세션·반응 속도 이유는 안내 문장 하나로 바꾼다", () => {
    const out = counselorReasons(["정확도 12%p 하락", "평균 세션 9분으로 짧아짐", "반응 속도 30% 느려짐", "최근 7일 중 4일 접속"]);
    expect(out).toEqual([CLINICAL_REASON_NOTE, "최근 7일 중 4일 접속"]);
  });
  it("수치가 남지 않는다", () => {
    const out = counselorReasons(["3일 연속 미접속", "정확도 12%p 하락", "세션 시간 20% 감소"]).join(" ");
    expect(out).not.toMatch(/정확도|%p|세션|반응/);
  });
});

describe("counselorAlertMessage", () => {
  it("단계만 말한다", () => {
    expect(counselorAlertMessage("이탈 위험")).toBe("상태가 나빠졌습니다 (이탈 위험 단계)");
    expect(counselorAlertMessage(null)).toBe("상태가 나빠졌습니다");
  });
});
