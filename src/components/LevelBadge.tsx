import { cn } from "@/lib/utils";
import type { RiskCause, RiskLevel } from "@/lib/risk";

export const levelStyles: Record<RiskLevel, { badge: string; dot: string; card: string }> = {
  정상: { badge: "bg-level-normal-soft text-level-normal", dot: "bg-level-normal", card: "border-level-normal" },
  주의: { badge: "bg-level-caution-soft text-level-caution-ink", dot: "bg-level-caution", card: "border-level-caution" },
  "이탈 위험": { badge: "bg-level-risk-soft text-level-risk", dot: "bg-level-risk", card: "border-level-risk" },
  치료이탈: { badge: "bg-level-dropout-soft text-level-dropout", dot: "bg-level-dropout", card: "border-level-dropout" },
};

export function LevelBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const s = levelStyles[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold",
        s.badge,
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", s.dot)} />
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
