import { notFound } from "next/navigation";
import { ConsultWaitingRoom } from "@/features/consultations/ConsultWaitingRoom";
import { getConsultationWaitingRoom } from "@/features/consultations/waiting-room/queries";

export default async function ConsultWaitingRoomPage({
  searchParams
}: {
  searchParams: Promise<{
    consultation?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await getConsultationWaitingRoom(params.consultation);

  if (!data) {
    notFound();
  }

  return <ConsultWaitingRoom data={data} />;
}
