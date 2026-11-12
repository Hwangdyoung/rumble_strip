/**
 * 보호자에게 건네는 '스타러커스 사용 안내' 한 장 (A4 인쇄용 HTML).
 * 점수·위험 단계는 쓰지 않고, 사용 현황 숫자와 쉬운 설명만 담는다.
 * 숫자는 risk.ts의 결과(지표)와 weeklySummary를 그대로 쓴다.
 */

export interface GuardianSheetInput {
  patientName: string;
  age: number;
  prescriptionStartDate: string; // YYYY-MM-DD
  prescriptionWeeks: number;
  weeklyTargetDays: number;
  sessionTargetMinutes: number;
  adherence: number; // 0~1.2
  recentDays: number;
  currentGap: number;
  sessionsDone: number;
  sessionsExpected: number;
  weeks: Array<{ week: string; days: number; avgMinutes: number }>;
  /** 보호자 설명 문장 (response-guide의 plainSummary) */
  notes: string[];
  staffName?: string | null;
  printedAt?: Date;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const HOME_TIPS = [
  "매일 비슷한 시간에 하도록 정해 두면 습관이 되기 쉬워요.",
  "하기 싫어하는 날에는 짧게라도 시작해 보도록 격려해 주세요.",
  "끝까지 했을 때 결과보다 노력한 점을 칭찬해 주세요.",
  "아이가 어려워하거나 지루해하면 혼내기보다 병원에 알려 주세요. 의료진이 함께 살펴봅니다.",
];

export function buildGuardianSheetHtml(d: GuardianSheetInput): string {
  const printed = (d.printedAt ?? new Date()).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const [y, m, day] = d.prescriptionStartDate.split("-").map(Number);
  const start = `${y}년 ${m}월 ${day}일`;
  const pct = Math.round(Math.min(d.adherence, 1) * 100);
  const maxDays = 7;
  const weekRows = d.weeks
    .slice(0, Math.max(d.prescriptionWeeks, d.weeks.length))
    .map((w) => {
      const width = Math.round((Math.min(w.days, maxDays) / maxDays) * 100);
      const goal = Math.round((d.weeklyTargetDays / maxDays) * 100);
      return `<tr><th>${esc(w.week)}</th><td><div class="bar"><span style="width:${width}%"></span><i style="left:${goal}%"></i></div></td><td class="num">${w.days}일 / ${d.weeklyTargetDays}일</td><td class="num">${w.days > 0 ? `${w.avgMinutes}분` : "-"}</td></tr>`;
    })
    .join("");
  // 마지막 문장(격려)은 따로 강조하고, 나머지는 '확인된 점'으로
  const notes = d.notes.slice(0, -1);
  const closing = d.notes[d.notes.length - 1] ?? "";

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(d.patientName)} 스타러커스 사용 안내</title>
<style>
@page{size:A4;margin:16mm}
*{box-sizing:border-box}
body{font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1d2733;font-size:14px;line-height:1.65;margin:0;padding:24px}
.sheet{max-width:720px;margin:0 auto}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1f6f9a;padding-bottom:10px;margin-bottom:18px}
header .brand{font-size:12px;color:#1f6f9a;font-weight:700;letter-spacing:.04em}
header h1{font-size:24px;margin:2px 0 0}
header .date{font-size:12px;color:#5a6670;text-align:right}
table{width:100%;border-collapse:collapse}
.info th,.info td{border:1px solid #cdd6dd;padding:7px 10px;text-align:left;font-size:13px}
.info th{background:#f1f5f8;width:18%;font-weight:600;white-space:nowrap}
h2{font-size:15px;margin:22px 0 8px;padding-left:8px;border-left:4px solid #1f6f9a}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.kpi{border:1px solid #cdd6dd;border-radius:8px;padding:10px;text-align:center}
.kpi b{display:block;font-size:20px}
.kpi span{font-size:12px;color:#5a6670}
.weeks th,.weeks td{padding:6px 8px;border-bottom:1px solid #e3e9ed;font-size:13px}
.weeks th{text-align:left;font-weight:600;width:14%}
.weeks .num{text-align:right;white-space:nowrap;width:18%}
.bar{position:relative;height:12px;background:#eef2f5;border-radius:6px}
.bar span{display:block;height:100%;background:#2b8bb8;border-radius:6px}
.bar i{position:absolute;top:-3px;bottom:-3px;border-left:2px dashed #1d2733}
.legend{font-size:11px;color:#5a6670;margin-top:4px}
ul{margin:0;padding-left:20px}
li{margin-bottom:4px}
.closing{margin-top:10px;background:#eef6f9;border-radius:8px;padding:10px 12px;font-weight:600}
.contact th,.contact td{border:1px solid #cdd6dd;padding:9px 10px;font-size:13px}
.contact th{background:#f1f5f8;width:18%;text-align:left;font-weight:600}
.blank{color:#9aa6ae}
footer{margin-top:22px;padding-top:8px;border-top:1px solid #cdd6dd;font-size:11px;color:#5a6670;display:flex;justify-content:space-between}
@media print{body{padding:0}}
</style></head><body><div class="sheet">
<header><div><div class="brand">이탈방지턱 · 보호자 안내</div><h1>스타러커스 사용 안내</h1></div><div class="date">출력일 ${esc(printed)}</div></header>

<table class="info"><tr><th>아이 이름</th><td>${esc(d.patientName)} (${d.age}세)</td><th>처방 시작일</th><td>${esc(start)}</td></tr>
<tr><th>처방 내용</th><td colspan="3">${d.prescriptionWeeks}주 동안 · 주 ${d.weeklyTargetDays}회 · 하루 약 ${d.sessionTargetMinutes}분</td></tr></table>

<h2>지금까지 사용 현황</h2>
<div class="kpis">
<div class="kpi"><b>${pct}%</b><span>처방 기준 대비 사용</span></div>
<div class="kpi"><b>${d.recentDays}일</b><span>최근 7일 중 사용</span></div>
<div class="kpi"><b>${d.sessionsDone}/${d.sessionsExpected}회</b><span>지금까지 사용 횟수</span></div>
<div class="kpi"><b>${d.currentGap >= 2 ? `${d.currentGap}일` : "없음"}</b><span>연속으로 쉰 날</span></div>
</div>

<h2>주별 사용</h2>
<table class="weeks">${weekRows}</table>
<p class="legend">막대: 그 주에 사용한 날 수 (7일 기준) · 점선: 목표 주 ${d.weeklyTargetDays}일</p>

<h2>확인된 점</h2>
<ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
${closing ? `<p class="closing">${esc(closing)}</p>` : ""}

<h2>집에서 이렇게 도와주세요</h2>
<ul>${HOME_TIPS.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>

<h2>문의</h2>
<table class="contact">
<tr><th>병원</th><td class="blank">&nbsp;</td><th>담당자</th><td>${d.staffName ? esc(d.staffName) : '<span class="blank">&nbsp;</span>'}</td></tr>
<tr><th>연락처</th><td class="blank">&nbsp;</td><th>다음 연락 예정</th><td class="blank">&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;일</td></tr>
</table>

<footer><span>진단이나 처방 변경이 아닌 참고용 안내입니다. 궁금한 점은 담당 의료진에게 문의해 주세요.</span><span>이탈방지턱</span></footer>
</div></body></html>`;
}
