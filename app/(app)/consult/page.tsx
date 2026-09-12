import type { Route } from "next";
import { redirect } from "next/navigation";
import { ConsultDoctorList } from "@/features/consultations/ConsultDoctorList";
import { getRoleHomePath } from "@/features/auth/role-routing";
import { getConsultDoctorListData } from "@/features/consultations/doctor-list/queries";
import { getCurrentSession } from "@/lib/auth/session";

export default async function ConsultPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/line?next=%2Fconsult");
  }

  if (session.role !== "customer") {
    redirect(getRoleHomePath(session.role) as Route);
  }

  const data = await getConsultDoctorListData();

  return <ConsultDoctorList data={data} />;
}
