// 조원이 만든 '스타러커스 체험 게임' 코드를 가져옴(2026-11-17, AI-DB-PROJECT-main/rumble_strip-play). 내용은 그대로.
import { useState } from "react";
import { Plus } from "lucide-react";
import { BUILDINGS, type BuildingId, type VillageState } from "@/lib/village";

/** 마을 꾸미기: 빈 땅을 누르고 건물을 골라 코인으로 짓는다 */
export function Village({ state, onBuild }: { state: VillageState; onBuild: (plot: number, id: BuildingId) => void }) {
  const [picking, setPicking] = useState<number | null>(null);

  return (
    <section className="overflow-hidden rounded-2xl border shadow-card">
      <div className="flex items-center justify-between bg-[#1d2340] px-4 py-3 text-white">
        <h2 className="font-bold">내 마을</h2>
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="inline-block size-4 rounded-full border-2 border-[#B57F00] bg-[#FFD84D]" aria-hidden="true" />
          {state.coins} 코인
        </span>
      </div>

      <div className="bg-gradient-to-b from-[#1b2a5c] to-[#2c4a8a] p-4 sm:p-6">
        <div className="mx-auto max-w-xl rounded-[2rem] bg-[#5DBB63] p-3 shadow-[inset_0_-10px_0_#3E8E46] sm:p-5">
          <div className="grid grid-cols-3 gap-3">
            {state.plots.map((b, i) => (
              <button
                key={i}
                type="button"
                onClick={() => !b && setPicking(picking === i ? null : i)}
                aria-label={b ? `${BUILDINGS.find((x) => x.id === b)!.name}` : "빈 땅: 건물 짓기"}
                aria-pressed={picking === i}
                className={`grid aspect-square place-items-center rounded-2xl transition ${
                  b ? "cursor-default bg-[#8BD27F]" : picking === i ? "bg-[#C9A27E] ring-4 ring-white" : "bg-[#B98E67] hover:bg-[#C9A27E]"
                }`}
              >
                {b ? <BuildingIcon id={b} className="w-4/5" /> : <Plus className="size-7 text-white/80" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {picking !== null && (
        <div className="space-y-2 bg-card p-4">
          <p className="text-sm font-medium">무엇을 지을까요?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BUILDINGS.map((b) => {
              const enough = state.coins >= b.cost;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={!enough}
                  onClick={() => {
                    onBuild(picking, b.id);
                    setPicking(null);
                  }}
                  className="flex items-center gap-2 rounded-xl border p-2 text-left transition hover:border-primary hover:bg-accent disabled:opacity-40"
                >
                  <BuildingIcon id={b.id} className="size-10 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">{b.name}</span>
                    <span className="block text-xs text-muted-foreground">{b.cost} 코인</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">코인은 게임에서 모아요. 길에서 주운 코인 + 기억 그림을 맞힌 수만큼 생겨요.</p>
        </div>
      )}
    </section>
  );
}

export function BuildingIcon({ id, className }: { id: BuildingId; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <ellipse cx="50" cy="90" rx="34" ry="6" fill="#000" opacity=".15" />
      {ICONS[id]}
    </svg>
  );
}

const ICONS: Record<BuildingId, React.ReactNode> = {
  tree: (
    <g>
      <rect x="45" y="62" width="10" height="26" rx="2" fill="#7A4E2D" />
      <path d="M50 10L76 48H62L80 70H20L38 48H24z" fill="#2F7D5B" />
    </g>
  ),
  carrot: (
    <g>
      <rect x="14" y="56" width="72" height="30" rx="6" fill="#8B5E3C" />
      {[28, 50, 72].map((x) => (
        <g key={x}>
          <path d={`M${x} 60l-5-14h10z`} fill="#F97316" />
          <path d={`M${x} 48l-6-12M${x} 48l0-14M${x} 48l6-12`} stroke="#22C55E" strokeWidth="4" strokeLinecap="round" />
        </g>
      ))}
    </g>
  ),
  house: (
    <g strokeLinejoin="round">
      <rect x="22" y="46" width="56" height="40" fill="#FDE7C7" stroke="#9A6B3F" strokeWidth="3" />
      <path d="M14 50L50 18l36 32z" fill="#F97316" stroke="#9A3412" strokeWidth="3" />
      <rect x="44" y="62" width="14" height="24" fill="#9A6B3F" />
      <rect x="28" y="56" width="11" height="11" fill="#7DD3FC" stroke="#9A6B3F" strokeWidth="2" />
    </g>
  ),
  windmill: (
    <g strokeLinejoin="round">
      <path d="M38 88l6-50h12l6 50z" fill="#F1F5F9" stroke="#64748B" strokeWidth="3" />
      <g transform="translate(50 36)">
        {[0, 90, 180, 270].map((r) => (
          <rect key={r} x="-4" y="-30" width="8" height="28" rx="2" fill="#DC2626" transform={`rotate(${r + 20})`} />
        ))}
        <circle r="5" fill="#334155" />
      </g>
      <rect x="45" y="70" width="10" height="18" fill="#92400E" />
    </g>
  ),
};
