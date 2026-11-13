import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { StaffProfileGate } from "@/components/StaffProfile";
import { DemoBanner } from "@/components/DemoEntry";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => (
    <div className="min-h-screen bg-background">
      <DemoBanner />
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <Disclaimer />
      <StaffProfileGate />
    </div>
  ),
});
