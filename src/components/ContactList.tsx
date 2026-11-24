import { LevelBadge, levelStyles } from "@/components/LevelBadge";
import type { ContactRow, ContactStatus } from "@/lib/contact-list";
import { cn } from "@/lib/utils";

/** 상태는 색 배지 대신 글자 굵기·색으로만 구분한다 (한 줄에 색 이름표가 몰리지 않게). 손이 가야 하는 상태만 진하게. */
const STATUS_STYLE: Record<ContactStatus, string> = {
  "다시 연락": "font-semibold text-foreground",
  "연락 전": "font-semibold text-foreground",
  "연락 불가": "font-semibold text-level-risk",
  "연락 예정": "text-muted-foreground",
  연락함: "text-level-normal",
  "경과 관찰": "text-muted-foreground",
};

const md = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;

export function statusLabel(r: Pick<ContactRow, "status" | "statusDate">) {
  if (r.status === "연락 예정" && r.statusDate) return `${md(r.statusDate)} 연락 예정`;
  if (r.status === "연락함" && r.statusDate) return `연락함 ${md(r.statusDate)}`;
  return r.status;
}

/** 대시보드 '오늘 연락할 환자' 목록. 환자 한 줄 = 할 일 하나. */
export function ContactList({
  rows,
  nameOf,
  selectedId,
  onSelect,
  compact,
  picking,
}: {
  rows: ContactRow[];
  nameOf: (id: string | null) => string;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  compact: boolean;
  /** 여러 명 넘기기: 고른 환자와 고를 수 있는 환자(내가 연락 담당) */
  picking?: { picked: Set<string>; selectable: Set<string>; onToggle: (id: string) => void } | undefined;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-8 text-center text-muted-foreground">해당하는 환자가 없습니다.</p>;
  }
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.patientId} className={cn(picking && "flex items-stretch")}>
          {picking && (
            <label className="flex shrink-0 cursor-pointer items-center pl-4" title={picking.selectable.has(r.patientId) ? undefined : "내가 연락 담당인 환자만 고를 수 있습니다"}>
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={picking.picked.has(r.patientId)}
                disabled={!picking.selectable.has(r.patientId)}
                onChange={() => picking.onToggle(r.patientId)}
                aria-label={`${r.name} 선택`}
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => onSelect(r.patientId)}
            aria-current={selectedId === r.patientId ? "true" : undefined}
            className={cn(
              "relative grid w-full min-w-0 items-center gap-x-4 gap-y-1.5 py-3.5 pl-6 pr-5 text-left transition-colors hover:bg-muted",
              compact ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]",
              selectedId === r.patientId && "bg-secondary hover:bg-secondary",
              !r.needsAction && "opacity-70",
            )}
          >
            {/* 방지턱 띠: 단계가 급할수록 진한 색. 고른 줄은 띠 대신 진한 파란 막대 */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-2.5 left-2.5 w-1 rounded-full",
                selectedId === r.patientId ? "bg-primary" : cn("rumble-strip", levelStyles[r.level].strip),
              )}
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">{r.name}</span>
                {r.newWorseAt && <span className="rounded-full border border-level-risk/40 px-2 py-px text-[0.8rem] font-semibold text-level-risk">새로 나빠짐</span>}
                {r.followDue && (
                  <span className="text-[0.8rem] font-medium text-muted-foreground">
                    · {r.followDue.overdueDays > 0 ? `다시 연락 ${r.followDue.overdueDays}일 지남` : "오늘 다시 연락"}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted-foreground">{r.reason}</span>
            </span>
            {compact ? (
              <span className="flex flex-col items-end gap-1">
                <LevelBadge level={r.level} />
                <span className={cn("text-sm", STATUS_STYLE[r.status])}>{statusLabel(r)}</span>
              </span>
            ) : (
              <>
                <span className="justify-self-end md:justify-self-start">
                  <LevelBadge level={r.level} />
                  {r.score !== null && <span className="ml-2 text-sm font-medium tabular-nums text-muted-foreground">{r.score}점</span>}
                </span>
                <span className="col-span-2 flex items-center gap-2 md:col-span-1">
                  <span className={cn("text-sm", STATUS_STYLE[r.status])}>{statusLabel(r)}</span>
                  <span className={cn("text-sm md:hidden", r.contactId ? "text-muted-foreground" : "text-level-caution-ink")}>· 담당 {nameOf(r.contactId)}</span>
                </span>
                <span className={cn("hidden text-sm md:block", !r.contactId && "text-level-caution-ink")}>{nameOf(r.contactId)}</span>
              </>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
