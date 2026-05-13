import type { NotificationType } from "@prisma/client";

export type CustomerNotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  kind: NotificationType | "promo";
  unread: boolean;
  href: string;
};

export type CustomerNotificationsData = {
  notifications: CustomerNotificationItem[];
  unreadCount: number;
  unavailable?: boolean;
};
