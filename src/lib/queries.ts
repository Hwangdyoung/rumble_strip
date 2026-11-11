import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asOfFor, computeRisk } from "./risk";
import { planDailyCheck } from "./daily-check";
import { suggestOutcome, type AlertOutcome } from "./alert-outcome";

export const patientsOverviewQuery = () =>
  queryOptions({
    queryKey: ["patients-overview"],
    queryFn: async () => {
      const [{ data: patients, error: e1 }, { data: logs, error: e2 }] = await Promise.all([
        supabase.from("patients").select("*").order("name"),
        supabase.from("play_logs").select("patient_id, session_start, play_minutes, accuracy, reaction_ms"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return (patients ?? [])
        .map((p) => {
          const own = (logs ?? []).filter((l) => l.patient_id === p.id);
          return { ...p, risk: computeRisk(p, own, asOfFor(own)) };
        })
        .sort((a, b) => b.risk.score - a.risk.score);
    },
  });

export const patientDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["patient", id],
    queryFn: async () => {
      const [p, logs, actions, alerts] = await Promise.all([
        supabase.from("patients").select("*").eq("id", id).maybeSingle(),
        supabase.from("play_logs").select("*").eq("patient_id", id).order("session_start"),
        supabase.from("actions").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
        supabase.from("alerts").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
      ]);
      for (const r of [p, logs, actions, alerts]) if (r.error) throw r.error;
      return { patient: p.data, logs: logs.data ?? [], actions: actions.data ?? [], alerts: alerts.data ?? [] };
    },
  });

export const alertsQuery = () =>
  queryOptions({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*, patients(name)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const alerts = data ?? [];
      // '회복' 제안용: 알림이 있는 환자의 플레이 기록 (가장 오래된 알림 이후만)
      const pending = alerts.filter((a) => a.outcome === "미정");
      if (pending.length === 0) return alerts.map((a) => ({ ...a, suggestion: null }));
      const since = pending.reduce((min, a) => (a.created_at < min ? a.created_at : min), pending[0]!.created_at);
      const { data: logs, error: le } = await supabase
        .from("play_logs")
        .select("patient_id, session_start, play_minutes")
        .in("patient_id", [...new Set(pending.map((a) => a.patient_id))])
        .gt("session_start", since);
      if (le) throw le;
      return alerts.map((a) => ({
        ...a,
        suggestion:
          a.outcome === "미정" ? suggestOutcome(a.created_at, (logs ?? []).filter((l) => l.patient_id === a.patient_id)) : null,
      }));
    },
    refetchInterval: 30_000,
  });

/** 대시보드 '알림 결과' 카드용: 전체 알림의 결과와 알림 당시 단계 */
export const alertOutcomesQuery = () =>
  queryOptions({
    queryKey: ["alerts", "outcomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alerts").select("outcome, alert_level");
      if (error) throw error;
      return data ?? [];
    },
  });

export type AlertStatus = "미확인" | "확인" | "조치완료";

export async function setAlertStatus(id: string, status: AlertStatus) {
  const { error } = await supabase.from("alerts").update({ status }).eq("id", id);
  if (error) throw error;
}

/** 알림 결과 저장. '미정'으로 되돌리면 기록 시각을 비웁니다. note가 undefined면 메모는 그대로 둡니다. */
export async function setAlertOutcome(id: string, outcome: AlertOutcome, note?: string | null) {
  const patch: { outcome: AlertOutcome; outcome_at: string | null; outcome_note?: string | null } = {
    outcome,
    outcome_at: outcome === "미정" ? null : new Date().toISOString(),
  };
  if (note !== undefined) patch.outcome_note = note?.trim() ? note.trim() : null;
  const { error } = await supabase.from("alerts").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * 매일 점검: 처방 중인 환자의 오늘 점수를 마지막 점검과 비교해 저장하고, 나빠졌으면 알림을 만듭니다.
 * 같은 환자는 하루에 한 번만 저장됩니다 (DB 고유 인덱스 risk_scores_daily_once).
 */
export async function runDailyCheck(now: Date = new Date()) {
  const [{ data: patients, error: e1 }, { data: logs, error: e2 }, { data: stored, error: e3 }] = await Promise.all([
    supabase.from("patients").select("*"),
    supabase.from("play_logs").select("patient_id, session_start, play_minutes, accuracy, reaction_ms"),
    supabase.from("risk_scores").select("patient_id, score, level, calculated_at, source, check_date"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  const plan = planDailyCheck({ patients: patients ?? [], logs: logs ?? [], stored: stored ?? [], now });

  let saved = 0;
  let alerts = 0;
  for (const item of plan.items) {
    const { data: rs, error } = await supabase
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
      const { error: ae } = await supabase.from("alerts").insert({
        patient_id: item.patientId,
        risk_score_id: rs.id,
        message: item.alertMessage,
        alert_score: item.after.score,
        alert_level: item.after.level,
      });
      if (ae) throw ae;
      alerts++;
    }
  }

  const ended = plan.skipped.filter((s) => s.reason !== "오늘 점검 완료").length;
  const doneToday = plan.skipped.filter((s) => s.reason === "오늘 점검 완료").length;
  return { checkDate: plan.checkDate, checkedAt: now.toISOString(), saved, alerts, doneToday, outOfPrescription: ended };
}
