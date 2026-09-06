import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  getZoomAttendanceEventHashes,
  hashZoomAttendanceValue
} from "@/features/consultations/attendance/identity";
import type { ZoomParticipantAttendanceEvent } from "@/features/consultations/attendance/webhook-schema";

const CREDENTIAL_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

export class ZoomAttendanceWebhookError extends Error {
  constructor(readonly code: "unmatched_participant" | "credential_time_mismatch") {
    super("Zoom participant event could not be matched to an authorized consultation participant.");
    this.name = "ZoomAttendanceWebhookError";
  }
}

export async function applyZoomParticipantAttendanceEvent(
  tx: Prisma.TransactionClient,
  event: ZoomParticipantAttendanceEvent
) {
  const customerKeyHash = hashZoomAttendanceValue("customer-key", event.customerKey);
  const credential = await tx.consultationAttendanceCredential.findUnique({
    where: {
      customerKeyHash
    },
    select: {
      role: true,
      createdAt: true,
      expiresAt: true,
      consultation: {
        select: {
          id: true,
          zoomMeetingId: true
        }
      }
    }
  });

  if (!credential || credential.consultation.zoomMeetingId !== event.meetingId) {
    throw new ZoomAttendanceWebhookError("unmatched_participant");
  }

  await tx.$queryRaw(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${credential.consultation.id} FOR UPDATE`
  );

  if (
    event.occurredAt.getTime() < credential.createdAt.getTime() - CREDENTIAL_CLOCK_TOLERANCE_MS ||
    event.occurredAt.getTime() > credential.expiresAt.getTime()
  ) {
    throw new ZoomAttendanceWebhookError("credential_time_mismatch");
  }

  const hashes = getZoomAttendanceEventHashes(event);
  const inserted = await tx.consultationAttendanceEvent.createMany({
    data: [
      {
        consultationId: credential.consultation.id,
        providerEventKey: hashes.providerEventKey,
        meetingUuidHash: hashes.meetingUuidHash,
        participantSessionHash: hashes.participantSessionHash,
        role: credential.role,
        eventType: event.eventType,
        occurredAt: event.occurredAt
      }
    ],
    skipDuplicates: true
  });

  if (inserted.count === 0) {
    return {
      duplicate: true,
      consultationId: credential.consultation.id
    };
  }

  await writeAuditLog(tx, {
    action: event.eventType === "joined" ? "zoom.attendance_joined" : "zoom.attendance_left",
    entityType: "consultation",
    entityId: credential.consultation.id,
    metadata: {
      role: credential.role,
      occurredAt: event.occurredAt.toISOString(),
      providerEventKey: hashes.providerEventKey
    }
  });

  return {
    duplicate: false,
    consultationId: credential.consultation.id
  };
}
