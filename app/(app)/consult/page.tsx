import type { Route } from "next";
import { redirect } from "next/navigation";
import { ConsultDoctorList } from "@/features/consultations/ConsultDoctorList";
import { getRoleHomePath } from "@/features/auth/role-routing";
import { getConsultDoctorListData } from "@/features/consultations/doctor-list/queries";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function ConsultPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/line?next=%2Fconsult");
  }

  if (session.role !== "customer") {
    redirect(getRoleHomePath(session.role) as Route);
  }

  const persistedCustomer = await prisma.user.findFirst({
    where: {
      id: session.userId,
      lineUserId: session.lineUserId,
      role: "customer",
      status: "active"
    },
    select: { id: true }
  });

  if (!persistedCustomer) {
    redirect("/auth/line?next=%2Fconsult");
  }

  const data = await getConsultDoctorListData();

  return <ConsultDoctorList data={data} />;
}
