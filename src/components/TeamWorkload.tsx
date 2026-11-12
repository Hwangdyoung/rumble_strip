import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { staffWorkloadQuery } from "@/lib/queries";
import { sortWorkload } from "@/lib/workload";
import { cn } from "@/lib/utils";

/**
 * 대시보드 '팀 업무량' (접힌 줄). 사람별 맡은 환자·새로 나빠짐·오늘 다시 연락·오늘 할 일.
 * 숫자는 DB 함수 staff_workload(SQL 008). 함수가 없거나 실패하면 아무것도 그리지 않는다.
 */
export function TeamWorkload({ myId }: { myId: string | null }) {
  const { data, isError } = useQuery(staffWorkloadQuery());
  if (isError || !data || data.length === 0) return null;
  const rows = sortWorkload(data);
  const total = rows.reduce((n, r) => n + r.todo, 0);

  return (
    <details className="group rounded-2xl border bg-card shadow-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">
          팀 업무량 <span className="text-sm font-normal text-muted-foreground">· {rows.length}명 · 오늘 할 일 합계 {total}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="overflow-x-auto border-t">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-semibold">담당자</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">맡은 환자</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">새로 나빠짐</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">오늘 다시 연락</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">오늘 할 일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staffId} className={cn("border-t", r.staffId === myId && "bg-secondary/60")}>
                <td className="px-4 py-2">
                  <span className="font-medium">{r.name}</span> <span className="text-muted-foreground">({r.role})</span>
                  {r.staffId === myId && <span className="ml-1 text-xs text-muted-foreground">· 나</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.patients}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums", r.newWorse > 0 && "font-semibold text-level-risk")}>{r.newWorse}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.followDue}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">{r.todo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        연락 담당 기준 환자 수입니다. 오늘 할 일 = 새로 나빠졌거나 오늘까지 다시 연락할 환자(겹치면 한 번). 위험 점수 기준의 '오늘 연락' 수와는 다를 수 있습니다.
      </p>
    </details>
  );
}
