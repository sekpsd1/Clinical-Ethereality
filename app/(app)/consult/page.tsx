import type { Route } from "next";
import { redirect } from "next/navigation";
import { ConsultDoctorList } from "@/features/consultations/ConsultDoctorList";
import { getRoleHomePath } from "@/features/auth/role-routing";
import { getConsultDoctorListData } from "@/features/consultations/doctor-list/queries";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function ConsultPage({ searchParams }: {
  searchParams?: Promise<{ specialty?: string | string[] }>;
}) {
  const specialty = (await searchParams)?.specialty;
  const category = specialty === "genetics" || specialty === "gynecology" ? specialty : "all";
  const returnPath = category === "all" ? "/consult" : "/consult?specialty=" + category;
  const session = await getCurrentSession();

  if (!session) {
    redirect(("/auth/line?next=" + encodeURIComponent(returnPath)) as Route);
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
    redirect(("/auth/line?next=" + encodeURIComponent(returnPath)) as Route);
  }

  const data = await getConsultDoctorListData();

  return <ConsultDoctorList data={data} category={category} />;
}
