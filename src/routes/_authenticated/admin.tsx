import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  assignmentsQuery,
  myStaffQuery,
  setPatientContact,
  setPatientStaff,
  STAFF_ROLES,
  staffListQuery,
  updateStaff,
  type StaffRole,
} from "@/lib/queries";

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

function AdminContent({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const staff = useQuery(staffListQuery());
  const asg = useQuery(assignmentsQuery());

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

  const linked = new Set(asg.data.links.map((l) => `${l.patient_id}:${l.staff_id}`));
  const countByStaff = new Map<string, number>();
  for (const l of asg.data.links) countByStaff.set(l.staff_id, (countByStaff.get(l.staff_id) ?? 0) + 1);
  const unassigned = asg.data.patients.filter((p) => !asg.data.links.some((l) => l.patient_id === p.id)).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">담당 관리</h1>
        <p className="mt-1 text-muted-foreground">
          환자마다 담당 의료진을 정합니다. 담당자는 자기 담당 환자만 볼 수 있고, 관리자는 모든 환자를 봅니다.
          연락 담당을 정해 두면 매일 점검이 만든 알림이 그 사람에게 자동으로 배정됩니다.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-card" aria-label="환자별 담당자">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">환자별 담당자</h2>
          <p className="text-sm text-muted-foreground">
            환자 {asg.data.patients.length}명 · 담당 미배정 <span className={unassigned > 0 ? "font-semibold text-level-risk" : ""}>{unassigned}명</span>
          </p>
        </div>
        {staff.data.length === 0 ? (
          <p className="text-muted-foreground">등록된 의료진이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="py-2 pr-4 font-medium text-muted-foreground">환자</th>
                  {staff.data.map((s) => (
                    <th key={s.id} scope="col" className="min-w-20 px-2 py-2 text-center font-medium">
                      <div>{s.name}</div>
                      <div className="text-xs font-normal text-muted-foreground">{s.role}</div>
                    </th>
                  ))}
                  <th scope="col" className="min-w-32 px-2 py-2 text-left font-medium">
                    <div>연락 담당</div>
                    <div className="text-xs font-normal text-muted-foreground">알림 자동 배정</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {asg.data.patients.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                      {p.name} <span className="font-normal text-muted-foreground">{p.age}세</span>
                    </th>
                    {staff.data.map((s) => {
                      const on = linked.has(`${p.id}:${s.id}`);
                      return (
                        <td key={s.id} className="px-2 py-2.5 text-center">
                          <Checkbox
                            checked={on}
                            disabled={link.isPending}
                            aria-label={`${p.name} 담당: ${s.name}`}
                            onCheckedChange={(v) => link.mutate({ patientId: p.id, staffId: s.id, on: v === true })}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-2.5">
                      {(() => {
                        const mine = asg.data.links.filter((l) => l.patient_id === p.id);
                        const cur = mine.find((l) => l.is_contact)?.staff_id ?? "";
                        if (mine.length === 0) return <span className="text-xs text-muted-foreground">담당자 먼저 지정</span>;
                        return (
                          <select
                            value={cur}
                            disabled={contact.isPending}
                            onChange={(e) => contact.mutate({ patientId: p.id, staffId: e.target.value || null })}
                            className={"h-8 rounded-md border border-input bg-card px-2 " + (cur ? "" : "text-level-risk")}
                            aria-label={`${p.name} 연락 담당`}
                          >
                            <option value="">없음</option>
                            {mine.map((l) => {
                              const st = staff.data.find((x) => x.id === l.staff_id);
                              return st ? <option key={st.id} value={st.id}>{st.name} ({st.role})</option> : null;
                            })}
                          </select>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-card" aria-label="의료진">
        <h2 className="text-lg font-bold">의료진</h2>
        <p className="text-sm text-muted-foreground">
          새로 가입한 의료진은 처음 로그인해 이름과 역할을 입력해야 이 목록에 나타납니다. 관리자 권한은 여기서만 바꿀 수 있습니다.
        </p>
        <ul className="divide-y">
          {staff.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <span className="font-semibold">{s.name}</span>
                {s.id === myId && <span className="ml-2 text-xs text-muted-foreground">(나)</span>}
                <div className="text-sm text-muted-foreground">담당 환자 {countByStaff.get(s.id) ?? 0}명</div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">역할</span>
                  <select
                    value={s.role}
                    disabled={upd.isPending}
                    onChange={(e) => upd.mutate({ staffId: s.id, role: e.target.value as StaffRole })}
                    className="h-9 rounded-md border border-input bg-card px-2"
                    aria-label={`${s.name} 역할`}
                  >
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">관리자</span>
                  <Switch
                    checked={s.is_admin}
                    // 자기 관리자 권한은 스스로 끄지 못하게 (관리자가 아무도 없게 되는 것 방지)
                    disabled={upd.isPending || s.id === myId}
                    onCheckedChange={(v) => upd.mutate({ staffId: s.id, is_admin: v })}
                    aria-label={`${s.name} 관리자 권한`}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
