import { toDateKey } from "@/lib/risk";
import { cn } from "@/lib/utils";

/**
 * 상담원용 접속 캘린더: 처방 주차별로 '접속한 날'만 표시한다.
 * 시간·정확도 같은 수치는 받지 않는다(서버가 날짜만 보냄).
 */
export function AttendanceCalendar({
  startDate,
  weeks,
  targetDays,
  playedDates,
}: {
  startDate: string; // YYYY-MM-DD
  weeks: number;
  targetDays: number;
  playedDates: string[];
}) {
  const played = new Set(playedDates);
  const today = toDateKey(new Date());
  const [y, m, d] = startDate.split("-").map(Number);
  const start = new Date(y!, m! - 1, d!);
  const rows = Array.from({ length: Math.max(1, weeks) }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i);
      const key = toDateKey(day);
      return { key, label: `${day.getMonth() + 1}/${day.getDate()}`, played: played.has(key), future: key > today, today: key === today };
    }),
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-separate border-spacing-1 text-center text-xs">
          <thead>
            <tr>
              <th scope="col" className="w-14 text-left font-semibold text-muted-foreground">주차</th>
              {Array.from({ length: 7 }, (_, i) => (
                <th key={i} scope="col" className="font-semibold text-muted-foreground">{i + 1}일째</th>
              ))}
              <th scope="col" className="w-16 font-semibold text-muted-foreground">접속</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, w) => {
              const n = row.filter((c) => c.played).length;
              return (
                <tr key={w}>
                  <th scope="row" className="text-left font-semibold">{w + 1}주차</th>
                  {row.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "h-10 rounded-md tabular-nums",
                        c.played ? "bg-teal font-semibold text-primary-foreground" : "bg-muted text-muted-foreground",
                        c.future && "opacity-40",
                        c.today && "ring-2 ring-primary",
                      )}
                      aria-label={`${c.label} ${c.played ? "접속" : c.future ? "예정" : "미접속"}`}
                    >
                      {c.label}
                    </td>
                  ))}
                  <td className={cn("font-semibold tabular-nums", n >= targetDays ? "text-level-normal" : "text-muted-foreground")}>
                    {n}/{targetDays}일
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-teal" /> 접속한 날</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-muted" /> 접속 안 한 날</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border-2 border-primary" /> 오늘</li>
      </ul>
      <p className="text-xs text-muted-foreground">접속 여부만 보입니다. 사용 시간과 게임 결과는 의료진 화면에서 확인합니다.</p>
    </div>
  );
}
