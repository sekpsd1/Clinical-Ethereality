import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getRoleHomePath } from "@/features/auth/role-routing";
import { getCustomerDoctorProfile } from "@/features/consultations/doctor-profile/queries";
import { DoctorProfile } from "@/features/consultations/doctor-profile/DoctorProfile";
import { getActiveConsultAssessmentWhere } from "@/features/consultations/assessment/validity";
import { getAssessmentConsentPath, getConsultBookingPath } from "@/features/consultations/assessment/routes";

export default async function DoctorProfilePage({ params }: { params: Promise<{ doctorId: string }> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/line?next=%2Fconsult");
  if (session.role !== "customer") redirect(getRoleHomePath(session.role) as Route);
  const customer = await prisma.user.findFirst({
    where: { id: session.userId, lineUserId: session.lineUserId, role: "customer", status: "active" },
    select: { id: true }
  });
  if (!customer) redirect("/auth/line?next=%2Fconsult");
  const { doctorId } = await params;
  const doctor = await getCustomerDoctorProfile(doctorId);
  if (!doctor) notFound();
  const assessment = await prisma.consultAssessment.findFirst({
    where: getActiveConsultAssessmentWhere(session.userId, new Date()), select: { id: true }
  });
  return <DoctorProfile doctor={doctor} bookingHref={assessment ? getConsultBookingPath(doctor.id) : getAssessmentConsentPath(doctor.id)} />;
}
