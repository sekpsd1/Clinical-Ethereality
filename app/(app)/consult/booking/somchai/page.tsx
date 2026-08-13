import { DoctorBooking } from "@/features/consultations/DoctorBooking";
import { getDoctorBookingData } from "@/features/consultations/booking/queries";
import { requireCurrentSession } from "@/lib/auth/session";
import { getPatientVerificationStatus } from "@/features/identity-verification/service";

export default async function DoctorBookingPage({
  searchParams
}: {
  searchParams: Promise<{
    booking?: string;
  }>;
}) {
  const session = await requireCurrentSession();
  const [data, params, verification] = await Promise.all([
    getDoctorBookingData(),
    searchParams,
    getPatientVerificationStatus(session.userId)
  ]);

  return <DoctorBooking data={data} verification={verification} bookingStatus={params.booking} />;
}
