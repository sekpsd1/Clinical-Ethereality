import { notFound } from "next/navigation";
import { LiveConsultation } from "@/features/consultations/LiveConsultation";
import { getLiveConsultationChat } from "@/features/consultations/chat/queries";
import { getAppEnv } from "@/lib/env/schema";

export default async function LiveConsultationPage({
  searchParams
}: {
  searchParams: Promise<{
    consultation?: string;
  }>;
}) {
  const params = await searchParams;
  const chat = await getLiveConsultationChat(params.consultation);
  const liffId = getAppEnv().NEXT_PUBLIC_LINE_LIFF_ID;

  if (!chat.consultationId) {
    notFound();
  }

  return <LiveConsultation chat={chat} liffId={liffId} />;
}
