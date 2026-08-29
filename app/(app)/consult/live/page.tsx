import { notFound } from "next/navigation";
import { LiveConsultation } from "@/features/consultations/LiveConsultation";
import { getLiveConsultationChat } from "@/features/consultations/chat/queries";

export default async function LiveConsultationPage({
  searchParams
}: {
  searchParams: Promise<{
    consultation?: string;
  }>;
}) {
  const params = await searchParams;
  const chat = await getLiveConsultationChat(params.consultation);

  if (!chat.consultationId) {
    notFound();
  }

  return <LiveConsultation chat={chat} />;
}
