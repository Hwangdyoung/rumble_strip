import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { counselorPatientQuery } from "@/lib/queries";
import { ACTION_MEMO_TEMPLATE } from "@/lib/response-guide";
import { LevelBadge } from "@/components/LevelBadge";
import { ResponseGuide } from "@/components/ResponseGuide";
import { PatientContact } from "@/components/PatientContact";
import { ContactHistory } from "@/components/ContactHistory";
import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { ActionDialog, FollowUpList, type ActionPreset } from "@/components/PatientDetail";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "guide", label: "연락 도우미" },
  { id: "calendar", label: "접속 캘린더" },
  { id: "history", label: "연락 이력" },
] as const;
type TabId = (typeof TABS)[number]["id"];
let lastTab: TabId = "guide";

/**
 * 상담원용 환자 상세. 서버 함수(fetchCounselorPatient)가 골라 보낸 정보만 쓴다:
 * 단계, 접속 관련 이유, 접속한 날짜, 연락 도우미 문장, 단계만 담은 알림, 연락 기록.
 * 점수, 정확도·반응 속도·세션 시간, 그래프, AI 경과 요약은 없다.
 */
export function CounselorPatientDetail({ id, panel = false }: { id: string; panel?: boolean }) {
  const { data, isPending, isError, refetch } = useQuery(counselorPatientQuery(id));
  const [tab, setTab] = useState<TabId>(lastTab);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionPreset, setActionPreset] = useState<ActionPreset | null>(null);

  if (isPending) return <p className="py-12 text-center text-muted-foreground" role="status">환자 정보를 불러오는 중…</p>;
  if (isError)
    return (
      <div className="space-y-4 py-12 text-center">
        <p>환자 정보를 불러오지 못했습니다.</p>
        <Button variant="outline" onClick={() => refetch()}>다시 시도</Button>
      </div>
    );
  if (!data) return <p className="py-12 text-center text-muted-foreground">환자를 찾을 수 없습니다.</p>;

  const { patient, level, reasons, guide, sheet, alerts, actions, followUps, playedDates, lastPlayDate } = data;
  const goTab = (t: TabId) => {
    setTab(t);
    lastTab = t;
  };
  const openActionWith = (kind: "call" | "sms") => {
    setActionPreset(kind === "call" ? { type: "전화 상담", memo: ACTION_MEMO_TEMPLATE.call } : { type: "문자", memo: ACTION_MEMO_TEMPLATE.sms(guide.sms) });
    setActionOpen(true);
  };
  const historyCount = alerts.length + actions.length;

  return (
    <div className="space-y-6">
      {!panel && (
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> 대시보드로
        </Link>
      )}

      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-card">
        <div className={cn("flex flex-col gap-4", !panel && "sm:flex-row sm:items-start sm:justify-between")}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold sm:text-3xl">{patient.name}</h1>
              <LevelBadge level={level} />
            </div>
            {reasons[0] && <p className="mt-1 font-medium">{reasons[0]}</p>}
            <p className="mt-0.5 text-sm text-muted-foreground">
              {patient.age}세 · 처방 시작 {patient.prescription_start_date} · {patient.prescription_weeks}주 / 주 {patient.weekly_target_days}회
              {lastPlayDate && <> · 마지막 접속 {Number(lastPlayDate.slice(5, 7))}/{Number(lastPlayDate.slice(8))}</>}
              {followUps[0] && (
                <> · <span className="font-medium text-foreground">다음 연락 {Number(followUps[0].due_date.slice(5, 7))}/{Number(followUps[0].due_date.slice(8))}</span></>
              )}
            </p>
          </div>
          {level === "정상" ? (
            <span className="inline-flex h-12 shrink-0 items-center rounded-xl bg-level-normal-soft px-4 font-semibold text-level-normal">경과 관찰 중</span>
          ) : (
            <ActionDialog
              patientId={patient.id}
              open={actionOpen}
              onOpenChange={(v) => {
                setActionOpen(v);
                if (!v) setActionPreset(null);
              }}
              preset={actionPreset}
              level={level}
              openFollowUps={followUps}
              limited
            />
          )}
        </div>
        <PatientContact patientId={patient.id} />
        <p className="text-xs text-muted-foreground">연락 업무에 필요한 정보만 표시됩니다. 사용 시간·게임 결과·점수는 의료진이 확인합니다.</p>
      </div>

      <div role="tablist" aria-label="환자 상세 보기" className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`ctab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="counselor-tabpanel"
            onClick={() => goTab(t.id)}
            className={cn(
              "flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
            {t.id === "history" && historyCount > 0 && <span className="ml-1 tabular-nums opacity-80">{historyCount}</span>}
          </button>
        ))}
      </div>

      <div key={tab} id="counselor-tabpanel" role="tabpanel" aria-labelledby={`ctab-${tab}`} className="tab-slide space-y-6">
        {tab === "guide" && <ResponseGuide guide={guide} sheet={sheet} normal={level === "정상"} onRecord={openActionWith} />}
        {tab === "calendar" && (
          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="mb-4 text-lg font-bold">접속 캘린더</h2>
            <AttendanceCalendar
              startDate={patient.prescription_start_date}
              weeks={patient.prescription_weeks}
              targetDays={patient.weekly_target_days}
              playedDates={playedDates}
            />
          </section>
        )}
        {tab === "history" && (
          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="mb-4 text-lg font-bold">연락 이력</h2>
            <FollowUpList patientId={patient.id} items={followUps} />
            <ContactHistory patientId={patient.id} alerts={alerts} actions={actions} logs={[]} limited />
          </section>
        )}
      </div>
    </div>
  );
}
