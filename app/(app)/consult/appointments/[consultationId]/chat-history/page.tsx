import { notFound } from "next/navigation";
import type { Route } from "next";
import { ConsultationChatHistory } from "@/features/consultations/chat/ConsultationChatHistory";
import { getConsultationChatHistory } from "@/features/consultations/chat/history-queries";
import { requireCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerConsultationChatHistoryPage({
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
    "customer",
    requestedPage
  );

  if (!data) {
    notFound();
  }

  const routeBase = `/consult/appointments/${encodeURIComponent(data.consultationId)}/chat-history`;

  return (
    <ConsultationChatHistory
      data={data}
      backHref={`/consult/appointments/${data.consultationId}` as Route}
      pageHref={routeBase}
    />
  );
}
