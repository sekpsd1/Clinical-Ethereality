import type { NotificationType } from "@prisma/client";

export type DoctorNotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  kind: NotificationType | "promo";
  unread: boolean;
  href: string;
};

export type DoctorNotificationsData = {
  notifications: DoctorNotificationItem[];
  unreadCount: number;
  unavailable?: boolean;
};
