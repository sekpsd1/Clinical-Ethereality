"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function markCustomerNotificationsReadAction(): Promise<void> {
  const session = await requireCurrentSession();

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

  revalidatePath("/notifications");
  revalidatePath("/profile");
}
