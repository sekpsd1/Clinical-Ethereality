import { DoctorBooking } from "@/features/consultations/DoctorBooking";
import {
  getDoctorBookingData,
  getVerifiedRescheduleContext
} from "@/features/consultations/booking/queries";
import { requireCurrentSession } from "@/lib/auth/session";
import { getPatientVerificationStatus } from "@/features/identity-verification/service";

export default async function DoctorBookingPage({
  searchParams
}: {
  searchParams: Promise<{
    booking?: string;
    doctorId?: string;
    reschedule?: string;
  }>;
}) {
  const session = await requireCurrentSession();
  const params = await searchParams;
  const reschedule = await getVerifiedRescheduleContext(
    session.userId,
    params.reschedule
  );
  const [data, verification] = await Promise.all([
    getDoctorBookingData(reschedule?.doctorId ?? params.doctorId),
    getPatientVerificationStatus(session.userId)
  ]);

  return (
    <DoctorBooking
      data={data}
      verification={verification}
      bookingStatus={params.booking}
      rescheduleConsultationId={reschedule?.consultationId}
    />
  );
}
