import { LevelBadge } from "@/components/LevelBadge";
import type { ContactRow, ContactStatus } from "@/lib/contact-list";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ContactStatus, string> = {
  "다시 연락": "bg-level-caution-soft text-level-caution-ink",
  "연락 전": "bg-level-caution-soft text-level-caution-ink",
  "연락 불가": "bg-level-risk-soft text-level-risk",
  "연락 예정": "bg-secondary text-secondary-foreground",
  연락함: "bg-level-normal-soft text-level-normal",
  "경과 관찰": "bg-muted text-muted-foreground",
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
}: {
  rows: ContactRow[];
  nameOf: (id: string | null) => string;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  compact: boolean;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-8 text-center text-muted-foreground">해당하는 환자가 없습니다.</p>;
  }
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.patientId}>
          <button
            type="button"
            onClick={() => onSelect(r.patientId)}
            aria-current={selectedId === r.patientId ? "true" : undefined}
            className={cn(
              "grid w-full items-center gap-x-4 gap-y-1.5 px-5 py-3.5 text-left transition hover:bg-muted",
              compact ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]",
              selectedId === r.patientId && "bg-secondary ring-2 ring-inset ring-primary",
              !r.needsAction && "opacity-70",
            )}
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">{r.name}</span>
                {r.newWorseAt && <span className="rounded-full bg-level-risk-soft px-2 py-0.5 text-xs font-semibold text-level-risk">새로 나빠짐</span>}
                {r.followDue && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                    {r.followDue.overdueDays > 0 ? `다시 연락 ${r.followDue.overdueDays}일 지남` : "오늘 다시 연락"}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted-foreground">{r.reason}</span>
            </span>
            {compact ? (
              <span className="flex flex-col items-end gap-1">
                <LevelBadge level={r.level} />
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[r.status])}>{statusLabel(r)}</span>
              </span>
            ) : (
              <>
                <span className="justify-self-end md:justify-self-start">
                  <LevelBadge level={r.level} />
                  {r.score !== null && <span className="ml-1.5 text-sm tabular-nums text-muted-foreground">{r.score}</span>}
                </span>
                <span className="col-span-2 flex items-center gap-2 md:col-span-1">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[r.status])}>{statusLabel(r)}</span>
                  <span className={cn("text-sm md:hidden", !r.contactId && "font-medium text-level-risk")}>· {nameOf(r.contactId)}</span>
                </span>
                <span className={cn("hidden text-sm md:block", !r.contactId && "font-medium text-level-risk")}>{nameOf(r.contactId)}</span>
              </>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
