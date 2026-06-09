import { LiveConsultation } from "@/features/consultations/LiveConsultation";
import { getLiveConsultationChat } from "@/features/consultations/chat/queries";

export default async function LiveConsultationPage() {
  const chat = await getLiveConsultationChat();

  return <LiveConsultation chat={chat} />;
}
