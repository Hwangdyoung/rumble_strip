/**
 * 매일 점검 실행 (DB 조회·저장). 어떤 Supabase 클라이언트로 실행할지는 호출하는 쪽이 정합니다.
 * 이 파일은 비밀 값이나 process.env를 쓰지 않습니다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { planDailyCheck } from "./daily-check";

/**
 * 매일 점검: 처방 중인 환자의 오늘 점수를 마지막 점검과 비교해 저장하고, 나빠졌으면 알림을 만듭니다.
 * 같은 환자는 하루에 한 번만 저장됩니다 (DB 고유 인덱스 risk_scores_daily_once).
 *
 * client: 대시보드는 로그인한 의료진의 브라우저 클라이언트, Vercel Cron은 서버 관리자 클라이언트를 넘깁니다.
 * now: 한국 시간 기준 '지금'(koreaNow). realNow: 실제 실행 시각(결과 표시용).
 */
export async function runDailyCheckWith(client: SupabaseClient<Database>, now: Date, realNow: Date = new Date()) {
  const [{ data: patients, error: e1 }, { data: logs, error: e2 }, { data: stored, error: e3 }] = await Promise.all([
    client.from("patients").select("*"),
    client.from("play_logs").select("patient_id, session_start, play_minutes, accuracy, reaction_ms"),
    client.from("risk_scores").select("patient_id, score, level, calculated_at, source, check_date"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  // 연락 담당(환자당 1명): 새 알림을 자동 배정한다
  const { data: contacts, error: ce } = await client.from("patient_staff").select("patient_id, staff_id").eq("is_contact", true);
  if (ce) throw ce;
  const contactOf = new Map((contacts ?? []).map((c) => [c.patient_id, c.staff_id]));

  const plan = planDailyCheck({ patients: patients ?? [], logs: logs ?? [], stored: stored ?? [], now });

  let saved = 0;
  let alerts = 0;
  for (const item of plan.items) {
    const { data: rs, error } = await client
      .from("risk_scores")
      .insert({
        patient_id: item.patientId,
        score: item.after.score,
        level: item.after.level,
        reasons: item.after.reasons,
        source: "daily",
        check_date: plan.checkDate,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") continue; // 다른 화면에서 방금 점검함 → 알림 중복 방지
      throw error;
    }
    saved++;
    if (item.alertMessage) {
      const { error: ae } = await client.from("alerts").insert({
        patient_id: item.patientId,
        risk_score_id: rs.id,
        message: item.alertMessage,
        alert_score: item.after.score,
        alert_level: item.after.level,
        assignee_id: contactOf.get(item.patientId) ?? null,
        assigned_at: contactOf.has(item.patientId) ? realNow.toISOString() : null,
      });
      if (ae) throw ae;
      alerts++;
    }
  }

  const ended = plan.skipped.filter((s) => s.reason !== "오늘 점검 완료").length;
  const doneToday = plan.skipped.filter((s) => s.reason === "오늘 점검 완료").length;
  return { checkDate: plan.checkDate, checkedAt: realNow.toISOString(), saved, alerts, doneToday, outOfPrescription: ended };
}
