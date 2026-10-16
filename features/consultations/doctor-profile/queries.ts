import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export async function getCustomerDoctorProfile(doctorId: string) {
  noStore();
  if (!z.string().cuid().safeParse(doctorId).success) return null;
  return prisma.doctor.findFirst({
    where: { id: doctorId, status: "approved", user: { status: "active" } },
    select: {
      id: true, bio: true, specialty: true, licenseNumber: true, consultationFee: true,
      user: { select: { fullName: true, displayName: true, avatarUrl: true } }
    }
  });
}
