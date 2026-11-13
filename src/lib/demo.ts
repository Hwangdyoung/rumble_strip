/**
 * 전시회용 '로그인 없이 둘러보기' (순수 함수). 서버 처리는 demo.server.ts, DB는 SQL 011.
 * 둘러보기 계정 = staff.is_demo가 켜진 계정(관리자는 제외). 역할마다 하나를 골라 비밀번호 없이 들어간다.
 * Vercel 환경 변수 DEMO_MODE=on일 때만 켜진다.
 */

export const DEMO_ROLES = ["의사", "간호사", "상담원"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

/** DEMO_MODE 값 해석: on, true, 1이면 켜짐 */
export function isDemoEnabled(value: string | undefined | null): boolean {
  return ["on", "true", "1", "yes"].includes(String(value ?? "").trim().toLowerCase());
}

export function isDemoRole(v: unknown): v is DemoRole {
  return typeof v === "string" && (DEMO_ROLES as readonly string[]).includes(v);
}

export interface DemoCandidate {
  id: string;
  role: string;
  is_admin: boolean;
  is_demo: boolean;
  created_at: string;
}

/** 역할에 맞는 둘러보기 계정 하나 (먼저 만든 계정). 관리자 계정은 절대 고르지 않는다. */
export function pickDemoAccount<T extends DemoCandidate>(rows: T[], role: DemoRole): T | null {
  return (
    rows
      .filter((r) => r.is_demo && !r.is_admin && r.role === role)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
  );
}

/** 둘러보기 버튼을 보여 줄 역할 (계정이 있는 역할만, DEMO_ROLES 순서) */
export function availableDemoRoles(rows: DemoCandidate[]): DemoRole[] {
  return DEMO_ROLES.filter((role) => pickDemoAccount(rows, role) !== null);
}
