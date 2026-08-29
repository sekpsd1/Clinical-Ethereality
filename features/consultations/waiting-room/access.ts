export type WaitingRoomLifecycleStatus = "scheduled" | "live";

export type WaitingRoomTiming = {
  canEnterLive: boolean;
  countdownTitle: string;
  countdownValue: string;
};

export type LiveConsultationParticipant = {
  userId: string;
  role: "customer" | "doctor";
};

export type LiveConsultationAccessRecord = {
  patientId: string;
  doctorUserId: string;
  status: string;
  scheduledAt: Date | null;
};

export function isLiveConsultationOpen(
  status: string,
  scheduledAt: Date | null,
  now = new Date()
): boolean {
  return status === "live" && Boolean(scheduledAt && scheduledAt.getTime() <= now.getTime());
}

export function canParticipantAccessLiveConsultation(
  participant: LiveConsultationParticipant,
  consultation: LiveConsultationAccessRecord,
  now = new Date()
): boolean {
  if (!isLiveConsultationOpen(consultation.status, consultation.scheduledAt, now)) {
    return false;
  }

  return participant.role === "doctor"
    ? consultation.doctorUserId === participant.userId
    : consultation.patientId === participant.userId;
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const days = Math.floor(totalSeconds / 86_400);

  if (days > 0) {
    return `${days} วัน`;
  }

  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (hours > 0) {
    return `${hours} ชม. ${minutes} นาที`;
  }

  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getWaitingRoomTiming(
  status: WaitingRoomLifecycleStatus,
  scheduledAt: Date | null,
  now = new Date()
): WaitingRoomTiming | null {
  if (!scheduledAt) {
    return null;
  }

  const remainingMilliseconds = scheduledAt.getTime() - now.getTime();
  const hasReachedAppointmentTime = remainingMilliseconds <= 0;
  const canEnterLive = isLiveConsultationOpen(status, scheduledAt, now);

  if (canEnterLive) {
    return {
      canEnterLive: true,
      countdownTitle: "แพทย์เปิดห้องแล้ว",
      countdownValue: "พร้อม"
    };
  }

  return {
    canEnterLive: false,
    countdownTitle: hasReachedAppointmentTime ? "รอแพทย์เปิดห้อง" : "เริ่มในอีก",
    countdownValue: hasReachedAppointmentTime ? "รอสักครู่" : formatCountdown(remainingMilliseconds)
  };
}
