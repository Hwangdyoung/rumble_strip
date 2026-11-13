import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCron, koreaNow } from "@/lib/daily-check";
import { isDemoEnabled } from "@/lib/demo";

/**
 * Vercel Cron이 매일 부르는 매일 점검 주소 (vercel.json의 crons 참고).
 *
 * - Authorization: Bearer <CRON_SECRET> 이 맞을 때만 실행합니다. 아니면 401.
 * - 로그인한 사람이 없으므로 서버 관리자 클라이언트(service role)로 점검합니다.
 *   관리자 클라이언트와 process.env는 핸들러 안에서만 불러옵니다(클라이언트 번들에 들어가지 않도록).
 * - 둘러보기(DEMO_MODE=on)가 켜져 있으면 점검 전에 시연 기준으로 되돌립니다(SQL 011).
 * - 하는 일은 매일 점검입니다. 하루 한 번만 저장되므로 여러 번 불려도 알림이 중복되지 않습니다.
 */
export const Route = createFileRoute("/api/daily-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) return Response.json({ error: "CRON_SECRET이 설정되지 않았습니다." }, { status: 500 });
        if (!isAuthorizedCron(request.headers.get("authorization"), secret)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runDailyCheckWith } = await import("@/lib/daily-check-run");
          // 둘러보기가 켜져 있으면 방문자 기록을 시연 기준으로 먼저 되돌린다(SQL 011). 실패해도 점검은 한다.
          let demoReset: string | null = null;
          if (isDemoEnabled(process.env["DEMO_MODE"])) {
            const { data, error } = await supabaseAdmin.rpc("reset_demo_data");
            demoReset = error ? `실패: ${error.message}` : String(data);
            if (error) console.error("[daily-check] 시연 데이터 되돌리기 실패", error.message);
          }
          const result = await runDailyCheckWith(supabaseAdmin, koreaNow());
          return Response.json({ ok: true, demoReset, ...result });
        } catch (e) {
          console.error("[daily-check] 매일 점검 실패", e);
          return Response.json({ ok: false, error: "매일 점검에 실패했습니다." }, { status: 500 });
        }
      },
    },
  },
});
