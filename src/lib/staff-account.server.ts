/**
 * 의료진 계정 서버 함수 (회원가입을 끈 뒤 계정을 만드는 유일한 앱 경로).
 *
 * - createStaffAccount(관리자): 계정 + staff 줄 + 처음 설정 코드(SQL 010)를 만든다. 비밀번호는 아무도 모르는 임의 값.
 *   코드 원문은 돌려주는 값으로 한 번만 나가고 DB에는 해시만 남는다.
 * - reissueSetupCode(관리자): 코드를 새로 만들고 비밀번호를 임의 값으로 바꾼다(코드 분실·기한 지남·비밀번호 잊음).
 * - activateAccount(로그인 없이): 아이디·코드가 맞으면 본인이 정한 비밀번호로 바꾸고 코드를 사용함으로 표시한다.
 *   틀린 이유는 하나의 문장으로만 알린다(아이디가 있는지 알려 주지 않기 위해). 5번 틀리면 코드가 잠긴다.
 * - 관리자 여부는 로그인 사용자 권한(RLS)으로 staff를 읽어 확인하고, 계정·코드 처리는 관리자 클라이언트(service role)로 한다.
 * - 관리자 클라이언트(client.server.ts)와 process.env는 핸들러 안에서만 쓴다.
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { displayLoginId } from "@/lib/login-id";
import { checkNewAccount, type NewAccountInput } from "@/lib/staff-account";
import {
  checkActivation,
  generateSetupCode,
  hashSetupCode,
  inviteState,
  randomHiddenPassword,
  sameHash,
  setupCodeExpiry,
  type ActivationInput,
} from "@/lib/setup-code";

export interface SetupCodeResult {
  loginId: string;
  name: string;
  code: string;
  expiresAt: string;
}

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function assertAdmin(context: Ctx, message: string) {
  const { data: me, error } = await context.supabase.from("staff").select("is_admin").eq("id", context.userId).maybeSingle();
  if (error) throw error;
  if (!me?.is_admin) throw new Error(message);
}

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => {
    const r = checkNewAccount((d ?? {}) as NewAccountInput);
    if (!r.ok) throw new Error(r.errors.join(" "));
    return r.value;
  })
  .handler(async ({ data, context }): Promise<SetupCodeResult> => {
    await assertAdmin(context, "관리자만 계정을 만들 수 있습니다.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: randomHiddenPassword(),
      email_confirm: true,
    });
    if (error || !created.user) {
      const exists = error?.code === "email_exists" || /already/i.test(error?.message ?? "");
      throw new Error(exists ? "이미 있는 아이디입니다. 다른 아이디를 정해 주세요." : "계정을 만들지 못했습니다. 다시 시도해 주세요.");
    }
    const id = created.user.id;

    const { error: sErr } = await supabaseAdmin.from("staff").insert({ id, name: data.name, role: data.role });
    if (sErr) {
      await supabaseAdmin.auth.admin.deleteUser(id);
      throw new Error("의료진 정보를 저장하지 못해 계정을 만들지 않았습니다. 다시 시도해 주세요.");
    }

    const code = generateSetupCode();
    const expiresAt = setupCodeExpiry(new Date()).toISOString();
    const { error: iErr } = await supabaseAdmin.from("staff_invites").insert({
      staff_id: id,
      login_id: data.loginId,
      code_hash: await hashSetupCode(code, id),
      expires_at: expiresAt,
      created_by: context.userId,
    });
    if (iErr) {
      await supabaseAdmin.from("staff").delete().eq("id", id);
      await supabaseAdmin.auth.admin.deleteUser(id);
      throw new Error("처음 설정 코드를 저장하지 못해 계정을 만들지 않았습니다. (SQL 010을 실행했는지 확인해 주세요)");
    }
    return { loginId: data.loginId, name: data.name, code, expiresAt };
  });

export const reissueSetupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => {
    const staffId = String((d as { staffId?: unknown })?.staffId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(staffId)) throw new Error("잘못된 요청입니다.");
    return { staffId };
  })
  .handler(async ({ data, context }): Promise<SetupCodeResult> => {
    await assertAdmin(context, "관리자만 코드를 다시 만들 수 있습니다.");
    if (data.staffId === context.userId) throw new Error("내 비밀번호는 설정 화면에서 바꿔 주세요.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: staff } = await supabaseAdmin.from("staff").select("name").eq("id", data.staffId).maybeSingle();
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(data.staffId);
    if (!staff || !user?.user?.email) throw new Error("의료진을 찾지 못했습니다.");
    const loginId = displayLoginId(user.user.email);

    // 먼저 비밀번호를 아무도 모르는 값으로 바꿔, 예전 비밀번호로는 더 로그인하지 못하게 한다
    const { error: pErr } = await supabaseAdmin.auth.admin.updateUserById(data.staffId, { password: randomHiddenPassword() });
    if (pErr) throw new Error("코드를 만들지 못했습니다. 다시 시도해 주세요.");

    const code = generateSetupCode();
    const expiresAt = setupCodeExpiry(new Date()).toISOString();
    const { error } = await supabaseAdmin.from("staff_invites").upsert(
      {
        staff_id: data.staffId,
        login_id: loginId,
        code_hash: await hashSetupCode(code, data.staffId),
        expires_at: expiresAt,
        used_at: null,
        attempts: 0,
        created_by: context.userId,
        created_at: new Date().toISOString(),
      },
      { onConflict: "staff_id" },
    );
    if (error) throw new Error("코드를 저장하지 못했습니다. 다시 시도해 주세요. (SQL 010을 실행했는지 확인해 주세요)");
    return { loginId, name: staff.name, code, expiresAt };
  });

const ACTIVATE_FAIL = "아이디나 코드가 맞지 않거나, 코드 기한이 지났습니다. 계속 안 되면 관리자에게 코드를 다시 만들어 달라고 요청해 주세요.";

export const activateAccount = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const r = checkActivation((d ?? {}) as ActivationInput);
    if (!r.ok) throw new Error(r.errors.join(" "));
    return r.value;
  })
  .handler(async ({ data }): Promise<{ loginId: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("staff_invites")
      .select("staff_id, code_hash, expires_at, used_at, attempts")
      .eq("login_id", data.loginId)
      .maybeSingle();
    if (error) throw new Error("확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    if (!inv || inviteState(inv, new Date()) !== "대기") throw new Error(ACTIVATE_FAIL);

    const ok = sameHash(await hashSetupCode(data.code, inv.staff_id), inv.code_hash);
    if (!ok) {
      await supabaseAdmin.from("staff_invites").update({ attempts: inv.attempts + 1 }).eq("staff_id", inv.staff_id);
      throw new Error(ACTIVATE_FAIL);
    }

    // 코드를 먼저 사용함으로 표시해(아직 안 쓴 줄만) 같은 코드를 두 번 쓰지 못하게 한다
    const { data: claimed } = await supabaseAdmin
      .from("staff_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("staff_id", inv.staff_id)
      .is("used_at", null)
      .select("staff_id");
    if (!claimed || claimed.length === 0) throw new Error(ACTIVATE_FAIL);

    const { error: pErr } = await supabaseAdmin.auth.admin.updateUserById(inv.staff_id, { password: data.password });
    if (pErr) {
      await supabaseAdmin.from("staff_invites").update({ used_at: null }).eq("staff_id", inv.staff_id);
      throw new Error("비밀번호를 저장하지 못했습니다. 다른 비밀번호로 다시 시도해 주세요.");
    }
    return { loginId: data.loginId };
  });
