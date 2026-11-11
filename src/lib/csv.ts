/** CSV 만들기: 쉼표·따옴표·줄바꿈이 든 칸은 따옴표로 감싼다. 엑셀이 한글을 읽도록 맨 앞에 BOM을 붙인다. */
export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
