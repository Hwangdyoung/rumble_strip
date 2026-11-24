import { cn } from "@/lib/utils";
import type { RiskCause, RiskLevel } from "@/lib/risk";

/**
 * 단계 색. 급할수록 진하다: 치료이탈만 채운 배지(가장 눈에 띔), 나머지는 옅은 배경.
 * strip: 목록 줄 왼쪽 '방지턱 띠' 색 (styles.css의 .rumble-strip이 currentColor로 끊어진 띠를 그림). 정상은 띠 없음.
 */
export const levelStyles: Record<RiskLevel, { badge: string; dot: string; card: string; strip: string }> = {
  정상: { badge: "bg-level-normal-soft text-level-normal", dot: "bg-level-normal", card: "border-level-normal", strip: "text-transparent" },
  주의: { badge: "bg-level-caution-soft text-level-caution-ink", dot: "bg-level-caution", card: "border-level-caution", strip: "text-level-caution" },
  "이탈 위험": { badge: "bg-level-risk-soft text-level-risk", dot: "bg-level-risk", card: "border-level-risk", strip: "text-level-risk" },
  치료이탈: { badge: "bg-level-dropout text-white dark:text-background", dot: "bg-current opacity-70", card: "border-level-dropout", strip: "text-level-dropout" },
};

export function LevelBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const s = levelStyles[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold",
        s.badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {level}
    </span>
  );
}

/** 추정 원인 태그. 원인이 없으면(정상) '경과 관찰'로 표시합니다. */
export function CauseBadge({ cause, className }: { cause: RiskCause | null; className?: string }) {
  if (!cause) return <span className={cn("text-sm text-muted-foreground", className)}>경과 관찰</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground",
        className,
      )}
    >
      {cause}
    </span>
  );
}
