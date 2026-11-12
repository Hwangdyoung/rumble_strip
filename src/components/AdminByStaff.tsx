import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NamePicker, type PickItem } from "@/components/NamePicker";
import { CreateStaffAccount, ReissueSetupCode } from "@/components/CreateStaffAccount";
import type { InviteState } from "@/lib/setup-code";
import { filterStaffRows, type PatientItem, type StaffRow } from "@/lib/assignments";
import type { Workload } from "@/lib/workload";
import { STAFF_ROLES, type StaffRole } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * 담당 관리 '의료진별' 탭: 의료진 한 줄에 역할·관리자·맡은 환자 수. 펼치면 담당 환자를 보고 추가·해제한다.
 * 새 계정(담당 0명, 관리자 아님)은 맨 위에 '새 계정'으로 보인다. 계정은 '의료진 계정 만들기'로 만든다(회원가입 없음).
 */
export function AdminByStaff({
  rows,
  patients,
  workload,
  invites,
  myId,
  busy,
  onRole,
  onAdmin,
  onLink,
  onUnlink,
  onCreated,
}: {
  rows: StaffRow[];
  patients: PatientItem[];
  /** 업무량 (SQL 008 함수, 없으면 undefined) */
  workload?: Workload[] | undefined;
  /** 처음 설정 코드 상태 (SQL 010, 줄 없는 사람은 설정 마침) */
  invites?: Record<string, InviteState> | undefined;
  myId: string;
  busy: boolean;
  onRole: (staffId: string, role: StaffRole) => void;
  onAdmin: (staffId: string, on: boolean) => void;
  onLink: (patientId: string, staffId: string) => void;
  onUnlink: (patientId: string, staffId: string) => void;
  /** 계정을 만든 뒤 목록 새로고침 */
  onCreated: () => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const shown = filterStaffRows(rows, { query, role });
  const newCount = rows.filter((r) => r.isNew).length;
  const patientById = new Map(patients.map((p) => [p.id, p]));
  const patientPicks: PickItem[] = patients.map((p) => ({ id: p.id, name: p.name, hint: `${p.age}세` }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="의료진 이름 찾기" aria-label="의료진 이름 찾기" className="h-10 w-56" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="h-10 rounded-md border border-input bg-card px-2 text-sm" aria-label="역할로 거르기">
          <option value="">역할 전체</option>
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {newCount > 0 && <span className="text-sm font-semibold text-level-risk">새 계정 {newCount}명: 담당 환자를 정해 주세요</span>}
        <span className="ml-auto text-sm text-muted-foreground">{shown.length}/{rows.length}명 표시</span>
        <CreateStaffAccount disabled={busy} onCreated={onCreated} />
      </div>
      <p className="text-sm text-muted-foreground">
        새 의료진은 '의료진 계정 만들기'로 초대합니다. 비밀번호를 잊은 경우 '초대 코드 재발급'을 이용하세요.
        역할과 관리자 권한은 관리자만 변경할 수 있습니다.
        상담원은 연락 업무에 필요한 정보(단계·접속 여부·연락 도우미)만 볼 수 있습니다.
      </p>

      <ul className="divide-y rounded-xl border">
        {shown.length === 0 && <li className="p-6 text-center text-muted-foreground">조건에 맞는 의료진이 없습니다.</li>}
        {shown.map((s) => {
          const w = workload?.find((x) => x.staffId === s.id);
          const inv = invites?.[s.id];
          const pending = inv && inv !== "사용함" ? (inv === "대기" ? "활성화 대기" : inv === "잠김" ? "코드 잠김" : "코드 만료") : null;
          const expanded = open === s.id;
          return (
            <li key={s.id} className={cn(s.isNew && "bg-level-caution-soft/40")}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : s.id)}
                  aria-expanded={expanded}
                  className="flex min-w-0 items-center gap-2 text-left"
                >
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", expanded && "rotate-180")} aria-hidden />
                  <span>
                    <span className="font-semibold">{s.name}</span>
                    {s.id === myId && <span className="ml-1.5 text-xs text-muted-foreground">(나)</span>}
                    {s.isNew && <span className="ml-1.5 rounded-full bg-level-caution-soft px-2 py-0.5 text-xs font-semibold text-level-caution-ink">새 계정</span>}
                    {pending && (
                      <span
                        className={cn(
                          "ml-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                          inv === "대기" ? "bg-muted text-muted-foreground" : "bg-level-risk-soft text-level-risk",
                        )}
                        title="아직 계정을 활성화하지 않았습니다"
                      >
                        {pending}
                      </span>
                    )}
                    <span className="block text-sm text-muted-foreground">
                      담당 환자 {s.patientIds.length}명{w ? ` · 연락 담당 ${w.patients}명 · 오늘 할 일 ${w.todo}` : ""}
                    </span>
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-4">
                  {s.id !== myId && <ReissueSetupCode staffId={s.id} name={s.name} disabled={busy} onDone={onCreated} />}
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">역할</span>
                    <select
                      value={s.role}
                      disabled={busy}
                      onChange={(e) => onRole(s.id, e.target.value as StaffRole)}
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
                      disabled={busy || s.id === myId}
                      onCheckedChange={(v) => onAdmin(s.id, v)}
                      aria-label={`${s.name} 관리자 권한`}
                    />
                  </label>
                </div>
              </div>
              {expanded && (
                <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/40 px-4 py-3">
                  {s.patientIds.length === 0 && <span className="text-sm text-muted-foreground">담당 환자가 없습니다.</span>}
                  {s.patientIds
                    .map((id) => patientById.get(id))
                    .filter((p): p is PatientItem => Boolean(p))
                    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
                    .map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pl-2.5 pr-1 text-sm">
                        {p.name} <span className="text-xs text-muted-foreground">{p.age}세</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onUnlink(p.id, s.id)}
                          aria-label={`${s.name} 담당에서 ${p.name} 빼기`}
                          className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  <NamePicker items={patientPicks} exclude={s.patientIds} label="환자 추가" placeholder="환자 이름으로 찾기" disabled={busy} onPick={(pid) => onLink(pid, s.id)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
