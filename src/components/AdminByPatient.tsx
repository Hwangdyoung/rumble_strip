import { useState } from "react";
import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NamePicker, type PickItem } from "@/components/NamePicker";
import { filterPatientRows, staffByRole, type PatientRow } from "@/lib/assignments";
import { cn } from "@/lib/utils";

/**
 * 담당 관리 '환자별' 탭: 환자 한 줄에 담당 의료진을 역할별 글자 줄로(의사·간호사·상담원), 이름으로 찾아 추가, 여러 환자에 한 번에 배정.
 * 의료진 수와 상관없이 열이 늘어나지 않는다. 담당자가 많으면 앞의 3명(연락 담당 먼저)만 보이고 '외 N명'으로 펼친다.
 * 이름에 마우스를 올리거나 키보드로 옮기면 빼기(×)가 나타난다(작은 화면에서는 늘 보임).
 */
export function AdminByPatient({
  rows,
  staffPicks,
  busy,
  onLink,
  onUnlink,
  onBulkLink,
  onContact,
}: {
  rows: PatientRow[];
  /** 담당자 후보 (이름·역할·담당 수) */
  staffPicks: PickItem[];
  busy: boolean;
  onLink: (patientId: string, staffId: string) => void;
  onUnlink: (patientId: string, staffId: string) => void;
  onBulkLink: (patientIds: string[], staffId: string) => void;
  onContact: (patientId: string, staffId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const shown = filterPatientRows(rows, { query, unassignedOnly });
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.id));
  const unassigned = rows.filter((r) => r.staff.length === 0).length;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="환자 이름 찾기" aria-label="환자 이름 찾기" className="h-10 w-56" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={unassignedOnly} onCheckedChange={(v) => setUnassignedOnly(v === true)} aria-label="담당 미배정만 보기" />
          담당 미배정만 <span className={cn("tabular-nums", unassigned > 0 && "font-semibold text-level-risk")}>({unassigned}명)</span>
        </label>
        <span className="ml-auto text-sm text-muted-foreground">{shown.length}/{rows.length}명 표시</span>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-4 py-2.5" role="region" aria-label="선택한 환자">
          <span className="font-semibold">{selected.size}명 선택</span>
          <NamePicker
            items={staffPicks}
            label="선택한 환자에 담당자 추가"
            disabled={busy}
            onPick={(sid) => {
              onBulkLink([...selected], sid);
              setSelected(new Set());
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>선택 해제</Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="w-10 py-2">
                <Checkbox
                  checked={allShownSelected}
                  onCheckedChange={(v) => setSelected(v === true ? new Set([...selected, ...shown.map((r) => r.id)]) : new Set([...selected].filter((id) => !shown.some((r) => r.id === id))))}
                  aria-label="보이는 환자 모두 선택"
                />
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">환자</th>
              <th scope="col" className="py-2 pr-3 font-medium">담당 의료진</th>
              <th scope="col" className="w-44 py-2 font-medium">연락 담당</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">조건에 맞는 환자가 없습니다.</td></tr>
            )}
            {shown.map((p) => (
              <tr key={p.id} className={cn("border-b align-top last:border-0", selected.has(p.id) && "bg-secondary/50")}>
                <td className="py-3">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={(v) => toggle(p.id, v === true)} aria-label={`${p.name} 선택`} />
                </td>
                <th scope="row" className="whitespace-nowrap py-3 pr-3 text-left font-medium">
                  {p.name} <span className="font-normal text-muted-foreground">{p.age}세</span>
                </th>
                <td className="py-2.5 pr-3">
                  <PatientStaffLines
                    row={p}
                    open={expanded.has(p.id)}
                    onOpen={() => setExpanded((prev) => new Set(prev).add(p.id))}
                    busy={busy}
                    onUnlink={(sid) => onUnlink(p.id, sid)}
                  />
                  <div className="mt-1">
                    <NamePicker items={staffPicks} exclude={p.staff.map((s) => s.id)} label="담당자 추가" disabled={busy} onPick={(sid) => onLink(p.id, sid)} />
                  </div>
                </td>
                <td className="py-2.5">
                  {p.staff.length === 0 ? (
                    <span className="text-xs text-muted-foreground">담당자 먼저 지정</span>
                  ) : (
                    <select
                      value={p.contactId ?? ""}
                      disabled={busy}
                      onChange={(e) => onContact(p.id, e.target.value || null)}
                      className={cn("h-8 w-44 max-w-full truncate rounded-md border border-input bg-card px-2", !p.contactId && "text-level-risk")}
                      aria-label={`${p.name} 연락 담당`}
                    >
                      <option value="">없음</option>
                      {p.staff.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SHOW_LIMIT = 3;

/** 담당 의료진: 역할별 한 줄씩, 이름은 ' · '로 잇는다. 연락 담당 이름은 굵게 + '연락'. */
function PatientStaffLines({
  row,
  open,
  onOpen,
  busy,
  onUnlink,
}: {
  row: PatientRow;
  open: boolean;
  onOpen: () => void;
  busy: boolean;
  onUnlink: (staffId: string) => void;
}) {
  if (row.staff.length === 0) return <p className="text-xs font-semibold text-level-risk">담당 미배정</p>;
  const { groups, hidden } = staffByRole(row.staff, open ? undefined : SHOW_LIMIT);
  return (
    <div className="space-y-0.5">
      {groups.map((g) => (
        <p key={g.role} className="flex flex-wrap items-baseline gap-x-1 leading-7">
          <span className="w-12 shrink-0 text-xs text-muted-foreground">{g.role}</span>
          {g.people.map((s, i) => (
            <span key={s.id} className="group inline-flex items-center">
              {i > 0 && <span className="mr-1 text-muted-foreground" aria-hidden>·</span>}
              <span className={cn(s.id === row.contactId && "font-semibold")}>{s.name}</span>
              {s.id === row.contactId && <span className="ml-1 text-xs font-semibold text-primary">연락</span>}
              <button
                type="button"
                disabled={busy}
                onClick={() => onUnlink(s.id)}
                aria-label={`${row.name} 담당에서 ${s.name} 빼기`}
                title="담당에서 빼기"
                className="ml-0.5 grid size-5 place-items-center rounded-full text-muted-foreground opacity-100 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </p>
      ))}
      {hidden > 0 && (
        <button type="button" onClick={onOpen} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
          외 {hidden}명 더 보기
        </button>
      )}
    </div>
  );
}

