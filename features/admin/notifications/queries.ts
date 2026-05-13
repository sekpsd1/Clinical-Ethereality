import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type {
  AdminNotificationItem,
  AdminNotificationRecipient,
  AdminNotificationsData
} from "@/features/admin/notifications/types";

type NotificationWithUser = Awaited<ReturnType<typeof getRecentNotifications>>[number];

function getRecipients() {
  return prisma.user.findMany({
    where: {
      status: {
        in: ["active", "pending_review"]
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 100,
    select: {
      id: true,
      displayName: true,
      lineUserId: true,
      role: true,
      status: true
    }
  });
}

function getRecentNotifications() {
  return prisma.notification.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 50,
    include: {
      user: true
    }
  });
}

function formatDate(date: Date | null): string | null {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function mapRecipient(user: Awaited<ReturnType<typeof getRecipients>>[number]): AdminNotificationRecipient {
  return {
    id: user.id,
    label: `${user.displayName ?? "LINE user"} / ${user.lineUserId}`,
    role: user.role,
    status: user.status
  };
}

function mapNotification(notification: NotificationWithUser): AdminNotificationItem {
  return {
    id: notification.id,
    userName: notification.user.displayName ?? "LINE user",
    userLineId: notification.user.lineUserId,
    type: notification.type,
    channel: notification.channel,
    title: notification.title,
    body: notification.body,
    readAt: formatDate(notification.readAt),
    createdAt: formatDate(notification.createdAt) ?? ""
  };
}

export async function getAdminNotifications(): Promise<AdminNotificationsData> {
  noStore();

  try {
    const [recipients, notifications] = await Promise.all([getRecipients(), getRecentNotifications()]);
    const notificationItems = notifications.map(mapNotification);

    return {
      recipients: recipients.map(mapRecipient),
      notifications: notificationItems,
      summary: {
        unread: notificationItems.filter((notification) => !notification.readAt).length,
        totalRecent: notificationItems.length,
        recipients: recipients.length
      }
    };
  } catch {
    return {
      recipients: [],
      notifications: [],
      summary: {
        unread: 0,
        totalRecent: 0,
        recipients: 0
      },
      unavailable: true
    };
  }
}
