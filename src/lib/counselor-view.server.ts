/**
 * 상담원 화면용 서버 함수 (SQL 009 이후 상담원은 플레이 원본·알림을 DB에서 직접 읽지 못한다).
 *
 * - 환자 목록·연락 기록·다음 연락·담당은 로그인한 사용자 권한(RLS)으로 읽는다. 그래서 담당 환자만 나온다.
 * - 플레이 원본과 알림은 그 환자들에 한해서만 관리자 클라이언트로 읽고, 서버 안에서 risk.ts로 계산한다.
 * - 돌려주는 것은 단계, 접속 관련 이유, 접속한 날짜, 연락 도우미 문장, 단계만 담은 알림뿐이다.
 *   점수 숫자, 정확도·반응 속도·세션 시간, 저장된 알림 문구는 브라우저로 보내지 않는다.
 * - 관리자 클라이언트(client.server.ts)와 process.env는 핸들러 안에서만 쓴다.
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildContactList, type ContactRow } from "@/lib/contact-list";
import { toCounselorAlert, toCounselorRow, type CounselorAlert, type CounselorPatient } from "@/lib/counselor-view";
import { koreaNow } from "@/lib/daily-check";
import { buildGuide } from "@/lib/response-guide";
import { asOfFor, computeRisk, toDateKey, weeklySummary } from "@/lib/risk";
import { counselorReasons } from "@/lib/roles";

/** 의료진으로 등록된 사람만 부를 수 있다 */
async function requireStaff(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db.from("staff").select("id, name, role, is_admin").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("의료진 정보가 없습니다.");
  return data;
}

const ALERT_COLS = "id, patient_id, created_at, status, outcome, outcome_at, outcome_note, alert_level, assignee_id";

/** 대시보드 목록 (상담원용). threshold: 오늘 연락 기준 점수 (설정값) */
export const fetchCounselorBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => {
    const t = Number((d as { threshold?: unknown } | null)?.threshold);
    return { threshold: Number.isFinite(t) ? Math.min(100, Math.max(0, t)) : 30 };
  })
  .handler(async ({ data, context }): Promise<ContactRow[]> => {
    const db = context.supabase;
    await requireStaff(db, context.userId);
    const { data: patients, error } = await db.from("patients").select("*").order("name");
    if (error) throw error;
    const ids = (patients ?? []).map((p) => p.id);
    if (ids.length === 0) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [logs, al, fu, ac, ps] = await Promise.all([
      supabaseAdmin.from("play_logs").select("patient_id, session_start, play_minutes, accuracy, reaction_ms").in("patient_id", ids),
      supabaseAdmin.from("alerts").select(ALERT_COLS).in("patient_id", ids),
      db.from("follow_ups").select("patient_id, due_date").is("done_at", null),
      db.from("actions").select("patient_id, created_at").order("created_at", { ascending: false }),
      db.from("patient_staff").select("patient_id, staff_id").eq("is_contact", true),
    ]);
    for (const r of [logs, al, fu, ac, ps]) if (r.error) throw r.error;

    const now = koreaNow();
    const withRisk = (patients ?? []).map((p) => {
      const own = (logs.data ?? []).filter((l) => l.patient_id === p.id);
      return { id: p.id, name: p.name, age: p.age, risk: computeRisk(p, own, asOfFor(own, now)) };
    });
    const lastActionAt: Record<string, string> = {};
    for (const a of ac.data ?? []) if (!lastActionAt[a.patient_id]) lastActionAt[a.patient_id] = a.created_at;
    const contactOf: Record<string, string> = {};
    for (const c of ps.data ?? []) contactOf[c.patient_id] = c.staff_id;

    const rows = buildContactList({
      patients: withRisk,
      threshold: data.threshold,
      alerts: al.data ?? [],
      followUps: fu.data ?? [],
      lastActionAt,
      contactOf,
      now,
      includeAll: true,
    });
    const reasonsOf = new Map(withRisk.map((p) => [p.id, counselorReasons(p.risk.reasons)]));
    return rows.map((r) => toCounselorRow(r, reasonsOf.get(r.patientId) ?? []));
  });

/** 종 아이콘 '새로 나빠진 환자' (상담원용, 최근 30건) */
export const fetchCounselorAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CounselorAlert[]> => {
    const db = context.supabase;
    await requireStaff(db, context.userId);
    const { data: patients, error } = await db.from("patients").select("id, name");
    if (error) throw error;
    const names = new Map((patients ?? []).map((p) => [p.id, p.name]));
    if (names.size === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: al, error: ae } = await supabaseAdmin
      .from("alerts")
      .select(ALERT_COLS)
      .in("patient_id", [...names.keys()])
      .order("created_at", { ascending: false })
      .limit(30);
    if (ae) throw ae;
    return (al ?? []).map((a) => toCounselorAlert(a, names.get(a.patient_id) ?? null));
  });

/** 환자 상세 (상담원용). 볼 수 없는 환자면 null */
export const fetchCounselorPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => {
    const id = (d as { patientId?: unknown } | null)?.patientId;
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("환자 id가 올바르지 않습니다.");
    return { patientId: id };
  })
  .handler(async ({ data, context }): Promise<CounselorPatient | null> => {
    const db = context.supabase;
    const me = await requireStaff(db, context.userId);
    // 사용자 권한으로 읽어서 담당 환자인지 확인한다 (아니면 null)
    const { data: p, error } = await db.from("patients").select("*").eq("id", data.patientId).maybeSingle();
    if (error) throw error;
    if (!p) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [logs, al, ac, fu] = await Promise.all([
      supabaseAdmin.from("play_logs").select("patient_id, session_start, play_minutes, accuracy, reaction_ms").eq("patient_id", p.id).order("session_start"),
      supabaseAdmin.from("alerts").select(ALERT_COLS).eq("patient_id", p.id).order("created_at", { ascending: false }),
      db.from("actions").select("id, action_type, memo, created_at, staff_id").eq("patient_id", p.id).order("created_at", { ascending: false }),
      db.from("follow_ups").select("id, due_date, assignee_id, note").eq("patient_id", p.id).is("done_at", null).order("due_date"),
    ]);
    for (const r of [logs, al, ac, fu]) if (r.error) throw r.error;

    const own = logs.data ?? [];
    const risk = computeRisk(p, own, asOfFor(own, koreaNow()));
    const weeks = weeklySummary(p, own);
    const alerts = (al.data ?? []).map((a) => toCounselorAlert(a, p.name));
    const followUps = fu.data ?? [];
    const guide = buildGuide({
      risk,
      patientName: p.name,
      weeklyTargetDays: p.weekly_target_days,
      sessionTargetMinutes: p.session_target_minutes,
      unreachable: alerts.some((a) => a.status !== "조치완료" && a.outcome === "연락 불가"),
      staffName: me.name,
    });
    const playedDates = [...new Set(own.filter((l) => l.play_minutes > 0).map((l) => toDateKey(new Date(l.session_start))))].sort();

    return {
      patient: {
        id: p.id,
        name: p.name,
        age: p.age,
        prescription_start_date: p.prescription_start_date,
        prescription_weeks: p.prescription_weeks,
        weekly_target_days: p.weekly_target_days,
        session_target_minutes: p.session_target_minutes,
      },
      level: risk.level,
      reasons: counselorReasons(risk.reasons),
      lastPlayDate: risk.metrics.lastPlayDate,
      playedDates,
      guide,
      sheet: {
        patientName: p.name,
        age: p.age,
        prescriptionStartDate: p.prescription_start_date,
        prescriptionWeeks: p.prescription_weeks,
        weeklyTargetDays: p.weekly_target_days,
        sessionTargetMinutes: p.session_target_minutes,
        adherence: risk.metrics.adherence,
        recentDays: risk.metrics.recentDays,
        currentGap: risk.metrics.currentGap,
        sessionsDone: risk.metrics.sessionsDone,
        sessionsExpected: risk.metrics.sessionsExpected,
        weeks,
        notes: guide.plainSummary,
        staffName: me.name,
        nextContactDate: followUps[0]?.due_date ?? null,
      },
      alerts,
      actions: (ac.data ?? []).map((a) => ({ ...a, memo: a.memo ?? null, staff_id: a.staff_id ?? null })),
      followUps,
    };
  });
