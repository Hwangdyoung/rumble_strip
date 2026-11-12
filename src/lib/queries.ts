import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asOfFor, computeRisk } from "./risk";
import { koreaNow } from "./daily-check";
import { runDailyCheckWith } from "./daily-check-run";
import { suggestOutcome, type AlertOutcome } from "./alert-outcome";
import type { Workload } from "./workload";

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
      const [p, logs, actions, alerts, follow] = await Promise.all([
        supabase.from("patients").select("*").eq("id", id).maybeSingle(),
        supabase.from("play_logs").select("*").eq("patient_id", id).order("session_start"),
        supabase.from("actions").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
        supabase.from("alerts").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
        supabase.from("follow_ups").select("*").eq("patient_id", id).is("done_at", null).order("due_date"),
      ]);
      for (const r of [p, logs, actions, alerts, follow]) if (r.error) throw r.error;
      return { patient: p.data, logs: logs.data ?? [], actions: actions.data ?? [], alerts: alerts.data ?? [], followUps: follow.data ?? [] };
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
  // 조치완료가 되면 처리 시각을 남기고, 다른 상태로 되돌리면 지운다
  const resolved_at = status === "조치완료" ? new Date().toISOString() : null;
  const { error } = await supabase.from("alerts").update({ status, resolved_at }).eq("id", id);
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
export type Staff = { id: string; name: string; role: string; is_admin: boolean; is_contact?: boolean };

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
        .select("staff_id, is_contact, staff(id, name, role, is_admin)")
        .eq("patient_id", patientId);
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.staff)
        .map((r) => ({ ...(r.staff as Staff), is_contact: r.is_contact }))
        .sort((a, b) => Number(b.is_contact) - Number(a.is_contact));
    },
  });

/** 관리자 화면: 전체 환자와 담당 연결 */
export const assignmentsQuery = () =>
  queryOptions({
    queryKey: ["assignments"],
    queryFn: async () => {
      const [p, ps] = await Promise.all([
        supabase.from("patients").select("id, name, age").order("name"),
        supabase.from("patient_staff").select("patient_id, staff_id, is_contact"),
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

// ─── 알림 담당자·오늘 처리 목록 ──────────────────────────────────────────────

/** 대시보드 '오늘 처리할 알림': 처리 안 된 알림 + 오늘 처리 완료된 알림 */
export const worklistQuery = () =>
  queryOptions({
    queryKey: ["alerts", "worklist"],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("alerts")
        .select("id, patient_id, created_at, status, alert_level, alert_score, assignee_id, resolved_at, patients(name), alert_handoffs(from_staff, to_staff, reason, note, created_at)")
        .or(`status.neq.조치완료,resolved_at.gte.${start.toISOString()}`)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id,
        patient_id: a.patient_id,
        patient_name: a.patients?.name ?? "",
        created_at: a.created_at,
        status: a.status,
        alert_level: a.alert_level,
        alert_score: a.alert_score,
        assignee_id: a.assignee_id,
        resolved_at: a.resolved_at,
        // 지금 담당자에게 마지막으로 넘겨진 기록 (넘겨받은 알림 표시용)
        handoff:
          (a.alert_handoffs ?? [])
            .filter((h) => h.to_staff === a.assignee_id)
            .sort((x, y) => (x.created_at < y.created_at ? 1 : -1))[0] ?? null,
      }));
    },
    refetchInterval: 60_000,
  });

/** 알림 담당자 지정 (null이면 미지정) */
export async function setAlertAssignee(alertId: string, staffId: string | null) {
  const { error } = await supabase
    .from("alerts")
    .update({ assignee_id: staffId, assigned_at: staffId ? new Date().toISOString() : null })
    .eq("id", alertId);
  if (error) throw error;
}

/** 관리자: 환자의 연락 담당 지정 (null이면 해제). 환자당 1명이라 먼저 기존 표시를 지운다.
 *  지정하면 그 환자의 처리 안 된 미지정 알림도 배정한다. */
export async function setPatientContact(patientId: string, staffId: string | null) {
  const { error: e1 } = await supabase.from("patient_staff").update({ is_contact: false }).eq("patient_id", patientId).eq("is_contact", true);
  if (e1) throw e1;
  if (!staffId) return;
  const { error: e2 } = await supabase.from("patient_staff").update({ is_contact: true }).eq("patient_id", patientId).eq("staff_id", staffId);
  if (e2) throw e2;
  // 이 환자의 처리 안 된 알림 중 담당자가 없는 것도 연락 담당에게 배정 (이미 누가 맡은 알림은 그대로)
  const { error: e3 } = await supabase
    .from("alerts")
    .update({ assignee_id: staffId, assigned_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .is("assignee_id", null)
    .neq("status", "조치완료");
  if (e3) throw e3;
}

/** 설정 → 데이터: 알림 결과 내보내기용 (볼 수 있는 환자의 알림 전체) */
export async function fetchAlertExport() {
  const { data, error } = await supabase
    .from("alerts")
    .select("created_at, alert_score, alert_level, status, outcome, outcome_at, outcome_note, resolved_at, patients(name), assignee:staff!alerts_assignee_id_fkey(name)")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

// ─── 알림 넘기기·다음 연락 일정 ──────────────────────────────────────────────

export const HANDOFF_REASONS = ["인계", "의사 확인 요청", "기타"] as const;
export type HandoffReason = (typeof HANDOFF_REASONS)[number];

/** 한 환자의 알림 넘긴 기록 (오래된 순) */
export const alertHandoffsQuery = (patientId: string) =>
  queryOptions({
    queryKey: ["alerts", "handoffs", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_handoffs")
        .select("id, alert_id, from_staff, to_staff, reason, note, created_at")
        .eq("patient_id", patientId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

/** 알림 넘기기: 기록을 남기고 알림 담당자를 받는 사람으로 바꾼다 */
export async function handoffAlert(v: { alertId: string; patientId: string; toStaff: string; reason: HandoffReason; note: string }) {
  const { error } = await supabase
    .from("alert_handoffs")
    .insert({ alert_id: v.alertId, patient_id: v.patientId, to_staff: v.toStaff, reason: v.reason, note: v.note.trim() });
  if (error) throw error;
  await setAlertAssignee(v.alertId, v.toStaff);
}

/** 열린 다음 연락 일정 전체 (볼 수 있는 환자만) */
export const followUpsQuery = () =>
  queryOptions({
    queryKey: ["alerts", "follow-ups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("id, patient_id, alert_id, due_date, assignee_id, note, done_at, patients(name)")
        .is("done_at", null)
        .order("due_date");
      if (error) throw error;
      return (data ?? []).map((f) => ({ ...f, patient_name: f.patients?.name ?? "" }));
    },
    refetchInterval: 60_000,
  });

export async function createFollowUp(v: { patientId: string; alertId: string | null; dueDate: string; assigneeId: string | null; note?: string }) {
  const { error } = await supabase
    .from("follow_ups")
    .insert({ patient_id: v.patientId, alert_id: v.alertId, due_date: v.dueDate, assignee_id: v.assigneeId, note: v.note ?? "" });
  if (error) throw error;
}

export async function completeFollowUps(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.from("follow_ups").update({ done_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
}

// ─── 재배치: 환자 단위 담당·오늘 연락할 환자 ────────────────────────────────

/** 내가 맡기: 환자의 연락 담당을 나로 (DB 함수 take_patient, SQL 007) */
export async function takePatient(patientId: string) {
  const { error } = await supabase.rpc("take_patient", { pid: patientId });
  if (error) throw error;
}

/** 넘기기: 환자의 연락 담당을 다른 담당자에게, 기록을 남김 (DB 함수 handoff_patient, SQL 007) */
export async function handoffPatient(v: { patientId: string; toStaff: string; reason: HandoffReason; note: string }) {
  const { error } = await supabase.rpc("handoff_patient", { pid: v.patientId, to_staff: v.toStaff, reason: v.reason, note: v.note.trim() });
  if (error) throw error;
}

/**
 * 담당자별 업무량 (DB 함수 staff_workload, SQL 008). 사람별 건수만 받고 환자 정보는 받지 않는다.
 * 일반 의료진도 팀 전체 숫자를 정확히 본다(RLS 때문에 직접 세면 자기 담당만 보임).
 * SQL 008을 실행하기 전이면 에러 → 화면은 업무량만 숨기고 나머지는 그대로 동작한다.
 */
export const staffWorkloadQuery = () =>
  queryOptions({
    queryKey: ["alerts", "workload"],
    queryFn: async (): Promise<Workload[]> => {
      const { data, error } = await supabase.rpc("staff_workload");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        staffId: r.staff_id,
        name: r.staff_name,
        role: r.staff_role,
        patients: r.patients,
        newWorse: r.new_worse,
        followDue: r.follow_due,
        todo: r.todo,
      }));
    },
    retry: false,
    refetchInterval: 60_000,
  });

/** '오늘 연락할 환자' 목록 재료: 알림, 열린 다음 연락, 마지막 조치, 연락 담당 */
export const contactListQuery = () =>
  queryOptions({
    queryKey: ["alerts", "contact-list"],
    queryFn: async () => {
      const [al, fu, ac, ps] = await Promise.all([
        supabase.from("alerts").select("id, patient_id, created_at, status, outcome, outcome_at"),
        supabase.from("follow_ups").select("patient_id, due_date").is("done_at", null),
        supabase.from("actions").select("patient_id, created_at").order("created_at", { ascending: false }),
        supabase.from("patient_staff").select("patient_id, staff_id").eq("is_contact", true),
      ]);
      for (const r of [al, fu, ac, ps]) if (r.error) throw r.error;
      const lastActionAt: Record<string, string> = {};
      for (const a of ac.data ?? []) if (!lastActionAt[a.patient_id]) lastActionAt[a.patient_id] = a.created_at;
      const contactOf: Record<string, string> = {};
      for (const c of ps.data ?? []) contactOf[c.patient_id] = c.staff_id;
      return { alerts: al.data ?? [], followUps: fu.data ?? [], lastActionAt, contactOf };
    },
    refetchInterval: 60_000,
  });
