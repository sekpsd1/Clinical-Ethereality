import { DoctorBooking } from "@/features/consultations/DoctorBooking";
import { getDoctorBookingData } from "@/features/consultations/booking/queries";

export default async function DoctorBookingPage({
  searchParams
}: {
  searchParams: Promise<{
    booking?: string;
  }>;
}) {
  const [data, params] = await Promise.all([getDoctorBookingData(), searchParams]);

  return <DoctorBooking data={data} bookingStatus={params.booking} />;
}
