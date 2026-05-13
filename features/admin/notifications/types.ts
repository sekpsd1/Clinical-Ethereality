import type { NotificationChannel, NotificationType } from "@prisma/client";

export type AdminNotificationRecipient = {
  id: string;
  label: string;
  role: string;
  status: string;
};

export type AdminNotificationItem = {
  id: string;
  userName: string;
  userLineId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export type AdminNotificationsData = {
  recipients: AdminNotificationRecipient[];
  notifications: AdminNotificationItem[];
  summary: {
    unread: number;
    totalRecent: number;
    recipients: number;
  };
  unavailable?: boolean;
};
