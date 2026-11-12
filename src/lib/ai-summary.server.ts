/**
 * AI 경과 요약 — 서버 전용 함수
 *
 * createServerFn / @anthropic-ai/sdk / process.env 는 이 파일에서만 사용한다.
 * 클라이언트 번들에 포함되지 않도록 TanStack Start 가 트리-쉐이크한다.
 * (핸들러 body 는 서버 번들에만 번들링됨)
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AiSummaryInput } from "@/lib/ai-summary";

// ─── 상수 ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "너는 디지털 치료제 이탈 관리 보조 도구다. 입력된 지표만 근거로 한국어 2~3문장으로 의료진이 이해하기 쉬운 경과 요약을 쓴다. 진단, 처방 변경, 약물 조언, 지표에 없는 추측은 하지 않는다. 연락이 필요한지와 어떤 방식의 접촉이 좋을지 정도만 권고한다.";

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function buildUserPrompt(input: AiSummaryInput): string {
  const m = input.metrics;
  const lines: string[] = [
    `위험 단계: ${input.level}`,
    `위험 점수: ${input.score}/100`,
    `추정 원인: ${input.cause ?? "없음"}`,
    `위험 이유: ${input.reasons.join(", ")}`,
    "",
    "--- 지표 ---",
    `순응도: ${Math.round(Math.min(m.adherence, 1) * 100)}%`,
    `연속 미접속일: ${m.currentGap}일`,
    `최근 7일 접속: ${m.recentDays}일`,
    `진행 회차: ${m.sessionsDone}/${m.sessionsExpected}회 (${m.sessionsBehind}회 지연)`,
    `정확도 하락: ${Math.round(m.accuracyDrop)}%p`,
    `최근 평균 정확도: ${m.recentAccuracy != null ? Math.round(m.recentAccuracy) + "%" : "데이터 없음"}`,
    `세션 시간 변화율: ${m.sessionChange >= 0 ? "+" : ""}${Math.round(m.sessionChange * 100)}%`,
    `최근 평균 세션: ${m.recentAvgMinutes != null ? Math.round(m.recentAvgMinutes) + "분" : "데이터 없음"}`,
    `짧은 세션 여부: ${m.shortSession ? "예" : "아니오"}`,
    `반응속도 변화: ${m.reactionChange != null ? (m.reactionChange >= 0 ? "+" : "") + Math.round(m.reactionChange * 100) + "%" : "데이터 없음"}`,
    `주별 사용량 연속 감소: ${m.weeklyDeclineStreak}주`,
  ];

  if (input.weeklySummary.length > 0) {
    lines.push("", "--- 주별 요약 ---");
    for (const w of input.weeklySummary) {
      lines.push(`${w.week}: 접속 ${w.days}일, 평균 세션 ${w.avgMinutes}분`);
    }
  }

  return lines.join("\n");
}

// ─── 서버 함수 ───────────────────────────────────────────────────────────────

/**
 * fetchAiSummary
 *
 * - requireSupabaseAuth 미들웨어: 로그인한 사용자만 호출 가능
 * - @anthropic-ai/sdk 와 process.env 는 핸들러 내부에서만 사용
 * - 3초 타임아웃: AbortController 로 처리 (초과 시 throw → 클라이언트 폴백)
 * - max_tokens 300 이하
 */
export const fetchAiSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => data as AiSummaryInput)
  .handler(async ({ data, context }) => {
    // 상담원은 AI 경과 요약(치료 경과 정보)을 받지 않는다 (역할별 접근, SQL 009)
    const { data: me } = await context.supabase.from("staff").select("role, is_admin").eq("id", context.userId).maybeSingle();
    if (!me || !(me.is_admin || me.role === "의사" || me.role === "간호사")) {
      throw new Error("AI 경과 요약은 의료진만 볼 수 있습니다.");
    }

    // @anthropic-ai/sdk 는 핸들러 body 안에서만 동적 import — 서버 번들에만 포함됨
    const { default: Anthropic } = await import("@anthropic-ai/sdk");

    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.");
    }

    const model = process.env["ANTHROPIC_MODEL"] ?? "claude-haiku-4-5";
    const client = new Anthropic({ apiKey });

    // 3초 타임아웃
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const message = await client.messages.create(
        {
          model,
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(data) }],
        },
        { signal: controller.signal },
      );

      const block = message.content[0];
      if (!block || block.type !== "text") {
        throw new Error("Claude API에서 텍스트 응답을 받지 못했습니다.");
      }

      return { summary: block.text.trim() };
    } finally {
      clearTimeout(timer);
    }
  });

