import { createFileRoute, redirect } from "@tanstack/react-router";

// 기존 전체 화면 주소는 대시보드 분할 화면으로 연결합니다.
export const Route = createFileRoute("/_authenticated/patients/$id")({
  head: () => ({ meta: [
    { title: "환자 상세 | 이탈방지턱" },
    { name: "description", content: "처방 환자의 플레이 기록과 위험 변화 및 조치 기록을 확인합니다." },
    { property: "og:title", content: "환자 상세 | 이탈방지턱" },
    { property: "og:description", content: "처방 환자의 플레이 기록과 위험 변화 및 조치 기록을 확인합니다." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/dashboard", search: { patient: params.id } });
  },
});
