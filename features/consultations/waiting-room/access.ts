export type WaitingRoomLifecycleStatus = "scheduled" | "live";

export type WaitingRoomTiming = {
  canEnterLive: boolean;
  countdownTitle: string;
  countdownValue: string;
};

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
  if (status === "live") {
    return {
      canEnterLive: true,
      countdownTitle: "แพทย์เปิดห้องแล้ว",
      countdownValue: "พร้อม"
    };
  }

  if (!scheduledAt) {
    return null;
  }

  const remainingMilliseconds = scheduledAt.getTime() - now.getTime();
  const canEnterLive = remainingMilliseconds <= 0;

  return {
    canEnterLive,
    countdownTitle: canEnterLive ? "ถึงเวลานัดแล้ว" : "เริ่มในอีก",
    countdownValue: canEnterLive ? "พร้อม" : formatCountdown(remainingMilliseconds)
  };
}
