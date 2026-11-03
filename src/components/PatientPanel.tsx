import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { PatientDetail } from "@/components/PatientDetail";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type Props = {
  patientId: string | undefined;
  patientIds: string[];
  onSelect: (id?: string) => void;
};

export function PatientPanel({ patientId, patientIds, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Retain content through the closing animation; selection itself remains URL state.
  const lastPatient = useRef(patientId);
  useEffect(() => {
    if (patientId) lastPatient.current = patientId;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [patientId]);
  const displayId = patientId ?? lastPatient.current;
  const index = patientId ? patientIds.indexOf(patientId) : -1;
  const previous = index > 0 ? patientIds[index - 1] : undefined;
  const next = index >= 0 ? patientIds[index + 1] : undefined;

  return (
    <Sheet open={Boolean(patientId)} onOpenChange={(open) => { if (!open) onSelect(); }}>
      <SheetContent
        className="patient-panel flex w-full max-w-none flex-col gap-0 p-0 sm:w-[max(480px,43vw)] sm:max-w-none"
        overlayClassName="duration-250 motion-reduce:animate-none"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          const row = Array.from(document.querySelectorAll<HTMLElement>("[data-patient-id]")).find((element) => element.dataset["patientId"] === lastPatient.current);
          if (row) { event.preventDefault(); row.focus(); }
        }}
      >
        <header className="shrink-0 border-b bg-card px-5 pb-4 pt-5 pr-16">
          <SheetTitle>환자 상세</SheetTitle>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={!previous} onClick={() => previous && onSelect(previous)}><ChevronLeft /> 이전 환자</Button>
            <Button variant="outline" size="sm" disabled={!next} onClick={() => next && onSelect(next)}>다음 환자 <ChevronRight /></Button>
            {displayId && <Button asChild variant="link" size="sm" className="px-0"><Link to="/patients/$id" params={{ id: displayId }}><ExternalLink /> 전체 화면으로 보기</Link></Button>}
          </div>
        </header>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {displayId && <div key={displayId} className="patient-panel-content"><PatientDetail id={displayId} panel /></div>}
        </div>
      </SheetContent>
    </Sheet>
  );
}