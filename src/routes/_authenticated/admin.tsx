import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import {
  assignmentsQuery,
  linkPatientsToStaff,
  myStaffQuery,
  setPatientContact,
  setPatientStaff,
  staffListQuery,
  setupInvitesQuery,
  staffWorkloadQuery,
  updateStaff,
  type StaffRole,
} from "@/lib/queries";
import { patientRows, patientsToLink, staffRows } from "@/lib/assignments";
import { AdminByPatient } from "@/components/AdminByPatient";
import { AdminByStaff } from "@/components/AdminByStaff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "담당 관리 | 이탈방지턱" },
      { name: "description", content: "관리자가 환자별 담당 의료진을 배정합니다." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const me = useQuery(myStaffQuery());
  if (me.isPending) return <p className="py-12 text-center text-muted-foreground" role="status">불러오는 중…</p>;
  if (!me.data?.staff?.is_admin) {
    return (
      <div className="space-y-2 py-12 text-center">
        <p className="font-semibold">관리자만 볼 수 있는 화면입니다.</p>
        <p className="text-muted-foreground">담당 환자 배정이 필요하면 관리자에게 요청하세요.</p>
      </div>
    );
  }
  return <AdminContent myId={me.data.staff.id} />;
}

type Tab = "patients" | "staff";

/**
 * 담당 관리. 의료진·환자가 많아져도 쓰도록 표(의료진 = 열) 대신 탭 2개로 나눈다.
 * - 환자별: 환자 한 줄에 담당자 이름표, 이름 검색으로 추가, 여러 환자에 한 번에 배정, 연락 담당
 * - 의료진별: 계정 만들기, 역할·관리자 설정, 담당 환자 펼쳐 보기·추가·해제, 새 계정 먼저
 */
function AdminContent({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const staff = useQuery(staffListQuery());
  const asg = useQuery(assignmentsQuery());
  const workload = useQuery(staffWorkloadQuery());
  const invites = useQuery(setupInvitesQuery());
  const [tab, setTab] = useState<Tab>("patients");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["assignments"] });
    qc.invalidateQueries({ queryKey: ["patient-staff"] });
    qc.invalidateQueries({ queryKey: ["staff"] });
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };
  const link = useMutation({
    mutationFn: (v: { patientId: string; staffId: string; on: boolean }) => setPatientStaff(v.patientId, v.staffId, v.on),
    onSuccess: refresh,
    onError: () => toast.error("담당을 바꾸지 못했습니다. 다시 시도해 주세요."),
  });
  const bulk = useMutation({
    mutationFn: (v: { patientIds: string[]; staffId: string }) => linkPatientsToStaff(v.patientIds, v.staffId),
    onSuccess: (_d, v) => {
      refresh();
      toast.success(v.patientIds.length > 0 ? `환자 ${v.patientIds.length}명에게 담당자를 추가했습니다.` : "선택한 환자는 이미 그 사람이 담당입니다.");
    },
    onError: () => toast.error("담당을 추가하지 못했습니다. 다시 시도해 주세요."),
  });
  const contact = useMutation({
    mutationFn: (v: { patientId: string; staffId: string | null }) => setPatientContact(v.patientId, v.staffId),
    onSuccess: refresh,
    onError: () => toast.error("연락 담당을 바꾸지 못했습니다. 다시 시도해 주세요."),
  });
  const upd = useMutation({
    mutationFn: (v: { staffId: string; role?: StaffRole; is_admin?: boolean }) =>
      updateStaff(v.staffId, { ...(v.role ? { role: v.role } : {}), ...(v.is_admin !== undefined ? { is_admin: v.is_admin } : {}) }),
    onSuccess: refresh,
    onError: () => toast.error("의료진 정보를 바꾸지 못했습니다."),
  });

  if (staff.isPending || asg.isPending) return <p className="py-12 text-center text-muted-foreground" role="status">불러오는 중…</p>;
  if (staff.isError || asg.isError) return <p className="py-12 text-center">정보를 불러오지 못했습니다.</p>;

  const links = asg.data.links;
  const pRows = patientRows(asg.data.patients, links, staff.data);
  const sRows = staffRows(staff.data, links);
  const staffPicks = sRows.map((s) => ({ id: s.id, name: s.name, hint: `${s.role} · 담당 ${s.patientIds.length}명` }));
  const busy = link.isPending || bulk.isPending || contact.isPending || upd.isPending;
  const unassigned = pRows.filter((r) => r.staff.length === 0).length;
  const newStaff = sRows.filter((r) => r.isNew).length;
  const TABS: Array<{ id: Tab; label: string; count: number; warn: number }> = [
    { id: "patients", label: "환자별", count: pRows.length, warn: unassigned },
    { id: "staff", label: "의료진별", count: sRows.length, warn: newStaff },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">담당 관리</h1>
        <p className="mt-1 text-muted-foreground">
          환자마다 담당 의료진을 정합니다. 담당자는 자기 담당 환자만 볼 수 있고, 관리자는 모든 환자를 봅니다.
          연락 담당을 정해 두면 매일 점검이 만든 알림이 그 사람에게 자동으로 배정됩니다.
        </p>
      </div>

      <div role="tablist" aria-label="담당 관리 보기" className="flex gap-1 rounded-xl border bg-card p-1 shadow-card sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label} <span className="tabular-nums opacity-80">{t.count}</span>
            {t.warn > 0 && (
              <span className="ml-1.5 rounded-full bg-level-risk px-1.5 py-0.5 text-xs text-primary-foreground tabular-nums" aria-label={t.id === "patients" ? `담당 미배정 ${t.warn}명` : `새 계정 ${t.warn}명`}>
                {t.warn}
              </span>
            )}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-card" role="tabpanel" aria-label={tab === "patients" ? "환자별 담당" : "의료진별 담당"}>
        {tab === "patients" ? (
          <AdminByPatient
            rows={pRows}
            staffPicks={staffPicks}
            busy={busy}
            onLink={(patientId, staffId) => link.mutate({ patientId, staffId, on: true })}
            onUnlink={(patientId, staffId) => link.mutate({ patientId, staffId, on: false })}
            onBulkLink={(ids, staffId) => bulk.mutate({ patientIds: patientsToLink(ids, staffId, links), staffId })}
            onContact={(patientId, staffId) => contact.mutate({ patientId, staffId })}
          />
        ) : (
          <AdminByStaff
            rows={sRows}
            patients={asg.data.patients}
            workload={workload.data}
            invites={invites.data}
            myId={myId}
            busy={busy}
            onRole={(staffId, role) => upd.mutate({ staffId, role })}
            onAdmin={(staffId, on) => upd.mutate({ staffId, is_admin: on })}
            onLink={(patientId, staffId) => link.mutate({ patientId, staffId, on: true })}
            onUnlink={(patientId, staffId) => link.mutate({ patientId, staffId, on: false })}
            onCreated={refresh}
          />
        )}
      </section>
    </div>
  );
}
