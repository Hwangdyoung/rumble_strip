import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runDailyCheck } from "@/lib/queries";
import { toDateKey } from "@/lib/risk";
import { cn } from "@/lib/utils";

/**
 * 대시보드를 열면 오늘 점검을 자동으로 한 번 실행합니다.
 * (배포 전 임시 방식. 배포 후에는 서버 예약 작업이 같은 점검을 매일 실행)
 */
export function DailyCheckStatus({ inline = false }: { inline?: boolean } = {}) {
  const qc = useQueryClient();
  const today = toDateKey(new Date());
  const q = useQuery({
    queryKey: ["daily-check", today],
    queryFn: () => runDailyCheck(),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!q.data) return;
    if (q.data.saved > 0) {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
    }
    if (q.data.alerts > 0) toast.warning(`오늘 점검에서 새 알림 ${q.data.alerts}건이 생겼습니다.`);
  }, [q.data, qc]);

  const d = q.data;
  let text: string;
  if (q.isFetching) text = "오늘 점검 중…";
  else if (q.isError) text = "오늘 점검을 하지 못했습니다.";
  else if (!d) text = "";
  else if (d.saved === 0 && d.doneToday > 0) text = `오늘 점검 완료 (이미 점검된 환자 ${d.doneToday}명)`;
  else
    text = `오늘 점검 완료 · ${new Date(d.checkedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })} · ${d.saved}명 점검 · 새 알림 ${d.alerts}건`;

  // 패널 머리에 들어가는 짧은 형태
  if (inline) {
    let short = "";
    if (q.isFetching) short = "점검 중…";
    else if (q.isError) short = "점검 실패";
    else if (d && d.saved === 0 && d.doneToday > 0) short = "오늘 점검 완료";
    else if (d) short = `오늘 점검 완료 · 새 알림 ${d.alerts}건`;
    return (
      <div className="flex items-center gap-1 text-sm" role="status">
        <span className={cn("text-muted-foreground", q.isError && "text-level-risk")} title={text}>매일 점검 · {short}</span>
        <Button variant="ghost" size="icon" className="size-8" disabled={q.isFetching} onClick={() => q.refetch()} aria-label="지금 점검" title="지금 점검">
          <RefreshCw className={cn("size-4", q.isFetching && "animate-spin")} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-card" role="status">
      <div>
        <span className="font-semibold">매일 점검</span>{" "}
        <span className="text-muted-foreground">{text}</span>
        {d && d.outOfPrescription > 0 && (
          <span className="text-muted-foreground"> · 처방 기간 밖 {d.outOfPrescription}명 제외</span>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={q.isFetching}
        onClick={() => q.refetch()}
        aria-label="지금 점검"
      >
        <RefreshCw className="size-4" /> 지금 점검
      </Button>
    </div>
  );
}
