import { AppointmentDetail } from "@/features/consultations/AppointmentDetail";
import { getCustomerAppointmentDetail } from "@/features/consultations/appointment/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function CustomerAppointmentDetailPage({
  params
}: {
  params: Promise<{
    consultationId: string;
  }>;
}) {
  const [session, routeParams] = await Promise.all([requireCurrentSession(), params]);
  const data = await getCustomerAppointmentDetail(session, routeParams.consultationId);

  return <AppointmentDetail data={data} />;
}
