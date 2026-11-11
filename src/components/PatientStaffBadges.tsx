import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { patientStaffQuery } from "@/lib/queries";

/** 환자 상세: 이 환자의 담당 의료진 */
export function PatientStaffBadges({ patientId }: { patientId: string }) {
  const { data, isPending, isError } = useQuery(patientStaffQuery(patientId));
  if (isPending || isError) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <Users className="size-4" aria-hidden />
      <span>담당</span>
      {data.length === 0 ? (
        <span>미배정</span>
      ) : (
        data.map((s) => (
          <span key={s.id} className="rounded-full bg-muted px-2 py-0.5 text-foreground">
            {s.name} <span className="text-muted-foreground">{s.role}</span>
            {s.is_contact && <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">연락</span>}
          </span>
        ))
      )}
    </p>
  );
}
