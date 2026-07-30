import { DoctorPatientDetail } from "@/features/doctor/DoctorPatientDetail";
import { getDoctorPatientDetail } from "@/features/doctor/patients/detail-queries";

export default async function DoctorPatientDetailPage({
  params
}: {
  params: Promise<{
    patientId: string;
  }>;
}) {
  const { patientId } = await params;
  const data = await getDoctorPatientDetail(patientId);

  return <DoctorPatientDetail data={data} />;
}
