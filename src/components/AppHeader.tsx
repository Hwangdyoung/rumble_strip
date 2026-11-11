import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AlertsBell } from "@/components/AlertsBell";
import { StaffProfileDialog } from "@/components/StaffProfile";
import { myStaffQuery } from "@/lib/queries";
import { displayLoginId } from "@/lib/login-id";

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
  const [profileOpen, setProfileOpen] = useState(false);

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
          <Link to="/simulator" className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground" activeProps={{ className: "text-primary" }}>시뮬레이터</Link>
          {me?.staff?.is_admin && (
            <Link to="/admin" className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground" activeProps={{ className: "text-primary" }}>담당 관리</Link>
          )}
          <AlertsBell />
          {me?.staff ? (
            <Button variant="ghost" size="sm" onClick={() => setProfileOpen(true)} aria-label="내 정보" className="text-muted-foreground">
              <UserRound /> <span className="hidden lg:inline">{me.staff.name} · {me.staff.role}{me.staff.is_admin ? " · 관리자" : ""}</span>
            </Button>
          ) : (
            me?.email && <span className="hidden text-sm text-muted-foreground lg:inline">{displayLoginId(me.email)}</span>
          )}
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut /> <span className="hidden sm:inline">로그아웃</span>
          </Button>
        </nav>
      </div>
      <StaffProfileDialog open={profileOpen} onOpenChange={setProfileOpen} current={me?.staff ?? null} />
    </header>
  );
}
