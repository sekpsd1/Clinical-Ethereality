export type ConsultationWaitingRoomData = {
  consultationId: string;
  viewerRole: "customer" | "doctor";
  consultationStatus: "scheduled" | "live";
  doctorName: string;
  doctorImageUrl: string;
  scheduledLabel: string;
  statusMessage: string;
  countdownTitle: string;
  countdownValue: string;
  canEnterLive: boolean;
  liveHref: string | null;
  returnHref: string;
};
