// 조원이 만든 '스타러커스 체험 게임' 코드를 가져옴(2026-11-17, AI-DB-PROJECT-main/rumble_strip-play). 내용은 그대로.
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { DRIVE_CONFIG, project, type Lane, type Thing } from "@/lib/drive";
import type { SymbolId } from "@/lib/game";
import { GameSymbol } from "@/components/GameSymbol";

/** 달리기 게임 화면(그리기만 한다. 규칙은 drive.ts, 진행은 play.tsx) */
export function DriveScene(props: {
  name: string;
  coins: number;
  trialNo: number;
  totalTrials: number;
  things: Thing[];
  lane: Lane;
  symbol: SymbolId | null;
  symbolKey: number;
  feedback: "hit" | "falseAlarm" | "miss" | null;
  combo: number;
  crashed: boolean;
  invulnerable: boolean;
  active: boolean;
  onLeft: () => void;
  onRight: () => void;
  onTap: () => void;
  overlay?: ReactNode;
}) {
  const player = project(DRIVE_CONFIG.playerDepth, props.lane);
  const bubbleRing =
    props.feedback === "hit" ? "ring-level-normal" : props.feedback === "falseAlarm" ? "ring-level-risk" : props.feedback === "miss" ? "ring-level-caution" : "ring-white/70";

  return (
    <div className="relative aspect-[4/5] w-full select-none overflow-hidden rounded-3xl border shadow-card sm:aspect-[16/10]">
      <style>{`
        @keyframes drive-dash { to { stroke-dashoffset: -12; } }
        @keyframes drive-blink { 50% { opacity: .35; } }
        @keyframes drive-pop { from { transform: translate(-50%, -50%) scale(.6); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
      `}</style>

      {/* 하늘·땅·길 */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5BB8F5" />
            <stop offset="1" stopColor="#D9F0FF" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7BC86C" />
            <stop offset="1" stopColor="#3E9B4F" />
          </linearGradient>
          <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E7B9A6" />
            <stop offset="1" stopColor="#C98D78" />
          </linearGradient>
        </defs>
        <rect width="100" height={DRIVE_CONFIG.horizon} fill="url(#sky)" />
        <rect y={DRIVE_CONFIG.horizon} width="100" height={100 - DRIVE_CONFIG.horizon} fill="url(#ground)" />
        <polygon points={`44,${DRIVE_CONFIG.horizon} 56,${DRIVE_CONFIG.horizon} 100,100 0,100`} fill="url(#road)" />
        <polygon points={`44,${DRIVE_CONFIG.horizon} 45,${DRIVE_CONFIG.horizon} 6,100 0,100`} fill="#A86B58" />
        <polygon points={`55,${DRIVE_CONFIG.horizon} 56,${DRIVE_CONFIG.horizon} 100,100 94,100`} fill="#A86B58" />
        {[-1, 1].map((s) => (
          <line
            key={s}
            x1={50 + s * 2}
            y1={DRIVE_CONFIG.horizon}
            x2={50 + s * 16.5}
            y2="100"
            stroke="#fff"
            strokeOpacity=".75"
            strokeWidth=".6"
            strokeDasharray="4 8"
            style={{ animation: props.active ? "drive-dash .35s linear infinite" : undefined }}
          />
        ))}
      </svg>

      {/* 구름·나무 (장식) */}
      <div className="absolute left-[8%] top-[6%] h-6 w-20 rounded-full bg-white/80 blur-[1px]" aria-hidden="true" />
      <div className="absolute right-[22%] top-[12%] h-5 w-16 rounded-full bg-white/70 blur-[1px]" aria-hidden="true" />
      {[4, 14, 26, 74, 86, 96].map((x, i) => (
        <svg
          key={x}
          viewBox="0 0 20 30"
          className="absolute"
          style={{ left: `${x}%`, top: `${DRIVE_CONFIG.horizon - 9 + (i % 3) * 2}%`, width: `${5 + (i % 3)}%`, transform: "translateX(-50%)" }}
          aria-hidden="true"
        >
          <path d="M10 0L20 18H14L19 26H1L6 18H0z" fill={i % 2 ? "#2F7D5B" : "#3A9468"} />
          <rect x="8.5" y="26" width="3" height="4" fill="#7A4E2D" />
        </svg>
      ))}

      {/* 길 위의 물체 (먼 것부터 그려서 가까운 것이 위로) */}
      {[...props.things]
        .sort((a, b) => a.depth - b.depth)
        .map((t) => {
          const p = project(t.depth, t.lane);
          return (
            <div
              key={t.id}
              className="absolute"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: "16%", transform: `translate(-50%, -85%) scale(${p.scale})`, transformOrigin: "50% 85%" }}
              aria-hidden="true"
            >
              {t.kind === "rock" ? <Spiky /> : <Coin />}
            </div>
          );
        })}

      {/* 내 차 */}
      <div
        className="absolute transition-[left] duration-150 ease-out"
        style={{
          left: `${player.x}%`,
          top: `${player.y}%`,
          width: "22%",
          transform: `translate(-50%, -80%) scale(${player.scale})`,
          transformOrigin: "50% 80%",
          animation: props.invulnerable ? "drive-blink .15s linear infinite" : undefined,
        }}
        aria-label={`내 차: ${["왼쪽", "가운데", "오른쪽"][props.lane]} 차선`}
      >
        <Rover />
      </div>

      {props.crashed && <div className="pointer-events-none absolute inset-0 bg-red-500/25" aria-hidden="true" />}

      {/* 위쪽 정보 */}
      <div className="absolute left-3 top-3 rounded-xl bg-[#1d2340]/80 px-3 py-2 text-white">
        <div className="text-sm font-bold">{props.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-sm">
          <span className="inline-block size-3.5 rounded-full border-2 border-[#B57F00] bg-[#FFD84D]" aria-hidden="true" />
          {props.coins}
        </div>
      </div>
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-[#1d2340]/80 px-3 py-1 font-mono text-sm font-bold text-white">
        {props.trialNo} / {props.totalTrials}
      </div>
      <div className="absolute right-3 top-3 flex flex-col items-center gap-1">
        <div className={`grid size-20 place-items-center rounded-full bg-white/90 shadow-lg ring-4 transition-colors sm:size-24 ${bubbleRing}`}>
          {props.symbol && (
            <GameSymbol key={props.symbolKey} id={props.symbol} className="size-14 animate-in zoom-in-50 duration-150 sm:size-16" />
          )}
        </div>
        <span className="rounded-full bg-[#1d2340]/80 px-2 py-0.5 text-xs font-semibold text-white">기억 그림</span>
      </div>
      {props.combo >= 2 && (
        <div
          key={props.combo}
          className="absolute left-1/2 top-[22%] text-3xl font-black italic text-[#FFD84D] [text-shadow:0_2px_0_#7a4b00,0_0_12px_rgba(0,0,0,.35)]"
          style={{ animation: "drive-pop .25s ease-out both" }}
        >
          {props.combo} COMBO
        </div>
      )}

      {/* 아래쪽 조작 */}
      <div className="absolute bottom-3 left-3 flex gap-2">
        <ControlButton label="왼쪽으로" onClick={props.onLeft} disabled={!props.active}>
          <ChevronLeft className="size-8" />
        </ControlButton>
        <ControlButton label="오른쪽으로" onClick={props.onRight} disabled={!props.active}>
          <ChevronRight className="size-8" />
        </ControlButton>
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1.5">
        <span className="rounded-lg bg-[#1d2340]/80 px-2.5 py-1 text-sm font-bold text-white">1개 전</span>
        <button
          type="button"
          onClick={props.onTap}
          disabled={!props.active}
          aria-label="1개 전 그림과 같아요"
          aria-keyshortcuts="Space"
          className="grid size-20 place-items-center rounded-full border-4 border-white/80 bg-[#2D8CF0] text-white shadow-lg transition active:scale-95 disabled:opacity-60 sm:size-24"
        >
          <Hand className="size-9 sm:size-10" />
        </button>
      </div>

      {props.overlay && <div className="absolute inset-0 grid place-items-center bg-[#0f1630]/70">{props.overlay}</div>}
    </div>
  );
}

function ControlButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-14 place-items-center rounded-full border-2 border-white/70 bg-[#1d2340]/70 text-white transition active:scale-95 disabled:opacity-60 sm:size-16"
    >
      {children}
    </button>
  );
}

/** 내 차: 동그란 조종사가 탄 호버 카트(직접 그린 단순 도형) */
function Rover() {
  return (
    <svg viewBox="0 0 100 80" className="w-full drop-shadow-lg">
      <ellipse cx="50" cy="74" rx="34" ry="5" fill="#000" opacity=".2" />
      <path d="M18 52h64l-6 14H24z" fill="#F59E0B" />
      <rect x="22" y="36" width="56" height="20" rx="9" fill="#7C3AED" />
      <rect x="10" y="44" width="16" height="8" rx="4" fill="#FACC15" />
      <rect x="74" y="44" width="16" height="8" rx="4" fill="#FACC15" />
      <circle cx="50" cy="26" r="15" fill="#F8FAFC" stroke="#334155" strokeWidth="3" />
      <rect x="40" y="20" width="20" height="9" rx="4.5" fill="#38BDF8" />
      <path d="M44 66l6 12 6-12z" fill="#FB923C" />
    </svg>
  );
}

/** 장애물: 빨간 가시 공 */
function Spiky() {
  return (
    <svg viewBox="0 0 100 100" className="w-full">
      <ellipse cx="50" cy="92" rx="30" ry="5" fill="#000" opacity=".2" />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d="M50 10l7 22H43z" fill="#B91C1C" transform={`rotate(${i * 36} 50 54)`} />
      ))}
      <circle cx="50" cy="54" r="26" fill="#DC2626" stroke="#7F1D1D" strokeWidth="3" />
      <circle cx="42" cy="48" r="5" fill="#fff" opacity=".5" />
    </svg>
  );
}

function Coin() {
  return (
    <svg viewBox="0 0 100 100" className="w-full">
      <ellipse cx="50" cy="92" rx="20" ry="4" fill="#000" opacity=".15" />
      <circle cx="50" cy="52" r="26" fill="#FFD84D" stroke="#B57F00" strokeWidth="5" />
      <path d="M50 38l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="#F5B301" />
    </svg>
  );
}
