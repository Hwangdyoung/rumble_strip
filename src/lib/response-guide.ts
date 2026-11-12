/**
 * 대응 가이드 문구 (순수 함수). 위험 단계·추정 원인·지표 숫자로 할 일, 전화 문장, 문자, 보호자용 설명을 만든다.
 *
 * - 숫자는 risk.ts가 계산한 결과(RiskResult)를 그대로 쓴다. 여기서 점수를 다시 계산하지 않는다.
 * - 진단, 처방 변경, 약물 이야기는 넣지 않는다. 난이도는 "의료진이 조정을 검토"까지만 쓴다.
 * - 모든 문구는 초기 예시다. 실제 현장 검토를 받지 않았으므로 화면에 그 사실을 표시한다.
 */
import type { RiskCause, RiskLevel, RiskResult } from "./risk";

export interface GuideInput {
  risk: Pick<RiskResult, "level" | "cause" | "metrics">;
  patientName: string;
  weeklyTargetDays: number;
  sessionTargetMinutes: number;
  /** 처리 안 된 알림의 결과가 '연락 불가'로 기록돼 있으면 true */
  unreachable?: boolean;
  /** 연락하는 사람 이름 (없으면 빈칸 표시) */
  staffName?: string | null;
}

export interface Guide {
  /** 한 줄 요약 */
  headline: string;
  /** 할 일 순서 */
  steps: string[];
  /** 연락이 안 될 때 할 일 ('연락 불가' 기록 시 앞에 보여 줌) */
  unreachableSteps: string[];
  /** 전화 문장 (한 줄씩) */
  callScript: string[];
  /** 연결이 안 됐을 때 남길 문자 */
  sms: string;
  /** 보호자에게 설명할 쉬운 말 (점수는 쓰지 않음) */
  plainSummary: string[];
}

export const GUIDE_NOTE = "초기 예시 문구입니다. 기관 상황에 맞게 고쳐 쓰세요.";
const HOSPITAL = "[병원 이름]";

const LEVEL_STEPS: Record<RiskLevel, string[]> = {
  정상: ["경과 관찰을 유지합니다. 따로 연락할 필요는 없습니다.", "다음 진료 때 꾸준히 사용한 점을 칭찬해 주세요."],
  주의: [
    "이번 주 안에 보호자에게 가볍게 안부 연락을 합니다(문자도 괜찮습니다).",
    "사용하면서 어려운 점이 있는지 묻습니다.",
    "3일 뒤 접속 기록을 다시 확인합니다.",
  ],
  "이탈 위험": [
    "오늘 안에 보호자에게 전화합니다.",
    "연결이 안 되면 문자를 남기고 다음 날 다시 전화합니다.",
    "어려운 점(사용 시간, 기기, 아이의 흥미 등)을 듣고 조치 기록에 남깁니다.",
    "2~3일 뒤 접속 기록을 다시 확인합니다.",
  ],
  치료이탈: [
    "오늘 안에 보호자에게 전화해 지금 상황을 확인합니다.",
    "다시 시작할 의사가 있는지 묻고, 필요하면 내원이나 상담 일정을 잡도록 안내합니다.",
    "통화 내용을 담당 의사와 공유합니다.",
    "연결이 안 되면 다른 연락처를 확인합니다.",
  ],
};

const CAUSE_STEP: Record<RiskCause, string> = {
  "난이도 과다": "아이가 게임을 어려워하는지 확인하고, 의료진이 난이도 조정을 검토하도록 전달합니다.",
  "난이도 낮음": "아이가 너무 쉽거나 지루해하는지 확인하고, 의료진이 난이도 조정을 검토하도록 전달합니다.",
  "단순 미접속": "사용하는 시간·장소, 기기 문제처럼 생활 속 어려움이 있는지 확인합니다.",
};

const CAUSE_QUESTION: Record<RiskCause, string> = {
  "난이도 과다": "요즘 아이가 게임을 어려워하거나 하기 싫어하는 모습이 있었나요?",
  "난이도 낮음": "아이가 게임이 너무 쉽다거나 지루하다고 하지는 않나요?",
  "단순 미접속": "하루 중 언제 하고 있는지, 시간이나 기기 문제로 어려운 점은 없으신가요?",
};

export const UNREACHABLE_STEPS = [
  "다른 보호자 연락처나 연락하기 좋은 시간을 확인합니다.",
  "문자를 남기고 2~3일 뒤 다시 전화합니다.",
  "여러 번 연결이 안 되면 담당 의사와 다음 대응을 상의합니다.",
  "필요하면 지역아동센터 등 지역 기관 연계를 검토합니다.",
];

const pct = (v: number) => Math.round(Math.min(v, 1) * 100);

/** 지금 상황을 한 문장으로 (전화·문자에 씀) */
function situation(input: GuideInput): string {
  const m = input.risk.metrics;
  if (m.currentGap >= 2) return `최근 ${m.currentGap}일 동안 스타러커스 접속 기록이 없어서 연락드렸어요.`;
  if (m.recentDays < input.weeklyTargetDays) return `최근 일주일 동안 ${m.recentDays}일 사용하셔서(목표 주 ${input.weeklyTargetDays}일) 안부 겸 연락드렸어요.`;
  return "스타러커스 사용은 잘 되고 있는지 안부 겸 연락드렸어요.";
}

export function buildGuide(input: GuideInput): Guide {
  const { level, cause, metrics: m } = input.risk;
  const name = input.patientName;
  const staff = input.staffName?.trim() || "[담당자 이름]";

  const steps = [...LEVEL_STEPS[level]];
  if (level !== "정상" && cause) steps.splice(Math.min(2, steps.length), 0, CAUSE_STEP[cause]);

  const headline =
    level === "정상"
      ? "처방대로 진행 중입니다. 경과 관찰을 유지하세요."
      : level === "주의"
        ? "사용이 줄고 있습니다. 이번 주 안에 가볍게 연락해 보세요."
        : level === "이탈 위험"
          ? "그만둘 가능성이 있습니다. 오늘 안에 보호자와 통화해 보세요."
          : "사용이 멈춘 상태입니다. 오늘 안에 연락해 다시 시작할 수 있도록 도와주세요.";

  const callScript = [
    `안녕하세요, ${name} 보호자님. ${HOSPITAL} ${staff}입니다. 스타러커스 사용과 관련해 잠시 통화 괜찮으실까요?`,
    situation(input),
    cause ? CAUSE_QUESTION[cause] : "사용하면서 불편하거나 어려운 점은 없으셨나요?",
    "말씀해 주신 내용은 의료진과 함께 살펴보고 도와드릴게요.",
    level === "치료이탈"
      ? "다시 시작하실 수 있도록 내원이나 상담 일정을 잡아 드릴까요?"
      : "며칠 뒤에 다시 한번 연락드려도 될까요?",
  ];

  const sms =
    level === "치료이탈"
      ? `${name} 보호자님, ${HOSPITAL}입니다. 최근 스타러커스 사용이 멈춰 있어 안부 연락드립니다. 편하실 때 연락 주시면 다시 시작하실 수 있도록 도와드릴게요.`
      : `${name} 보호자님, ${HOSPITAL}입니다. 최근 스타러커스 사용이 줄어 안부 연락드립니다. 어려운 점이 있으면 편하실 때 연락 주세요.`;

  const plainSummary = [
    `처방 기준(주 ${input.weeklyTargetDays}회, 하루 ${input.sessionTargetMinutes}분) 대비 ${pct(m.adherence)}% 사용했어요.`,
    `최근 일주일 중 ${m.recentDays}일 사용했어요.`,
  ];
  if (m.currentGap >= 2) plainSummary.push(`${m.currentGap}일째 사용 기록이 없어요.`);
  if (m.accuracyDrop >= 5) plainSummary.push("최근 게임 정답률이 처음보다 조금 낮아졌어요.");
  if (m.shortSession) plainSummary.push("한 번에 하는 시간이 목표보다 짧아졌어요.");
  plainSummary.push("꾸준히 사용하는 것이 가장 중요해요. 어려운 점이 있으면 언제든 말씀해 주세요.");

  return { headline, steps, unreachableSteps: input.unreachable ? UNREACHABLE_STEPS : [], callScript, sms, plainSummary };
}

/** 조치 기록 창에 미리 채울 메모 틀 */
export const ACTION_MEMO_TEMPLATE = {
  call: "보호자 통화\n· 들은 어려운 점: \n· 다음 약속: ",
  sms: (sms: string) => `문자 발송\n· 보낸 내용: ${sms}`,
} as const;
