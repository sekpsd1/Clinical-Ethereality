import type { Role } from "@/lib/permissions/roles";

export type ConsultationChatHistoryMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderName: string;
  senderRole: Role;
  isOwnMessage: boolean;
};

export type ConsultationChatHistoryData = {
  consultationId: string;
  viewerRole: "customer" | "doctor";
  counterpartName: string;
  messages: ConsultationChatHistoryMessage[];
  page: number;
  pageSize: number;
  totalMessages: number;
  totalPages: number;
};
