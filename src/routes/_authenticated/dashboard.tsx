import { createFileRoute, Link } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { contactListQuery, myStaffQuery, patientsOverviewQuery, staffListQuery } from "@/lib/queries";
import { buildContactList, contactSummary, matchFilter, type ContactFilter } from "@/lib/contact-list";
import { ContactList, statusLabel } from "@/components/ContactList";
import { buildWorkSheetHtml } from "@/lib/work-sheet";
import { toast } from "sonner";
import { DailyCheckStatus } from "@/components/DailyCheck";
import { useAlertSettings } from "@/lib/alert-settings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SplitPatientDetail } from "@/components/SplitPatientDetail";
import { TeamWorkload } from "@/components/TeamWorkload";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: zodValidator(z.object({ patient: fallback(z.string(), "").optional() })),
  head: () => ({
    meta: [
      { title: "대시보드 | 이탈방지턱" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "처방 환자별 이탈 위험 점수와 단계를 한눈에 확인합니다." },
      { property: "og:title", content: "대시보드 | 이탈방지턱" },
      { property: "og:description", content: "처방 환자별 이탈 위험 점수와 단계를 한눈에 확인합니다." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(patientsOverviewQuery()),
  component: Dashboard,
});

type Tab = "today" | "all" | "mine";
const TAB_LABEL: Record<Tab, string> = { today: "오늘 연락", all: "전체", mine: "내 담당" };
const KPI: Array<{ id: ContactFilter; label: string; danger?: boolean }> = [
  { id: "new", label: "새로 나빠짐", danger: true },
  { id: "todo", label: "연락 전" },
  { id: "follow", label: "오늘 다시 연락" },
  { id: "unassigned", label: "담당 미지정", danger: true },
];

function Dashboard() {
  const { patient: patientId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selectPatient = (id?: string) => navigate({ search: (prev) => ({ ...prev, patient: id }), resetScroll: false });
  const { data: patients } = useSuspenseQuery(patientsOverviewQuery());
  const selectedId = patients.some((p) => p.id === patientId) ? patientId : undefined;
  const [retainedId, setRetainedId] = useState(selectedId);
  useEffect(() => {
    if (selectedId) {
      setRetainedId(selectedId);
      return;
    }
    const timer = window.setTimeout(() => setRetainedId(undefined), 300);
    return () => window.clearTimeout(timer);
  }, [selectedId]);
  const displayedId = selectedId ?? retainedId;
  const split = Boolean(selectedId);

  // 연락할 환자 기준 점수 (설정 → 업무, 이 브라우저에 저장)
  const { threshold } = useAlertSettings();
  const { data: cl } = useQuery(contactListQuery());
  const { data: staff = [] } = useQuery(staffListQuery());
  const { data: me } = useQuery(myStaffQuery());
  const myId = me?.staff?.id ?? null;
  const nameOf = (id: string | null) => (id === null ? "미지정" : (staff.find((s) => s.id === id)?.name ?? "알 수 없음"));

  const [tab, setTab] = useState<Tab>("today");
  const [kpi, setKpi] = useState<ContactFilter | null>(null);
  const all = cl ? buildContactList({ patients, threshold, ...cl, includeAll: true }) : [];
  const byTab = { today: all.filter((r) => r.inToday), all, mine: all.filter((r) => r.contactId === myId) };
  const sum = contactSummary(all);
  const shown = byTab[tab].filter((r) => matchFilter(r, kpi));

  function printList() {
    const html = buildWorkSheetHtml({
      title: `${TAB_LABEL[tab]}${kpi ? ` · ${KPI.find((k) => k.id === kpi)?.label}` : ""}`,
      rows: shown.map((r) => ({
        patient: r.name,
        level: r.level,
        reason: r.reason,
        status: statusLabel(r),
        contact: nameOf(r.contactId),
        badges: [r.newWorseAt ? "새로 나빠짐" : "", r.followDue ? (r.followDue.overdueDays > 0 ? `다시 연락 ${r.followDue.overdueDays}일 지남` : "오늘 다시 연락") : ""].filter(Boolean),
      })),
    });
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      toast.error("새 창을 열지 못했습니다. 팝업 차단을 확인해 주세요.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.setTimeout(() => win.print(), 300);
  }

  return (
    <div className={cn("dashboard-split", displayedId && "has-detail")} data-open={split}>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold">오늘 연락할 환자 {byTab.today.length}명</h1>
          <DailyCheckStatus inline />
        </div>

        {/* 요약 숫자: 누르면 그 환자만 걸러 보기 */}
        <div className={cn("grid gap-3", split ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
          {KPI.map((k) => {
            const n = sum[k.id];
            const on = kpi === k.id;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setKpi(on ? null : k.id)}
                aria-pressed={on}
                className={cn(
                  "rounded-2xl border bg-card px-4 py-3 text-left shadow-card transition hover:bg-muted",
                  on && "ring-2 ring-primary",
                )}
              >
                <span className={cn("block text-3xl font-bold tabular-nums", k.danger && n > 0 && "text-level-risk")}>{n}</span>
                <span className="text-sm text-muted-foreground">{k.label}</span>
              </button>
            );
          })}
        </div>

        <TeamWorkload myId={myId} />

        <section className="overflow-hidden rounded-2xl border bg-card shadow-card" aria-label="환자 목록">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="목록 범위">
              {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
                <Button
                  key={t}
                  variant="outline"
                  size="sm"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn("rounded-full", tab === t && "border-primary bg-primary text-primary-foreground hover:bg-primary/90")}
                >
                  {TAB_LABEL[t]} <span className="tabular-nums opacity-80">{byTab[t].length}</span>
                </Button>
              ))}
              {kpi && (
                <Button variant="ghost" size="sm" onClick={() => setKpi(null)} className="rounded-full text-muted-foreground">
                  {KPI.find((k) => k.id === kpi)?.label}만 보는 중 · 해제
                </Button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={printList} aria-label="목록 인쇄"><Printer /> 인쇄</Button>
          </div>
          {!split && (
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 border-y bg-muted px-5 py-2 text-xs font-semibold text-muted-foreground md:grid">
              <span>환자 · 이유</span><span>단계 · 점수</span><span>상태</span><span>연락 담당</span>
            </div>
          )}
          {patients.length === 0 ? (
            <div className="space-y-1 border-t p-8 text-center">
              <p className="font-semibold">담당 환자가 없습니다.</p>
              <p className="text-muted-foreground">관리자에게 담당 환자 배정을 요청하세요. 배정되면 이 목록에 나타납니다.</p>
            </div>
          ) : !cl ? (
            <p className="border-t px-5 py-6 text-sm text-muted-foreground" role="status">불러오는 중…</p>
          ) : (
            <div className="border-t md:border-t-0">
              <ContactList rows={shown} nameOf={nameOf} selectedId={selectedId} onSelect={(id) => selectPatient(id)} compact={split} />
            </div>
          )}
        </section>
        <p className="text-xs text-muted-foreground">
          오늘 연락: 주의 이상이고 {threshold}점 이상, 새로 나빠졌거나 다시 연락할 날이 된 환자. 기준 점수는{" "}
          <Link to="/settings" search={{ section: "work" }} className="text-primary underline-offset-2 hover:underline">설정</Link>에서 바꿉니다.
        </p>
      </div>

      {displayedId && <SplitPatientDetail patientId={displayedId} closing={!split} onClose={() => selectPatient()} />}
    </div>
  );
}
