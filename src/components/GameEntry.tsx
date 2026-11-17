import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Gamepad2 } from "lucide-react";
import { getGameStatus } from "@/lib/game-account.server";

/**
 * 로그인 화면 왼쪽 위 모서리의 '게임 해 보기' 버튼 → 환자용 게임(/play, SQL 012).
 * 오른쪽 위 '로그인 없이 둘러보기'(DemoEntry)와 짝. 같은 스위치(DEMO_MODE=on)일 때만 보인다.
 */
export function GameEntry() {
  const { data } = useQuery({ queryKey: ["game-status"], queryFn: () => getGameStatus(), staleTime: 60_000, retry: false });
  if (!data?.enabled) return null;
  return (
    <div className="fixed left-0 top-0 z-20 p-4 sm:p-6">
      <Link
        to="/play"
        className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium shadow-card transition hover:bg-muted"
      >
        <Gamepad2 className="size-4" aria-hidden /> 게임 해 보기
      </Link>
    </div>
  );
}
