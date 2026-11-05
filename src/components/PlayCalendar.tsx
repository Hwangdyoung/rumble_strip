import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildMonth, playIntensity, prescriptionEndKey, riskOnDay, weekProgress, type CalendarDay, type CalendarLog } from "@/lib/calendar";
import { toDateKey, type PatientLike } from "@/lib/risk";
import { LevelBadge } from "@/components/LevelBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

type Props = {
  patient: PatientLike;
  logs: CalendarLog[];
  actions: { created_at: string; action_type: string; memo: string | null }[];
  alerts: { created_at: string }[];
};

export function PlayCalendar({ patient, logs, actions, alerts }: Props) {
  const todayKey = toDateKey(new Date());
  const startMonth = useMemo(() => {
    const [y, m] = patient.prescription_start_date.split("-").map(Number);
    return { year: y!, month: m! - 1 };
  }, [patient.prescription_start_date]);
  const [view, setView] = useState(startMonth);
  const [selected, setSelected] = useState<string | null>(null);

  const actionKeys = useMemo(() => new Set(actions.map((a) => toDateKey(new Date(a.created_at)))), [actions]);
  const alertKeys = useMemo(() => new Set(alerts.map((a) => toDateKey(new Date(a.created_at)))), [alerts]);
  const cells = useMemo(
    () => buildMonth(patient, logs, actionKeys, alertKeys, view.year, view.month, todayKey),
    [patient, logs, actionKeys, alertKeys, view, todayKey],
  );
  const week = useMemo(() => weekProgress(logs, patient.weekly_target_days), [logs, patient.weekly_target_days]);
  const selectedDay = useMemo(() => cells.find((c) => c?.key === selected) ?? null, [cells, selected]);
  const selectedRisk = useMemo(
    () => (selectedDay && selectedDay.inWindow && !selectedDay.isFuture ? riskOnDay(patient, logs, selectedDay.key) : null),
    [patient, logs, selectedDay],
  );
  const selectedActions = useMemo(
    () => (selected ? actions.filter((a) => toDateKey(new Date(a.created_at)) === selected) : []),
    [actions, selected],
  );

  const move = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelected(null);
  };

  const [, sm, sd] = patient.prescription_start_date.split("-").map(Number);
  const [, em, ed] = prescriptionEndKey(patient).split("-").map(Number);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" aria-label="이전 달" onClick={() => move(-1)}><ChevronLeft /></Button>
        <div className="text-center">
          <div className="text-lg font-bold">{view.year}년 {view.month + 1}월</div>
          <div className="text-xs text-muted-foreground">처방 기간 {sm}/{sd} ~ {em}/{ed}</div>
        </div>
        <Button variant="outline" size="icon" aria-label="다음 달" onClick={() => move(1)}><ChevronRight /></Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
        {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="플레이 캘린더">
        {cells.map((c, i) =>
          c ? (
            <DayCell
              key={c.key}
              cell={c}
              target={patient.session_target_minutes}
              selected={selected === c.key}
              onSelect={() => setSelected(selected === c.key ? null : c.key)}
            />
          ) : (
            <span key={`pad-${i}`} />
          ),
        )}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ backgroundColor: "color-mix(in oklab, var(--teal) 70%, var(--card))" }} /> 접속 (진할수록 긴 시간)</li>
        <li className="flex items-center gap-1.5"><span className="grid size-3 place-items-center rounded-sm bg-muted"><span className="size-1 rounded-full bg-muted-foreground" /></span> 미접속</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border-2 border-primary" /> 오늘</li>
        <li className="flex items-center gap-1.5"><span className="size-0 border-6 border-transparent border-t-teal border-r-teal" /> 조치 기록</li>
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-level-risk" /> 알림 발생</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border opacity-40" /> 처방 기간 밖</li>
      </ul>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">이번 주 접속</span>
          <span className="tabular-nums text-muted-foreground">{week.days} / {week.target}일</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={week.days} aria-valuemax={week.target} aria-label="이번 주 접속 진행">
          <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.min(100, (week.days / week.target) * 100)}%` }} />
        </div>
      </div>

      {selectedDay && (
        <div className="detail-fade rounded-xl border bg-muted/40 p-4" aria-live="polite">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-bold">{Number(selectedDay.key.slice(5, 7))}월 {Number(selectedDay.key.slice(8, 10))}일</span>
            {selectedRisk && <LevelBadge level={selectedRisk.level} />}
            {selectedRisk && <span className="text-sm tabular-nums text-muted-foreground">위험 {selectedRisk.score}점</span>}
          </div>
          {!selectedDay.inWindow ? (
            <p className="text-sm text-muted-foreground">처방 기간 밖의 날짜입니다.</p>
          ) : selectedDay.minutes > 0 ? (
            <ul className="space-y-1 text-sm">
              <li>플레이 시간 <strong>{selectedDay.minutes}분</strong> ({selectedDay.sessions}회)</li>
              <li>완료 과제 <strong>{selectedDay.tasks}개</strong></li>
              <li>중도 종료 <strong>{selectedDay.endedEarly ? "있음" : "없음"}</strong></li>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{selectedDay.isFuture ? "아직 오지 않은 날짜입니다." : "접속 기록이 없습니다."}</p>
          )}
          {selectedActions.length > 0 && (
            <ul className="mt-3 space-y-1 border-t pt-2 text-sm">
              {selectedActions.map((a, i) => (
                <li key={i}><span className="font-semibold text-primary">{a.action_type}</span> — {a.memo || "메모 없음"}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function DayCell({ cell, target, selected, onSelect }: { cell: CalendarDay; target: number; selected: boolean; onSelect: () => void }) {
  const played = cell.minutes > 0;
  const missed = cell.inWindow && !played && !cell.isFuture;
  const intensity = playIntensity(cell.minutes, target);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${cell.key}${played ? ` ${cell.minutes}분 플레이` : missed ? " 미접속" : ""}`}
      aria-pressed={selected}
      className={cn(
        "relative flex min-h-11 flex-col items-center justify-center rounded-lg border text-sm transition",
        cell.inWindow ? "border-input" : "border-transparent opacity-40",
        missed && "bg-muted",
        cell.isToday && "ring-2 ring-primary",
        selected && "ring-2 ring-ring",
      )}
      style={played ? { backgroundColor: `color-mix(in oklab, var(--teal) ${Math.round(intensity * 100)}%, var(--card))` } : undefined}
    >
      <span className={cn("leading-none", played && intensity > 0.6 && "font-semibold text-primary-foreground")}>{cell.day}</span>
      {played && <span className={cn("mt-0.5 text-[10px] leading-none tabular-nums", intensity > 0.6 ? "text-primary-foreground/90" : "text-muted-foreground")}>{cell.minutes}분</span>}
      {missed && <span className="mt-1 size-1 rounded-full bg-muted-foreground" aria-hidden />}
      {cell.hasAction && <span className="absolute right-0 top-0 size-0 border-6 border-transparent border-t-teal border-r-teal" aria-label="조치 기록 있음" />}
      {cell.hasAlert && <span className="absolute bottom-0.5 right-0.5 size-1.5 rounded-full bg-level-risk" aria-label="알림 발생" />}
    </button>
  );
}
