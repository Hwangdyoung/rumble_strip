import { useEffect, useRef } from "react";
import { ArrowLeft, X } from "lucide-react";
import { PatientDetail } from "@/components/PatientDetail";
import { Button } from "@/components/ui/button";

type Props = {
  patientId: string;
  onClose: () => void;
};

/** 대시보드 오른쪽 분할 상세 (데스크톱: 나란히, 모바일: 전체 화면 슬라이드) */
export function SplitPatientDetail({ patientId, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastPatient = useRef(patientId);

  useEffect(() => {
    lastPatient.current = patientId;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [patientId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      aria-label="환자 상세"
      className="split-detail fixed inset-0 z-40 flex flex-col bg-background md:static md:z-auto md:w-3/5 md:min-w-0 md:self-start md:rounded-2xl md:border md:bg-card md:shadow-card"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-4 py-3 md:rounded-t-2xl">
        <Button variant="ghost" size="sm" onClick={onClose} className="md:hidden"><ArrowLeft /> 목록으로</Button>
        <span className="hidden text-sm font-semibold text-muted-foreground md:inline">환자 상세</span>
        <Button variant="outline" size="icon" aria-label="상세 닫기" onClick={onClose} className="ml-auto"><X /></Button>
      </header>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 md:max-h-[calc(100vh-7rem)]">
        <div key={lastPatient.current} className="detail-fade">
          <PatientDetail id={lastPatient.current} panel />
        </div>
      </div>
    </aside>
  );
}
