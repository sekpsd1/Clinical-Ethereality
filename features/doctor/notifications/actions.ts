"use server";

import { revalidatePath } from "next/cache";
import { requireDoctorSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function markDoctorNotificationsReadAction(): Promise<void> {
  const session = await requireDoctorSession();

  await prisma.notification.updateMany({
    where: {
      userId: session.userId,
      channel: "in_app",
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });

  revalidatePath("/doctor/notifications");
}
