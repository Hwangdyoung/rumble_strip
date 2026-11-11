import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("BOM과 머리줄을 붙이고, 특수문자 칸은 따옴표로 감싼다", () => {
    const csv = toCsv(["이름", "메모"], [["김하늘", '보호자 "통화", 다음 주'], ["이도윤", null]]);
    expect(csv.startsWith("﻿이름,메모\r\n")).toBe(true);
    expect(csv).toContain('김하늘,"보호자 ""통화"", 다음 주"');
    expect(csv.endsWith("이도윤,")).toBe(true);
  });
});
