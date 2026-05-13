import { DoctorPatients } from "@/features/doctor/DoctorPatients";
import { getDoctorPatients } from "@/features/doctor/patients/queries";

export default async function DoctorPatientsPage() {
  const data = await getDoctorPatients();

  return <DoctorPatients data={data} />;
}
