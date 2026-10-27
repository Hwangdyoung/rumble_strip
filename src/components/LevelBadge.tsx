import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/risk";

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
