/**
 * '로그인 없이 둘러보기'(전시회에서 방문자가 앱을 써 보는 용도) 서버 함수 (SQL 011, 순수 함수는 demo.ts).
 *
 * - getDemoStatus: 둘러보기가 켜졌는지(Vercel 환경 변수 DEMO_MODE=on)와 버튼을 보여 줄 역할. 로그인 없이 부른다.
 * - demoSignIn: 역할에 맞는 둘러보기 계정(staff.is_demo, 관리자 아님)으로 로그인 세션을 만들어 돌려준다.
 *   비밀번호는 쓰지 않는다. 관리자 API로 일회용 로그인 링크 값(hashed_token)을 만들고,
 *   서버에서 바로 Supabase 인증 서버의 /verify로 바꿔 세션을 받는다(링크를 메일로 보내지 않음).
 *   화면 코드에는 비밀번호나 비밀 키가 없다.
 * - 관리자 클라이언트(client.server.ts)와 process.env는 핸들러 안에서만 쓴다.
 */
import { createServerFn } from "@tanstack/react-start";
import { availableDemoRoles, isDemoEnabled, isDemoRole, pickDemoAccount, type DemoRole } from "@/lib/demo";

export interface DemoStatus {
  enabled: boolean;
  roles: DemoRole[];
}

const UNAVAILABLE = "지금은 둘러보기를 사용할 수 없습니다.";

async function loadCandidates() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("staff").select("*");
  if (error) throw error;
  return {
    supabaseAdmin,
    rows: (data ?? []).map((r) => ({ id: r.id, role: r.role, is_admin: r.is_admin, is_demo: Boolean(r.is_demo), created_at: r.created_at })),
  };
}

export const getDemoStatus = createServerFn({ method: "GET" }).handler(async (): Promise<DemoStatus> => {
  if (!isDemoEnabled(process.env["DEMO_MODE"])) return { enabled: false, roles: [] };
  try {
    const { rows } = await loadCandidates();
    const roles = availableDemoRoles(rows);
    return { enabled: roles.length > 0, roles };
  } catch (e) {
    console.error("[demo] 둘러보기 상태 확인 실패", e);
    return { enabled: false, roles: [] };
  }
});

export const demoSignIn = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const role = (d as { role?: unknown })?.role;
    if (!isDemoRole(role)) throw new Error(UNAVAILABLE);
    return { role };
  })
  .handler(async ({ data }): Promise<{ access_token: string; refresh_token: string }> => {
    if (!isDemoEnabled(process.env["DEMO_MODE"])) throw new Error(UNAVAILABLE);
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error(UNAVAILABLE);

    const { supabaseAdmin, rows } = await loadCandidates();
    const account = pickDemoAccount(rows, data.role);
    if (!account) throw new Error(UNAVAILABLE);

    const { data: user } = await supabaseAdmin.auth.admin.getUserById(account.id);
    const email = user?.user?.email;
    if (!email) throw new Error(UNAVAILABLE);

    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link?.properties?.hashed_token;
    if (lErr || !tokenHash) {
      console.error("[demo] 로그인 링크 만들기 실패", lErr?.message);
      throw new Error("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }

    const res = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
    });
    const session = (await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string } | null;
    if (!res.ok || !session?.access_token || !session.refresh_token) {
      console.error("[demo] 로그인 세션 받기 실패", res.status);
      throw new Error("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
    return { access_token: session.access_token, refresh_token: session.refresh_token };
  });
