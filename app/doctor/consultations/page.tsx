import { DoctorConsultations } from "@/features/doctor/DoctorConsultations";
import { getDoctorConsultations } from "@/features/doctor/consultations/queries";

export default async function DoctorConsultationsPage() {
  const data = await getDoctorConsultations();

  return <DoctorConsultations data={data} />;
}
