import type { Prisma } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { requireDoctorSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import type { DoctorNotificationItem, DoctorNotificationsData } from "@/features/doctor/notifications/types";

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
  return formatter.format(-deltaDays, "day");
}

function getHref(metadataJson: Prisma.JsonValue): string {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return "/doctor/notifications";
  }

  const href = metadataJson.href;

  if (
    typeof href === "string" &&
    (href === "/doctor/consultations" ||
      href === "/doctor/patients" ||
      href.startsWith("/doctor/patients/") ||
      href.startsWith("/consult/live?consultation="))
  ) {
    return href;
  }

  return "/doctor/notifications";
}

export async function getDoctorNotifications(): Promise<DoctorNotificationsData> {
  noStore();

  try {
    const session = await requireDoctorSession();
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
        title: true,
        body: true,
        type: true,
        metadataJson: true,
        readAt: true,
        createdAt: true
      }
    });
    const items: DoctorNotificationItem[] = notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body ?? "",
      time: formatRelativeTime(notification.createdAt),
      kind: notification.type === "system" ? "promo" : notification.type,
      unread: !notification.readAt,
      href: getHref(notification.metadataJson)
    }));

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
