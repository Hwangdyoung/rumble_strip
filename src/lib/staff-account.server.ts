/**
 * 관리자 전용: 의료진 계정 만들기 (회원가입을 끈 뒤 계정을 만드는 유일한 앱 경로).
 *
 * - 부른 사람이 관리자인지 로그인 사용자 권한(RLS)으로 staff를 읽어 확인한다.
 * - 계정 생성(auth.admin.createUser)과 staff 줄 추가는 관리자 클라이언트(service role)로 한다.
 *   Supabase에서 가입을 꺼도 관리자 API로는 계정을 만들 수 있다.
 * - staff 줄을 못 만들면 방금 만든 계정을 지워 반쪽 계정을 남기지 않는다.
 * - 관리자 클라이언트(client.server.ts)와 process.env는 핸들러 안에서만 쓴다.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkNewAccount, type NewAccountInput } from "@/lib/staff-account";

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => {
    const r = checkNewAccount((d ?? {}) as NewAccountInput);
    if (!r.ok) throw new Error(r.errors.join(" "));
    return r.value;
  })
  .handler(async ({ data, context }): Promise<{ loginId: string; name: string }> => {
    const { data: me, error: meErr } = await context.supabase.from("staff").select("is_admin").eq("id", context.userId).maybeSingle();
    if (meErr) throw meErr;
    if (!me?.is_admin) throw new Error("관리자만 계정을 만들 수 있습니다.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) {
      const exists = error?.code === "email_exists" || /already/i.test(error?.message ?? "");
      throw new Error(exists ? "이미 있는 아이디입니다. 다른 아이디를 정해 주세요." : "계정을 만들지 못했습니다. 다시 시도해 주세요.");
    }

    const { error: sErr } = await supabaseAdmin.from("staff").insert({ id: created.user.id, name: data.name, role: data.role });
    if (sErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("의료진 정보를 저장하지 못해 계정을 만들지 않았습니다. 다시 시도해 주세요.");
    }
    return { loginId: data.loginId, name: data.name };
  });
