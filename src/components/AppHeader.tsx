import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

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
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

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
        <div className="flex items-center gap-3">
          {email && <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>}
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut /> 로그아웃
          </Button>
        </div>
      </div>
    </header>
  );
}
