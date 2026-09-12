import { DoctorBooking } from "@/features/consultations/DoctorBooking";
import {
  getDoctorBookingData,
  getVerifiedRescheduleContext
} from "@/features/consultations/booking/queries";
import { requireCurrentSession } from "@/lib/auth/session";
import { getPatientVerificationStatus } from "@/features/identity-verification/service";
import { isAtLeast18 } from "@/features/consultations/consent/policy";
import { getActiveConsultAssessmentForUser } from "@/features/consultations/assessment/queries";
import {
  getAssessmentConsentPath,
  normalizeAssessmentDoctorId
} from "@/features/consultations/assessment/routes";
import { redirect } from "next/navigation";

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
  const [data, verification, activeAssessment] = await Promise.all([
    getDoctorBookingData(reschedule?.doctorId ?? params.doctorId),
    getPatientVerificationStatus(session.userId),
    reschedule || session.userId.startsWith("dev:")
      ? null
      : getActiveConsultAssessmentForUser(session.userId)
  ]);

  if (!reschedule && !session.userId.startsWith("dev:") && !activeAssessment) {
    redirect(getAssessmentConsentPath(normalizeAssessmentDoctorId(params.doctorId)));
  }

  return (
    <DoctorBooking
      data={data}
      verification={verification}
      canSelfConsent={Boolean(
        verification.dateOfBirth &&
        isAtLeast18(new Date(`${verification.dateOfBirth}T00:00:00.000Z`), new Date())
      )}
      bookingStatus={params.booking}
      rescheduleConsultationId={reschedule?.consultationId}
    />
  );
}
