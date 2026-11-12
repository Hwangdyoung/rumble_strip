/**
 * 오늘 업무 목록 A4 인쇄용 HTML (의료진용). 환자 이름이 들어가므로 보관·폐기 주의 문구를 넣는다.
 */
export interface WorkSheetInput {
  title: string; // 예: "admin 담당" 또는 "전체"
  alerts: Array<{ patient: string; level: string | null; status: string; assignee: string; ageDays: number; overdue: boolean; handoffNote?: string | null }>;
  followUps: Array<{ patient: string; dueDate: string; overdueDays: number; assignee: string }>;
  printedAt?: Date;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const md = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;

export function buildWorkSheetHtml(d: WorkSheetInput): string {
  const printed = (d.printedAt ?? new Date()).toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const alertRows = d.alerts.length
    ? d.alerts
        .map(
          (a, i) => `<tr><td class="c">${i + 1}</td><td class="box">☐</td><td><b>${esc(a.patient)}</b>${a.handoffNote ? `<div class="sub">넘겨받음: ${esc(a.handoffNote)}</div>` : ""}</td><td>${esc(a.level ?? "-")}</td><td>${esc(a.status)}</td><td>${a.ageDays === 0 ? "오늘" : `${a.ageDays}일 지남`}${a.overdue ? ' <span class="late">지연</span>' : ""}</td><td>${esc(a.assignee)}</td><td class="memo"></td></tr>`,
        )
        .join("")
    : `<tr><td colspan="8" class="empty">처리할 알림이 없습니다.</td></tr>`;
  const followRows = d.followUps.length
    ? d.followUps
        .map(
          (f, i) => `<tr><td class="c">${i + 1}</td><td class="box">☐</td><td><b>${esc(f.patient)}</b></td><td>${md(f.dueDate)}${f.overdueDays > 0 ? ` <span class="late">${f.overdueDays}일 지남</span>` : " (오늘)"}</td><td>${esc(f.assignee)}</td><td class="memo"></td></tr>`,
        )
        .join("")
    : `<tr><td colspan="6" class="empty">오늘 다시 연락할 환자가 없습니다.</td></tr>`;

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>오늘 업무 목록</title>
<style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1d2733;font-size:13px;line-height:1.5;margin:0;padding:20px}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1f6f9a;padding-bottom:8px;margin-bottom:14px}
h1{font-size:21px;margin:0}
.meta{font-size:12px;color:#5a6670;text-align:right}
.warn{border:1px solid #e0a43a;background:#fff7e6;border-radius:6px;padding:6px 10px;font-size:12px;margin-bottom:14px}
h2{font-size:14px;margin:18px 0 6px;padding-left:8px;border-left:4px solid #1f6f9a}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #cdd6dd;padding:6px 7px;text-align:left;vertical-align:top}
th{background:#f1f5f8;font-weight:600;font-size:12px}
td.c{width:28px;text-align:center;color:#5a6670}
td.box{width:28px;text-align:center;font-size:16px}
td.memo{width:28%}
.sub{font-size:11px;color:#5a6670;margin-top:2px}
.late{color:#b4410f;font-weight:700}
.empty{text-align:center;color:#5a6670;padding:14px}
footer{margin-top:16px;font-size:11px;color:#5a6670}
@media print{body{padding:0}}
</style></head><body>
<header><div><h1>오늘 업무 목록</h1><div>${esc(d.title)}</div></div><div class="meta">출력 ${esc(printed)}<br>이탈방지턱</div></header>
<div class="warn">환자 정보가 들어 있습니다. 업무가 끝나면 정해진 방법으로 폐기하고, 외부로 가져가지 마세요.</div>
<h2>처리할 알림 (${d.alerts.length}건)</h2>
<table><thead><tr><th>#</th><th>완료</th><th>환자</th><th>알림 당시 단계</th><th>상태</th><th>경과</th><th>담당</th><th>메모</th></tr></thead><tbody>${alertRows}</tbody></table>
<h2>오늘 다시 연락 (${d.followUps.length}건)</h2>
<table><thead><tr><th>#</th><th>완료</th><th>환자</th><th>예정일</th><th>담당</th><th>메모</th></tr></thead><tbody>${followRows}</tbody></table>
<footer>진단이나 처방 변경이 아닌 참고용 업무 목록입니다. 처리 결과는 앱에 기록해 주세요.</footer>
</body></html>`;
}
