import { createFileRoute, redirect } from "@tanstack/react-router";

// 기존 전체 화면 주소는 대시보드 분할 화면으로 연결합니다.
export const Route = createFileRoute("/_authenticated/patients/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/dashboard", search: { patient: params.id } });
  },
});
