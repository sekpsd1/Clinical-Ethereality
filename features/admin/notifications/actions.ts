"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { createNotificationSchema } from "@/features/admin/notifications/schema";

export type AdminNotificationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createNotificationAction(
  _previousState: AdminNotificationActionState,
  formData: FormData
): Promise<AdminNotificationActionState> {
  await requireAdminSession();
  const parsed = createNotificationSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Notification details are invalid."
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: parsed.data.userId
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!user || user.status === "archived" || user.status === "suspended") {
      return {
        status: "error",
        message: "Recipient is unavailable."
      };
    }

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: parsed.data.type,
        channel: "in_app",
        title: parsed.data.title,
        body: parsed.data.body || null,
        metadataJson: {
          source: "admin_manual"
        }
      }
    });
  } catch {
    return {
      status: "error",
      message: "Notification could not be sent. Try again."
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
  revalidatePath("/notifications");

  return {
    status: "success",
    message: "Notification sent."
  };
}
