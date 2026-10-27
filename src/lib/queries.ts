import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { alertMessage, asOfFor, computeRisk, shouldAlert } from "./risk";

export const patientsOverviewQuery = () =>
  queryOptions({
    queryKey: ["patients-overview"],
    queryFn: async () => {
      const [{ data: patients, error: e1 }, { data: logs, error: e2 }] = await Promise.all([
        supabase.from("patients").select("*").order("name"),
        supabase.from("play_logs").select("patient_id, session_start, play_minutes"),
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
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

export type AlertStatus = "미확인" | "확인" | "조치완료";

export async function setAlertStatus(id: string, status: AlertStatus) {
  const { error } = await supabase.from("alerts").update({ status }).eq("id", id);
  if (error) throw error;
}

/** 플레이 기록 저장 → 위험 재계산 → risk_scores 기록 → 필요 시 알림 생성 */
export async function addLogAndRecalc(
  patientId: string,
  entry: { date: string; minutes: number; tasks: number; endedEarly: boolean },
) {
  const [{ data: patient, error: pe }, { data: logs, error: le }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", patientId).single(),
    supabase.from("play_logs").select("session_start, play_minutes").eq("patient_id", patientId),
  ]);
  if (pe) throw pe;
  if (le) throw le;
  const before = computeRisk(patient, logs ?? [], asOfFor(logs ?? []));

  const start = new Date(`${entry.date}T18:00:00`);
  const end = new Date(start.getTime() + entry.minutes * 60_000);
  const newLog = { session_start: start.toISOString(), play_minutes: entry.minutes };
  const { error: ie } = await supabase.from("play_logs").insert({
    patient_id: patientId,
    session_start: newLog.session_start,
    session_end: end.toISOString(),
    play_minutes: entry.minutes,
    tasks_completed: entry.tasks,
    ended_early: entry.endedEarly,
  });
  if (ie) throw ie;

  const all = [...(logs ?? []), newLog];
  const after = computeRisk(patient, all, asOfFor(all));
  const { data: rs, error: re } = await supabase
    .from("risk_scores")
    .insert({ patient_id: patientId, score: after.score, level: after.level, reasons: after.reasons })
    .select("id")
    .single();
  if (re) throw re;

  let alerted = false;
  if (shouldAlert(before, after)) {
    const { error: ae } = await supabase
      .from("alerts")
      .insert({ patient_id: patientId, risk_score_id: rs.id, message: alertMessage(patient.name, before, after) });
    if (ae) throw ae;
    alerted = true;
  }
  return { before, after, alerted };
}
