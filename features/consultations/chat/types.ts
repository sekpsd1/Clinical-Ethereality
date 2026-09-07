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
  viewerRole: "customer" | "doctor" | "pharmacist" | "admin" | null;
  doctorName: string;
  doctorImageUrl: string;
  patientImageUrl: string;
  statusLabel: string;
  attendanceLabel: string;
  attendanceDescription: string;
  attendanceTone: "neutral" | "success" | "warning";
  canSend: boolean;
  videoHref: string | null;
  videoMode: "external_handoff" | "unavailable";
  returnHref: string;
  messages: LiveConsultationChatMessage[];
};
