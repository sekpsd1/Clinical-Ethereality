import { notFound } from "next/navigation";
import { ConsultationChatHistory } from "@/features/consultations/chat/ConsultationChatHistory";
import { getConsultationChatHistory } from "@/features/consultations/chat/history-queries";
import { requireCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DoctorConsultationChatHistoryPage({
  params,
  searchParams
}: {
  params: Promise<{ consultationId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [session, routeParams, query] = await Promise.all([
    requireCurrentSession(),
    params,
    searchParams
  ]);
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const data = await getConsultationChatHistory(
    session,
    routeParams.consultationId,
    "doctor",
    requestedPage
  );

  if (!data) {
    notFound();
  }

  const routeBase = `/doctor/consultations/${encodeURIComponent(data.consultationId)}/chat-history`;

  return (
    <ConsultationChatHistory
      data={data}
      backHref="/doctor/consultations"
      pageHref={routeBase}
    />
  );
}
