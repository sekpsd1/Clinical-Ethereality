import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { getRecordingRetentionUntil } from "@/features/consultations/consent/policy";
import type { ZoomRecordingCompletedEvent } from "@/features/consultations/recordings/webhook-schema";

export class RecordingWebhookError extends Error {
  constructor(public readonly code: "CONSULTATION_NOT_FOUND") {
    super(code);
    this.name = "RecordingWebhookError";
  }
}

export async function applyZoomRecordingCompletedEvent(
  tx: Prisma.TransactionClient,
  input: ZoomRecordingCompletedEvent
): Promise<{ consultationId: string; duplicate: boolean; recordingCount: number }> {
  const consultation = await tx.consultation.findFirst({
    where: { zoomMeetingId: input.meetingId },
    select: { id: true }
  });

  if (!consultation) {
    throw new RecordingWebhookError("CONSULTATION_NOT_FOUND");
  }

  const claimed = await tx.consultationRecordingWebhookEvent.createMany({
    data: [{
      consultationId: consultation.id,
      provider: "zoom",
      providerEventKey: input.eventKey,
      occurredAt: input.occurredAt
    }],
    skipDuplicates: true
  });

  if (claimed.count === 0) {
    return { consultationId: consultation.id, duplicate: true, recordingCount: 0 };
  }

  const recordings = await tx.consultationRecording.createMany({
    data: input.files.map((file) => ({
      consultationId: consultation.id,
      provider: "zoom" as const,
      providerRecordingId: file.providerRecordingId,
      recordingType: file.recordingType,
      fileType: file.fileType,
      fileSizeBytes: file.fileSizeBytes,
      startedAt: file.startedAt,
      endedAt: file.endedAt,
      retentionUntil: getRecordingRetentionUntil(file.endedAt ?? input.occurredAt)
    })),
    skipDuplicates: true
  });

  await writeAuditLog(tx, {
    action: "consultation_recording.metadata_received",
    entityType: "consultation",
    entityId: consultation.id,
    metadata: {
      provider: "zoom",
      providerEventKey: input.eventKey,
      recordingCount: recordings.count,
      retentionYears: 5
    }
  });

  return {
    consultationId: consultation.id,
    duplicate: false,
    recordingCount: recordings.count
  };
}
