import type { Notification, Prisma } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import type { CustomerNotificationItem, CustomerNotificationsData } from "@/features/notifications/types";

type CustomerNotificationRecord = Pick<
  Notification,
  "id" | "type" | "title" | "body" | "readAt" | "metadataJson" | "createdAt"
>;

function formatRelativeTime(date: Date): string {
  const deltaSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  const formatter = new Intl.RelativeTimeFormat("th-TH", {
    numeric: "auto"
  });

  if (deltaSeconds < 60) {
    return formatter.format(-deltaSeconds, "second");
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return formatter.format(-deltaMinutes, "minute");
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return formatter.format(-deltaHours, "hour");
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 30) {
    return formatter.format(-deltaDays, "day");
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getMetadataObject(metadata: Prisma.JsonValue): Prisma.JsonObject {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata;
}

function mapHref(notification: CustomerNotificationRecord): CustomerNotificationItem["href"] {
  const metadata = getMetadataObject(notification.metadataJson);
  const href = metadata.href;

  if (
    href === "/community/vitamin-c-tips" ||
    href === "/store/payment-success" ||
    href === "/store" ||
    href === "/consult/advice-log"
  ) {
    return href;
  }

  if (notification.type === "community") {
    return "/community/vitamin-c-tips";
  }

  if (notification.type === "order" || notification.type === "payment" || notification.type === "prescription") {
    return "/store/payment-success";
  }

  if (notification.type === "consultation") {
    return "/consult/advice-log";
  }

  if (notification.type === "reward") {
    return "/store";
  }

  return "/notifications";
}

function mapNotification(notification: CustomerNotificationRecord): CustomerNotificationItem {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body ?? "",
    time: formatRelativeTime(notification.createdAt),
    kind: notification.type === "system" ? "promo" : notification.type,
    unread: !notification.readAt,
    href: mapHref(notification)
  };
}

export async function getCustomerNotifications(session: PublicSession): Promise<CustomerNotificationsData> {
  noStore();

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.userId,
        channel: "in_app"
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        readAt: true,
        metadataJson: true,
        createdAt: true
      }
    });
    const items = notifications.map(mapNotification);

    return {
      notifications: items,
      unreadCount: items.filter((notification) => notification.unread).length
    };
  } catch {
    return {
      notifications: [],
      unreadCount: 0,
      unavailable: true
    };
  }
}
