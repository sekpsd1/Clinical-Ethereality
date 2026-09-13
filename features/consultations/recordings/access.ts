import type { Prisma } from "@prisma/client";
import type { PublicSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/audit-log";

export type AuthorizedRecording = {
  id: string;
  consultationId: string;
  provider: "zoom";
  providerRecordingId: string;
  fileType: string;
  recordingType: string;
  zoomMeetingId: string;
  fileSizeBytes: bigint | null;
};

export type RecordingViewer = Pick<PublicSession, "userId" | "role">;

type RecordingLookupClient = Pick<Prisma.TransactionClient, "consultationRecording" | "user">;

export async function findAuthorizedRecordingWithClient(
  client: RecordingLookupClient,
  session: RecordingViewer | null,
  consultationId: string,
  recordingId: string
): Promise<AuthorizedRecording | null> {
  if (!session || (session.role !== "admin" && session.role !== "doctor")) return null;

  const [activeUser, recording] = await Promise.all([
    client.user.findFirst({
      where: { id: session.userId, role: session.role, status: "active" },
      select: { id: true }
    }),
    client.consultationRecording.findFirst({
      where: {
        id: recordingId,
        consultationId,
        ...(session.role === "doctor" ? { consultation: { doctor: { userId: session.userId } } } : {})
      },
      select: {
        id: true,
        consultationId: true,
        provider: true,
        providerRecordingId: true,
        fileType: true,
        recordingType: true,
        fileSizeBytes: true,
        consultation: { select: { zoomMeetingId: true } }
      }
    })
  ]);

  if (!activeUser || !recording?.consultation.zoomMeetingId) return null;

  return {
    id: recording.id,
    consultationId: recording.consultationId,
    provider: recording.provider,
    providerRecordingId: recording.providerRecordingId,
    fileType: recording.fileType,
    recordingType: recording.recordingType,
    zoomMeetingId: recording.consultation.zoomMeetingId,
    fileSizeBytes: recording.fileSizeBytes
  };
}

export async function getAuthorizedRecording(
  session: RecordingViewer | null,
  consultationId: string,
  recordingId: string
): Promise<AuthorizedRecording | null> {
  return findAuthorizedRecordingWithClient(prisma, session, consultationId, recordingId);
}

export async function auditRecordingAccess(
  session: RecordingViewer,
  recording: AuthorizedRecording,
  mode: "view" | "download"
): Promise<void> {
  await prisma.$transaction((tx) => writeAuditLog(tx, {
    actorId: session.userId,
    action: mode === "download" ? "consultation_recording.download" : "consultation_recording.view",
    entityType: "consultation_recording",
    entityId: recording.id,
    metadata: {
      consultationId: recording.consultationId,
      provider: recording.provider,
      mode
    }
  }));
}
