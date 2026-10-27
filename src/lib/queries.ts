import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeRisk } from "./risk";

export const patientsOverviewQuery = () =>
  queryOptions({
    queryKey: ["patients-overview"],
    queryFn: async () => {
      const [{ data: patients, error: e1 }, { data: logs, error: e2 }] = await Promise.all([
        supabase.from("patients").select("*").order("name"),
        supabase.from("play_logs").select("patient_id, session_start, play_minutes"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return (patients ?? [])
        .map((p) => {
          const own = (logs ?? []).filter((l) => l.patient_id === p.id);
          return { ...p, risk: computeRisk(p, own) };
        })
        .sort((a, b) => b.risk.score - a.risk.score);
    },
  });

export const patientDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["patient", id],
    queryFn: async () => {
      const [p, logs, actions] = await Promise.all([
        supabase.from("patients").select("*").eq("id", id).maybeSingle(),
        supabase.from("play_logs").select("*").eq("patient_id", id).order("session_start"),
        supabase.from("actions").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
      ]);
      if (p.error) throw p.error;
      if (logs.error) throw logs.error;
      if (actions.error) throw actions.error;
      return { patient: p.data, logs: logs.data ?? [], actions: actions.data ?? [] };
    },
  });
