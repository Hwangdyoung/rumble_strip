import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { alertOutcomesQuery, setAlertOutcome } from "@/lib/queries";
import { ALERT_OUTCOMES, outcomeStats, type AlertOutcome, type OutcomeSuggestion } from "@/lib/alert-outcome";
import { cn } from "@/lib/utils";

export const outcomeStyle: Record<AlertOutcome, string> = {
  미정: "bg-muted text-foreground",
  회복: "bg-level-normal-soft text-level-normal",
  이탈: "bg-level-risk-soft text-level-risk",
  "연락 불가": "bg-level-caution-soft text-level-caution-ink",
};

/**
 * 알림 결과 선택. 제안(suggestion)은 문구로만 보여주고, 저장은 사람이 버튼을 눌러야 합니다.
 * withNote: 메모 입력칸 표시 (환자 상세에서만)
 */
export function AlertOutcomePicker({
  alertId,
  patientId,
  outcome,
  note,
  suggestion,
  withNote = false,
  compact = false,
}: {
  alertId: string;
  patientId: string;
  outcome: string;
  note?: string | null;
  suggestion: OutcomeSuggestion | null;
  withNote?: boolean;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [memo, setMemo] = useState(note ?? "");
  const m = useMutation({
    mutationFn: (v: { outcome: AlertOutcome; note?: string }) => setAlertOutcome(alertId, v.outcome, v.note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("알림 결과를 저장했습니다.");
    },
    onError: () => toast.error("알림 결과를 저장하지 못했습니다. 다시 시도해 주세요."),
  });
  const current = (ALERT_OUTCOMES as string[]).includes(outcome) ? (outcome as AlertOutcome) : "미정";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="알림 결과">
        <span className={cn("mr-1 font-medium text-muted-foreground", compact ? "text-xs" : "text-sm")}>결과</span>
        {ALERT_OUTCOMES.map((o) => (
          <Button
            variant="outline"
            key={o}
            type="button"
            disabled={m.isPending}
            aria-pressed={current === o}
            onClick={() => m.mutate(withNote ? { outcome: o, note: memo } : { outcome: o })}
            className={cn(
              "h-auto rounded-full border font-medium",
              compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              current === o ? cn(outcomeStyle[o], "border-transparent") : "text-muted-foreground hover:bg-muted",
            )}
          >
            {o}
          </Button>
        ))}
      </div>
      {suggestion && current === "미정" && (
        <p className={cn("rounded-lg bg-level-normal-soft px-3 py-2 text-level-normal", compact ? "text-xs" : "text-sm")}>
          {suggestion.text}
        </p>
      )}
      {withNote && (
        <div className="flex gap-2">
          <Input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="결과 메모 (선택)"
            aria-label="결과 메모"
            className="h-9 text-sm"
          />
          <Button
            variant="outline"
            type="button"
            className="h-9 shrink-0"
            disabled={m.isPending || memo === (note ?? "")}
            onClick={() => m.mutate({ outcome: current, note: memo })}
          >
            메모 저장
          </Button>
        </div>
      )}
    </div>
  );
}

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** 대시보드 '알림 결과' 카드: 기록된 결과 수, 결과별 비율, 알림 당시 단계별 회복 비율 */
export function AlertOutcomeSummary() {
  const { data, isPending, isError } = useQuery(alertOutcomesQuery());
  const stats = data ? outcomeStats(data) : null;
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card" aria-label="알림 결과">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">알림 결과</h2>
        <p className="text-sm text-muted-foreground">
          {stats ? `결과 기록 ${stats.recorded}건 / 전체 알림 ${stats.total}건` : isPending ? "불러오는 중…" : ""}
        </p>
      </div>
      {isError && <p className="mt-3 text-sm text-muted-foreground">알림 결과를 불러오지 못했습니다.</p>}
      {stats && stats.recorded === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">아직 결과가 기록된 알림이 없습니다. 환자 상세나 알림 목록에서 결과를 선택해 주세요.</p>
      )}
      {stats && stats.recorded > 0 && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {(["회복", "이탈", "연락 불가"] as const).map((o) => (
              <div key={o} className={cn("rounded-xl p-3", outcomeStyle[o])}>
                <div className="text-xs font-medium">{o}</div>
                <div className="mt-1 text-xl font-bold tabular-nums">{pct(stats.rates[o])}</div>
                <div className="text-xs tabular-nums">{stats.counts[o]}건</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <h3 className="mb-1.5 text-sm font-semibold">알림 당시 단계별 회복 비율</h3>
            <ul className="space-y-1 text-sm">
              {stats.byLevel.map((r) => (
                <li key={r.level} className="flex items-baseline justify-between gap-3">
                  <span>{r.level}</span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{pct(r.rate)}</span> ({r.recovered}/{r.recorded}건)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <p className="mt-3 text-xs text-muted-foreground">가상 데이터라 검증 결과가 아님. 실제 데이터가 쌓이면 점수 기준을 보정하는 데 씁니다. 관리자가 아니면 담당 환자의 알림만 셉니다.</p>
    </section>
  );
}
