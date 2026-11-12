import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HANDOFF_REASONS, type HandoffReason } from "@/lib/queries";
import { workloadText, type Workload } from "@/lib/workload";
import { cn } from "@/lib/utils";

/**
 * 넘기기 창의 공용 입력 (한 명 넘기기 `PatientContact.tsx`, 여러 명 넘기기 `BulkHandoffDialog.tsx`).
 * - ReceiverPicker: 받는 사람 카드(업무량, '여유' 표시). 업무량은 SQL 008 함수가 없으면 숫자만 뺀다.
 * - ReasonNoteFields: 이유(인계·의사 확인 요청·기타)와 메모.
 */
export function ReceiverPicker({
  options,
  value,
  onChange,
  workload,
  light,
  extra,
}: {
  options: Array<{ id: string; name: string; role: string }>;
  value: string;
  onChange: (id: string) => void;
  workload: Workload[] | undefined;
  /** '여유' 표시할 사람 id */
  light: string[];
  /** 카드 아래 한 줄 (여러 명 넘기기: "3명 중 2명 받을 수 있음") */
  extra?: (id: string) => ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label id="handoff-to-label" className="text-base">받는 사람</Label>
      <div className="grid gap-2" role="radiogroup" aria-labelledby="handoff-to-label">
        {options.map((s) => {
          const w = workload?.find((x) => x.staffId === s.id);
          const on = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(s.id)}
              className={cn(
                "flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border bg-card px-3 py-2 text-left transition hover:bg-muted",
                on && "border-primary bg-secondary ring-2 ring-primary",
              )}
            >
              <span className="font-semibold">
                {s.name} <span className="font-normal text-muted-foreground">({s.role})</span>
                {light.includes(s.id) && (
                  <span className="ml-2 rounded-full bg-level-normal-soft px-2 py-0.5 text-xs font-semibold text-level-normal">여유</span>
                )}
              </span>
              {workload && <span className="text-sm tabular-nums text-muted-foreground">{workloadText(w)}</span>}
              {extra && <span className="w-full text-sm text-muted-foreground">{extra(s.id)}</span>}
            </button>
          );
        })}
      </div>
      {workload && (
        <p className="text-xs text-muted-foreground">
          오늘 할 일 = 새로 나빠졌거나 오늘까지 다시 연락할 환자 수(연락 담당 기준). '여유'는 참고 표시이고, 받는 사람은 직접 고릅니다.
        </p>
      )}
    </div>
  );
}

export function ReasonNoteFields({
  reason,
  onReason,
  note,
  onNote,
}: {
  reason: HandoffReason;
  onReason: (r: HandoffReason) => void;
  note: string;
  onNote: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label className="text-base">이유</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="넘기는 이유">
          {HANDOFF_REASONS.map((r) => (
            <Button
              key={r}
              type="button"
              variant="outline"
              role="radio"
              aria-checked={reason === r}
              onClick={() => onReason(r)}
              className={cn("h-auto min-h-11 whitespace-normal px-2", reason === r && "border-primary bg-secondary ring-2 ring-primary")}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="handoff-note" className="text-base">메모</Label>
        <Textarea
          id="handoff-note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder={reason === "의사 확인 요청" ? "예: 정확도가 계속 떨어져서 난이도 검토 부탁드려요" : "예: 오후에 보호자와 통화 약속, 아직 연결 안 됨"}
        />
      </div>
    </>
  );
}
