import type { Notification, Prisma } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import type { CustomerNotificationItem, CustomerNotificationsData } from "@/features/notifications/types";

type CustomerNotificationRecord = Pick<
  Notification,
  "id" | "type" | "title" | "body" | "readAt" | "metadataJson" | "createdAt"
>;
type CustomerNotificationRouteInput = Pick<CustomerNotificationRecord, "type" | "metadataJson">;

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

export function resolveCustomerNotificationHref(
  notification: CustomerNotificationRouteInput
): CustomerNotificationItem["href"] {
  const metadata = getMetadataObject(notification.metadataJson);
  const href = metadata.href;

  if (href === "/store/payment-success") {
    return "/store/orders";
  }

  if (
    href === "/community" ||
    (typeof href === "string" && href.startsWith("/community/") && !href.startsWith("//")) ||
    href === "/store/orders" ||
    href === "/store" ||
    href === "/profile/rewards" ||
    href === "/consult/prescriptions" ||
    href === "/consult/advice-log" ||
    (typeof href === "string" && href.startsWith("/consult/appointments/"))
  ) {
    return href;
  }

  if (notification.type === "community") {
    return "/community";
  }

  if (notification.type === "order" || notification.type === "payment") {
    return "/store/orders";
  }

  if (notification.type === "prescription") {
    return "/consult/prescriptions";
  }

  if (notification.type === "consultation") {
    return "/consult/advice-log";
  }

  if (notification.type === "reward") {
    return "/profile/rewards";
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
    href: resolveCustomerNotificationHref(notification)
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
