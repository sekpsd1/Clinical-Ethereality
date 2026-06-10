import { ConsultDoctorList } from "@/features/consultations/ConsultDoctorList";
import { getConsultDoctorListData } from "@/features/consultations/doctor-list/queries";

export default async function ConsultPage() {
  const data = await getConsultDoctorListData();

  return <ConsultDoctorList data={data} />;
}
