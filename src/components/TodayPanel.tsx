import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PanelTab = { id: string; label: string; badge?: string | number | undefined; content: ReactNode };

const TAB_KEY = "rumble-strip:today-tab";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * 대시보드 '오늘 업무' 패널: 탭을 누르거나(휴대폰은 좌우로 밀어서) 내용이 옆으로 슬라이드된다.
 * collapsed면 탭 이름과 숫자만 있는 한 줄로 접히고, 누르면 펼쳐진다.
 */
export function TodayPanel({
  title,
  headerRight,
  tabs,
  collapsed = false,
  initialTabId = "last",
}: {
  title: string;
  /** 처음 열 탭. "last"면 마지막에 본 탭 */
  initialTabId?: string;
  headerRight?: ReactNode;
  tabs: PanelTab[];
  collapsed?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false); // collapsed일 때 펼쳤는지
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // 마지막으로 본 탭 기억 (이 브라우저에서만)
  useEffect(() => {
    try {
      const want = initialTabId === "last" ? window.localStorage.getItem(TAB_KEY) : initialTabId;
      const i = tabs.findIndex((t) => t.id === want);
      if (i >= 0) setIndex(i);
    } catch {
      /* 저장값을 못 읽으면 첫 탭 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const select = (i: number) => {
    const next = Math.max(0, Math.min(tabs.length - 1, i));
    setIndex(next);
    try {
      window.localStorage.setItem(TAB_KEY, tabs[next]!.id);
    } catch {
      /* 저장 실패는 무시 */
    }
  };

  // 패널 높이를 지금 보이는 탭 내용에 맞춘다 (짧은 탭에서 빈 공간이 생기지 않게)
  useIsoLayoutEffect(() => {
    const el = slideRefs.current[index];
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, collapsed, open]);

  const showBody = !collapsed || open;

  return (
    <section className="rounded-2xl border bg-card shadow-card" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {headerRight}
          {collapsed && (
            <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {open ? <>접기 <ChevronUp className="size-4" /></> : <>펼치기 <ChevronDown className="size-4" /></>}
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto px-4 pb-1 pt-3" role="tablist" aria-label={`${title} 구분`}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`today-tab-${t.id}`}
            aria-selected={index === i}
            aria-controls={`today-panel-${t.id}`}
            onClick={() => {
              select(i);
              if (collapsed) setOpen(true);
            }}
            className={cn(
              "relative shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              index === i && showBody ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums", index === i && showBody ? "bg-primary/10" : "bg-muted")}>
                {t.badge}
              </span>
            )}
            {index === i && showBody && <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-primary" aria-hidden />}
          </button>
        ))}
      </div>

      {showBody && (
        <div
          className="today-panel-viewport overflow-hidden border-t"
          style={{ height }}
          onTouchStart={(e) => {
            const p = e.touches[0];
            touch.current = p ? { x: p.clientX, y: p.clientY } : null;
          }}
          onTouchEnd={(e) => {
            const s = touch.current;
            const p = e.changedTouches[0];
            touch.current = null;
            if (!s || !p) return;
            const dx = p.clientX - s.x;
            const dy = p.clientY - s.y;
            // 가로로 충분히 밀었을 때만 탭을 넘긴다 (세로 스크롤과 구분)
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) select(index + (dx < 0 ? 1 : -1));
          }}
        >
          <div className="today-panel-track flex items-start" style={{ transform: `translateX(-${index * 100}%)` }}>
            {tabs.map((t, i) => (
              <div
                key={t.id}
                ref={(el) => {
                  slideRefs.current[i] = el;
                }}
                id={`today-panel-${t.id}`}
                role="tabpanel"
                aria-labelledby={`today-tab-${t.id}`}
                aria-hidden={index !== i}
                inert={index !== i}
                className="w-full shrink-0 p-5"
              >
                {t.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
