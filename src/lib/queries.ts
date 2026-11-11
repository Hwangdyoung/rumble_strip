import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asOfFor, computeRisk } from "./risk";
import { koreaNow } from "./daily-check";
import { runDailyCheckWith } from "./daily-check-run";
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

/** 매일 점검 (대시보드에서 로그인한 의료진 권한으로 실행). 실제 처리는 daily-check-run.ts */
export function runDailyCheck() {
  return runDailyCheckWith(supabase, koreaNow());
}
