import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertsBell } from "@/components/AlertsBell";
import { myStaffQuery, patientsOverviewQuery, worklistQuery } from "@/lib/queries";
import { displayLoginId } from "@/lib/login-id";
import { canSeeClinical } from "@/lib/roles";

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M3 17h4c2 0 3-7 5-7s3 7 5 7h4" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight text-foreground">이탈방지턱</span>
    </span>
  );
}

export function AppHeader() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useQuery(myStaffQuery());

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/dashboard">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link to="/dashboard" className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground" activeProps={{ className: "text-primary" }}>대시보드</Link>
          {canSeeClinical(me?.staff) && (
            <Link to="/simulator" className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground" activeProps={{ className: "text-primary" }}>시뮬레이터</Link>
          )}
          {me?.staff?.is_admin && (
            <Link to="/admin" className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground" activeProps={{ className: "text-primary" }}>담당 관리</Link>
          )}
          <AlertsBell />
          <ProfileMenu onSignOut={signOut} />
        </nav>
      </div>
    </header>
  );
}

/** 헤더 이름표: 누르면 아래로 내 정보 요약과 설정·로그아웃이 펼쳐진다 (수정은 설정 화면에서) */
function ProfileMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: me } = useQuery(myStaffQuery());
  const { data: patients } = useQuery({ ...patientsOverviewQuery(), enabled: open });
  const { data: work } = useQuery({ ...worklistQuery(), enabled: open });
  const staff = me?.staff;
  const myId = staff?.id;
  const myOpenAlerts = work?.filter((a) => a.status !== "조치완료" && a.assignee_id === myId).length;
  const label = staff ? staff.name : me?.email ? displayLoginId(me.email) : "내 계정";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label="내 계정 메뉴">
          <UserRound /> <span className="hidden max-w-32 truncate lg:inline">{label}</span> <ChevronDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="space-y-1 border-b px-4 py-3">
          <p className="font-semibold">{label}</p>
          {staff && (
            <p className="text-sm text-muted-foreground">
              {staff.role}
              {staff.is_admin && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">관리자</span>}
            </p>
          )}
          {me?.email && <p className="text-xs text-muted-foreground">아이디 {displayLoginId(me.email)}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-2 border-b px-4 py-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{staff?.is_admin ? "볼 수 있는 환자" : "담당 환자"}</dt>
            <dd className="font-semibold tabular-nums">{patients ? `${patients.length}명` : "…"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">내가 맡은 알림</dt>
            <dd className="font-semibold tabular-nums">{myOpenAlerts === undefined ? "…" : `${myOpenAlerts}건`}</dd>
          </div>
        </dl>
        <div className="p-1">
          <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
            <Settings className="size-4" /> 설정
          </Link>
          <button type="button" onClick={onSignOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
            <LogOut className="size-4" /> 로그아웃
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
