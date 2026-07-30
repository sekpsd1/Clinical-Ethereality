"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { resolveCustomerNotificationHref } from "@/features/notifications/queries";

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

export async function openCustomerNotificationAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  const notificationId = formData.get("notificationId");

  if (typeof notificationId !== "string" || !notificationId) {
    return;
  }

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: session.userId,
      channel: "in_app"
    },
    select: {
      id: true,
      type: true,
      metadataJson: true
    }
  });

  if (!notification) {
    return;
  }

  await prisma.notification.update({
    where: {
      id: notification.id
    },
    data: {
      readAt: new Date()
    }
  });

  revalidatePath("/notifications");
  revalidatePath("/profile");
  redirect(resolveCustomerNotificationHref(notification) as Route);
}
