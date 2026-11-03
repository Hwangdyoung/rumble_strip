import { createFileRoute, notFound } from "@tanstack/react-router";
import { patientDetailQuery } from "@/lib/queries";
import { PatientDetail } from "@/components/PatientDetail";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  head: () => ({
    meta: [
      { title: "환자 상세 | 이탈방지턱" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "환자의 위험 점수 추이, 플레이 기록, 조치 기록을 확인합니다." },
      { property: "og:title", content: "환자 상세 | 이탈방지턱" },
      { property: "og:description", content: "환자의 위험 점수 추이, 플레이 기록, 조치 기록을 확인합니다." },
    ],
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(patientDetailQuery(params.id));
    if (!data.patient) throw notFound();
  },
  component: PatientPage,
});

function PatientPage() {
  const { id } = Route.useParams();
  return <PatientDetail id={id} />;
}
