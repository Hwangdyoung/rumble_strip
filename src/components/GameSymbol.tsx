// 조원이 만든 '스타러커스 체험 게임' 코드를 가져옴(2026-11-17, AI-DB-PROJECT-main/rumble_strip-play). 내용은 그대로.
import type { SymbolId } from "@/lib/game";
import { SYMBOL_LABEL } from "@/lib/game";

/** 기억 게임 그림 8종. 단순한 도형으로 직접 그린 그림이다 */
export function GameSymbol({ id, className }: { id: SymbolId; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={SYMBOL_LABEL[id]}>
      {SHAPES[id]}
    </svg>
  );
}

const SHAPES: Record<SymbolId, React.ReactNode> = {
  star: <path d="M50 8l11.8 26.6 29 3-21.7 19.5 6.2 28.5L50 71.2 24.7 85.6l6.2-28.5L9.2 37.6l29-3z" fill="#F5B301" stroke="#B57F00" strokeWidth="3" strokeLinejoin="round" />,
  moon: <path d="M64 12a40 40 0 1 0 24 62A32 32 0 1 1 64 12z" fill="#FFD84D" stroke="#C9A100" strokeWidth="3" />,
  planet: (
    <g>
      <circle cx="50" cy="50" r="26" fill="#7C6CF2" stroke="#4B3DC4" strokeWidth="3" />
      <ellipse cx="50" cy="52" rx="44" ry="11" fill="none" stroke="#F28C6C" strokeWidth="6" transform="rotate(-18 50 52)" />
    </g>
  ),
  rocket: (
    <g strokeLinejoin="round">
      <path d="M50 8c16 12 20 34 14 58H36C30 42 34 20 50 8z" fill="#E9EEF6" stroke="#4A5568" strokeWidth="3" />
      <circle cx="50" cy="38" r="8" fill="#3B82F6" stroke="#4A5568" strokeWidth="3" />
      <path d="M36 52l-14 18 16-2zM64 52l14 18-16-2z" fill="#EF4444" stroke="#4A5568" strokeWidth="3" />
      <path d="M42 68l8 22 8-22z" fill="#F59E0B" />
    </g>
  ),
  comet: (
    <g>
      <path d="M14 22l46 30-8 12z" fill="#7DD3FC" opacity=".8" />
      <path d="M8 40l44 18-4 10z" fill="#BAE6FD" opacity=".9" />
      <circle cx="64" cy="66" r="18" fill="#38BDF8" stroke="#0369A1" strokeWidth="3" />
    </g>
  ),
  ufo: (
    <g>
      <path d="M32 46a18 16 0 0 1 36 0z" fill="#A7F3D0" stroke="#047857" strokeWidth="3" />
      <ellipse cx="50" cy="54" rx="40" ry="13" fill="#10B981" stroke="#047857" strokeWidth="3" />
      <circle cx="30" cy="55" r="3.5" fill="#FDE68A" /><circle cx="50" cy="58" r="3.5" fill="#FDE68A" /><circle cx="70" cy="55" r="3.5" fill="#FDE68A" />
      <path d="M38 68l-8 18M62 68l8 18" stroke="#047857" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  sun: (
    <g>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="47" y="4" width="6" height="16" rx="3" fill="#FB923C" transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="24" fill="#FDBA74" stroke="#EA580C" strokeWidth="3" />
    </g>
  ),
  gem: (
    <g strokeLinejoin="round">
      <path d="M26 18h48l16 22-40 46-40-46z" fill="#F472B6" stroke="#BE185D" strokeWidth="3" />
      <path d="M10 40h80M36 18l-8 22 22 46 22-46-8-22" fill="none" stroke="#BE185D" strokeWidth="2.5" />
    </g>
  ),
};
