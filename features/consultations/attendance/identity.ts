import { createHash, randomBytes } from "node:crypto";
import type { ConsultationAttendanceRole } from "@prisma/client";

const CUSTOMER_KEY_BYTES = 16;
export const ZOOM_ATTENDANCE_CREDENTIAL_LIFETIME_MS = 2 * 60 * 60 * 1000;

export function hashZoomAttendanceValue(domain: string, value: string): string {
  return createHash("sha256").update(`${domain}\0${value}`, "utf8").digest("hex");
}

export function createZoomAttendanceCredential(
  role: ConsultationAttendanceRole,
  now = new Date()
) {
  const customerKey = `${role === "doctor" ? "d" : "c"}${randomBytes(CUSTOMER_KEY_BYTES).toString("hex")}`;

  return {
    customerKey,
    customerKeyHash: hashZoomAttendanceValue("customer-key", customerKey),
    expiresAt: new Date(now.getTime() + ZOOM_ATTENDANCE_CREDENTIAL_LIFETIME_MS)
  };
}

export function getZoomAttendanceEventHashes(input: {
  eventType: "joined" | "left";
  meetingId: string;
  meetingUuid: string;
  participantUserId: string;
  customerKey: string;
  occurredAt: Date;
}) {
  const meetingUuidHash = hashZoomAttendanceValue("meeting-uuid", input.meetingUuid);
  const participantSessionHash = hashZoomAttendanceValue(
    "participant-session",
    `${input.meetingUuid}\0${input.participantUserId}\0${input.customerKey}`
  );
  const providerEventKey = hashZoomAttendanceValue(
    "provider-event",
    [
      input.eventType,
      input.meetingId,
      input.meetingUuid,
      input.participantUserId,
      input.customerKey,
      input.occurredAt.toISOString()
    ].join("\0")
  );

  return {
    meetingUuidHash,
    participantSessionHash,
    providerEventKey
  };
}
