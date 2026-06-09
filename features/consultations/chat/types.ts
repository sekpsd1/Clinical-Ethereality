export type LiveConsultationChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderName: string;
  senderRole: "customer" | "doctor" | "pharmacist" | "admin";
  isOwnMessage: boolean;
};

export type LiveConsultationChatData = {
  consultationId: string | null;
  doctorName: string;
  doctorImageUrl: string;
  patientImageUrl: string;
  statusLabel: string;
  canSend: boolean;
  messages: LiveConsultationChatMessage[];
};
