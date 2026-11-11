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

// ─── 의료진·담당 환자 ─────────────────────────────────────────────────────────
// 실제 접근 제한은 DB 정책(RLS)이 한다: 관리자는 전체, 그 외에는 patient_staff에 연결된 환자만 보인다.

export const STAFF_ROLES = ["의사", "간호사", "상담원"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type Staff = { id: string; name: string; role: string; is_admin: boolean };

/** 로그인한 사람의 의료진 정보. 아직 입력하지 않았으면 staff는 null */
export const myStaffQuery = () =>
  queryOptions({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { userId: null, email: null, staff: null as Staff | null };
      const { data, error } = await supabase.from("staff").select("id, name, role, is_admin").eq("id", u.user.id).maybeSingle();
      if (error) throw error;
      return { userId: u.user.id, email: u.user.email ?? null, staff: (data ?? null) as Staff | null };
    },
    staleTime: 5 * 60_000,
  });

export const staffListQuery = () =>
  queryOptions({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, name, role, is_admin").order("name");
      if (error) throw error;
      return (data ?? []) as Staff[];
    },
  });

/** 한 환자의 담당자 목록 */
export const patientStaffQuery = (patientId: string) =>
  queryOptions({
    queryKey: ["patient-staff", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_staff")
        .select("staff_id, staff(id, name, role, is_admin)")
        .eq("patient_id", patientId);
      if (error) throw error;
      return (data ?? []).map((r) => r.staff).filter((s): s is Staff => Boolean(s));
    },
  });

/** 관리자 화면: 전체 환자와 담당 연결 */
export const assignmentsQuery = () =>
  queryOptions({
    queryKey: ["assignments"],
    queryFn: async () => {
      const [p, ps] = await Promise.all([
        supabase.from("patients").select("id, name, age").order("name"),
        supabase.from("patient_staff").select("patient_id, staff_id"),
      ]);
      if (p.error) throw p.error;
      if (ps.error) throw ps.error;
      return { patients: p.data ?? [], links: ps.data ?? [] };
    },
  });

/** 내 정보 저장 (처음이면 만들고, 있으면 이름·역할만 고침. 관리자 여부는 바꾸지 않음) */
export async function saveMyStaff(name: string, role: StaffRole) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("로그인이 필요합니다.");
  const { data: existing, error: e1 } = await supabase.from("staff").select("id").eq("id", u.user.id).maybeSingle();
  if (e1) throw e1;
  const { error } = existing
    ? await supabase.from("staff").update({ name, role }).eq("id", u.user.id)
    : await supabase.from("staff").insert({ id: u.user.id, name, role });
  if (error) throw error;
}

/** 관리자: 환자 담당 연결/해제 */
export async function setPatientStaff(patientId: string, staffId: string, assigned: boolean) {
  const { error } = assigned
    ? await supabase.from("patient_staff").insert({ patient_id: patientId, staff_id: staffId })
    : await supabase.from("patient_staff").delete().eq("patient_id", patientId).eq("staff_id", staffId);
  if (error && !(assigned && error.code === "23505")) throw error; // 이미 연결돼 있으면 무시
}

/** 관리자: 의료진 역할·관리자 여부 변경 */
export async function updateStaff(staffId: string, patch: { role?: StaffRole; is_admin?: boolean }) {
  const { error } = await supabase.from("staff").update(patch).eq("id", staffId);
  if (error) throw error;
}
