import { useState } from "react";
import { ClipboardList, Copy, MessageSquareText, Phone, Printer, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GUIDE_NOTE, type Guide } from "@/lib/response-guide";
import { buildGuardianSheetHtml, type GuardianSheetInput } from "@/lib/guardian-sheet";
import { cn } from "@/lib/utils";

type Tab = "steps" | "call" | "sms" | "plain";
const TABS: Array<{ id: Tab; label: string; icon: typeof Phone }> = [
  { id: "steps", label: "할 일", icon: ClipboardList },
  { id: "call", label: "전화 문장", icon: Phone },
  { id: "sms", label: "문자", icon: MessageSquareText },
  { id: "plain", label: "보호자 설명", icon: UserRound },
];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("복사했습니다.");
  } catch {
    toast.error("복사하지 못했습니다. 글을 직접 선택해서 복사해 주세요.");
  }
}

/** 보호자에게 건넬 한 장(A4 양식): 새 창에 띄우고 인쇄 창을 연다 */
function printSheet(sheet: GuardianSheetInput) {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) {
    toast.error("새 창을 열지 못했습니다. 팝업 차단을 확인해 주세요.");
    return;
  }
  w.document.write(buildGuardianSheetHtml(sheet));
  w.document.close();
  w.focus();
  // 글꼴과 레이아웃이 그려진 뒤 인쇄 창을 연다
  w.setTimeout(() => w.print(), 300);
}

/**
 * 환자 상세 '대응 가이드' 카드. 할 일, 전화 문장, 문자, 보호자 설명을 탭으로 보여 준다.
 * onRecord: '전화했어요'·'문자 보냈어요'를 누르면 조치 기록 창을 미리 채워서 연다.
 */
export function ResponseGuide({
  guide,
  sheet,
  normal,
  onRecord,
}: {
  guide: Guide;
  /** 보호자용 한 장 인쇄에 들어갈 정보 */
  sheet: GuardianSheetInput;
  normal: boolean;
  onRecord: (kind: "call" | "sms") => void;
}) {
  const [tab, setTab] = useState<Tab>("steps");
  const callText = guide.callScript.join("\n");

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card" aria-label="대응 가이드">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">대응 가이드</h2>
        <p className="text-xs text-muted-foreground">{GUIDE_NOTE}</p>
      </div>
      <p className="mt-1 font-medium">{guide.headline}</p>

      {!normal && (
        <div className="mt-4 flex gap-1 overflow-x-auto" role="tablist" aria-label="대응 가이드 구분">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                tab === t.id ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {(normal || tab === "steps") && (
          <div className="space-y-4">
            {guide.unreachableSteps.length > 0 && (
              <div className="rounded-xl bg-level-caution-soft p-4">
                <p className="mb-2 text-sm font-semibold text-level-caution-ink">연락이 닿지 않았을 때 (알림 결과 '연락 불가')</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {guide.unreachableSteps.map((s) => <li key={s}>{s}</li>)}
                </ol>
              </div>
            )}
            <ol className="list-decimal space-y-1.5 pl-5">
              {guide.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </div>
        )}

        {!normal && tab === "call" && (
          <div className="space-y-3">
            <ol className="space-y-2 rounded-xl bg-muted p-4">
              {guide.callScript.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-sm font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => copy(callText)}><Copy /> 복사</Button>
              <Button onClick={() => onRecord("call")}><Phone /> 전화했어요 (조치 기록)</Button>
            </div>
          </div>
        )}

        {!normal && tab === "sms" && (
          <div className="space-y-3">
            <p className="rounded-xl bg-muted p-4">{guide.sms}</p>
            <p className="text-xs text-muted-foreground">앱에서 문자가 보내지지는 않습니다. 복사해서 병원 문자 서비스로 보내 주세요. ({guide.sms.length}자)</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => copy(guide.sms)}><Copy /> 복사</Button>
              <Button onClick={() => onRecord("sms")}><MessageSquareText /> 문자 보냈어요 (조치 기록)</Button>
            </div>
          </div>
        )}

        {!normal && tab === "plain" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">점수 대신 보호자가 이해하기 쉬운 말로 바꿨습니다. 인쇄하면 아이 정보, 사용 현황, 주별 사용, 집에서 도울 방법, 문의 칸이 있는 A4 안내문이 나옵니다.</p>
            <ul className="list-disc space-y-1.5 rounded-xl bg-muted p-4 pl-9">
              {guide.plainSummary.map((s) => <li key={s}>{s}</li>)}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => copy(guide.plainSummary.join("\n"))}><Copy /> 복사</Button>
              <Button variant="outline" onClick={() => printSheet(sheet)}><Printer /> 보호자 안내문 인쇄</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
