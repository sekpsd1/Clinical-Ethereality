import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { consultationRecordingEligibilityWhere, getConsultationRecordingVariant } from "./policy";
import { RecordingProviderError, zoomRecordingContentProvider, type RecordingProviderFailureReason, type RecordingProviderMimeClass } from "./provider";
import { assertPrivateArchiveFolder, decryptUploadSession, DriveArchiveError, driveFetch,
  encryptUploadSession, getDriveAccessToken, getDriveArchiveConfig, getDriveFile,
  validateUploadSession, verifyDriveFile } from "./drive-client";

export const ARCHIVE_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_ATTEMPTS = 12;
const LEASE_MS = 5 * 60_000;
type ArchiveStage = "drive_prepare" | "completion_verify" | "session_create" | "session_probe" | "zoom_download" | "chunk_read" | "drive_upload";
type ArchiveDiagnosticCode = "NOT_CONFIGURED" | "PROVIDER_UNAVAILABLE" | "INVALID_METADATA" | "METADATA_UNAVAILABLE" | "CONTENT_UNAVAILABLE" | "RANGE_NOT_SATISFIABLE";
const DIAGNOSTIC_CODES = new Set<string>(["NOT_CONFIGURED", "PROVIDER_UNAVAILABLE", "INVALID_METADATA", "METADATA_UNAVAILABLE", "CONTENT_UNAVAILABLE", "RANGE_NOT_SATISFIABLE"]);
const DIAGNOSTIC_REASONS = new Set<string>(["metadata_response", "metadata_missing", "download_host", "redirect_host", "content_status", "content_range", "content_mime"]);
const DIAGNOSTIC_MIME_CLASSES = new Set<string>(["missing", "octet_stream", "html", "video_mp4", "text_plain", "other"]);
type ArchiveStepResult = { status: "idle" | "progress" | "archived" | "retry" | "failed"; stage?: ArchiveStage; code?: ArchiveDiagnosticCode; reason?: RecordingProviderFailureReason; httpStatus?: number; mimeClass?: RecordingProviderMimeClass };

export function parseUploadOffset(range: string | null, size: bigint): bigint {
  if (!range) return BigInt(0);
  const match = /^bytes=0-(\d+)$/.exec(range);
  if (!match) throw new DriveArchiveError("INVALID_METADATA");
  const offset = BigInt(match[1]) + BigInt(1);
  if (offset > size) throw new DriveArchiveError("INVALID_METADATA");
  return offset;
}

// The payload buffer is bounded to one Drive chunk, never to the recording size.
export async function readBoundedChunk(body: ReadableStream<Uint8Array> | null, expected: number, timeoutMs = 25_000): Promise<Uint8Array> {
  if (!body || expected <= 0 || expected > ARCHIVE_CHUNK_BYTES) throw new DriveArchiveError("INVALID_METADATA");
  const reader = body.getReader();
  const result = new Uint8Array(expected);
  let offset = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DriveArchiveError("PROVIDER_UNAVAILABLE")), timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      if (offset + value.length > expected) throw new DriveArchiveError("INVALID_METADATA");
      result.set(value, offset); offset += value.length;
    }
    if (offset !== expected) throw new DriveArchiveError("INVALID_METADATA");
    return result;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
  }
}

/** One resumable step per scheduled invocation. No in-process/background promise is relied upon. */
export async function archiveOneRecordingStep(): Promise<ArchiveStepResult> {
  const config = getDriveArchiveConfig();
  const now = new Date();
  const candidate = await prisma.consultationRecording.findFirst({
    where: { ...consultationRecordingEligibilityWhere, archiveStatus: { in: ["pending", "uploading", "retry"] },
      retentionUntil: { gt: now }, archiveAttempts: { lt: MAX_ATTEMPTS },
      AND: [{ OR: [{ archiveRetryAt: null }, { archiveRetryAt: { lte: now } }] },
        { OR: [{ archiveLeaseUntil: null }, { archiveLeaseUntil: { lte: now } }] }],
      consultation: { zoomMeetingId: { not: null } } },
    orderBy: [{ archiveRetryAt: "asc" }, { createdAt: "asc" }],
    include: { consultation: { select: { zoomMeetingId: true } } }
  });
  if (!candidate) return { status: "idle" };
  const leaseToken = randomUUID();
  const claimed = await prisma.consultationRecording.updateMany({ where: { id: candidate.id,
    ...consultationRecordingEligibilityWhere, archiveStatus: { in: ["pending", "uploading", "retry"] },
    archiveAttempts: { lt: MAX_ATTEMPTS }, retentionUntil: { gt: now },
    AND: [{ OR: [{ archiveRetryAt: null }, { archiveRetryAt: { lte: now } }] }],
    OR: [{ archiveLeaseUntil: null }, { archiveLeaseUntil: { lte: now } }] },
    data: { archiveLeaseToken: leaseToken, archiveLeaseUntil: new Date(now.getTime() + LEASE_MS), archiveStatus: "uploading" } });
  if (claimed.count !== 1) return { status: "idle" };
  const owned = { id: candidate.id, archiveLeaseToken: leaseToken };
  const assertOwned = async () => {
    const result = await prisma.consultationRecording.updateMany({ where: { ...owned, archiveStatus: "uploading" },
      data: { archiveLeaseUntil: new Date(Date.now() + LEASE_MS) } });
    if (result.count !== 1) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
  };
  let fileId = candidate.archiveDriveFileId;
  let session = candidate.archiveSession;
  const release = async (data: Parameters<typeof prisma.consultationRecording.updateMany>[0]["data"]) => {
    const result = await prisma.consultationRecording.updateMany({ where: owned,
      data: { ...data, archiveLeaseToken: null, archiveLeaseUntil: null } });
    if (result.count !== 1) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
  };
  let stage: ArchiveStage = "drive_prepare";
  try {
    const variant = getConsultationRecordingVariant(candidate);
    const size = candidate.fileSizeBytes;
    if (!variant || !size || size <= BigInt(0) || (!variant.supportsByteRanges && size > BigInt(ARCHIVE_CHUNK_BYTES))) {
      throw new DriveArchiveError("INVALID_METADATA");
    }
    const mimeType = variant.responseMimeType.split(";")[0];
    const token = await getDriveAccessToken();
    await assertPrivateArchiveFolder(token);
    if (!fileId) {
      const generated = await driveFetch(token, "files/generateIds?count=1&space=drive&type=files");
      if (!generated.ok) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
      const ids = await generated.json();
      if (!Array.isArray(ids.ids) || !/^[A-Za-z0-9_-]+$/.test(ids.ids[0])) throw new DriveArchiveError("INVALID_METADATA");
      fileId = ids.ids[0] as string;
      const saved = await prisma.consultationRecording.updateMany({ where: owned, data: { archiveDriveFileId: fileId } });
      if (saved.count !== 1) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
    }
    const expected = { id: fileId, size, mimeType, recordingId: candidate.id, folderId: config.folderId };
    // A stable preallocated ID lets a restart reconcile a response lost after final commit.
    stage = "completion_verify";
    const completed = await getDriveFile(token, fileId);
    if (completed) {
      verifyDriveFile(completed, expected);
      await prisma.$transaction(async (tx) => {
        const saved = await tx.consultationRecording.updateMany({ where: owned, data: {
          archiveStatus: "archived", archivedAt: new Date(), archiveOffset: size, archiveSession: null,
          archiveLeaseToken: null, archiveLeaseUntil: null, archiveRetryAt: null, archiveAttempts: 0 } });
        if (saved.count !== 1) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
        await writeAuditLog(tx, { action: "consultation_recording.archived", entityType: "consultation_recording",
          entityId: candidate.id, metadata: { storage: "google_drive", verified: true } });
      });
      return { status: "archived" };
    }
    if (!session) {
      stage = "session_create";
      await assertOwned();
      const created = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json",
          "X-Upload-Content-Type": mimeType, "X-Upload-Content-Length": String(size) },
        body: JSON.stringify({ id: fileId, name: `consultation-recording-${candidate.id}.${candidate.fileType.toLowerCase()}`,
          mimeType, parents: [config.folderId], appProperties: { clinicalRecording: candidate.id } }),
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000)
      });
      if (!created.ok || !created.headers.get("location")) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
      session = encryptUploadSession(validateUploadSession(created.headers.get("location")!), candidate.id, config.sessionKey);
      const saved = await prisma.consultationRecording.updateMany({ where: owned, data: { archiveSession: session } });
      if (saved.count !== 1) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
    }
    const sessionUrl = decryptUploadSession(session, candidate.id, config.sessionKey);
    const uploadRequest = (headers: Record<string, string>, body?: Uint8Array) => fetch(sessionUrl, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, ...headers },
      body: body as BodyInit | undefined, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(25_000)
    });
    stage = "session_probe";
    const probe = await uploadRequest({ "Content-Range": `bytes */${size}`, "Content-Length": "0" });
    if (probe.status === 404 || probe.status === 410) {
      const failed = candidate.archiveAttempts + 1 >= MAX_ATTEMPTS;
      await release({ archiveSession: null, archiveStatus: failed ? "failed" : "retry", archiveRetryAt: failed ? null : new Date(now.getTime() + 60_000),
        archiveAttempts: { increment: 1 } });
      return { status: failed ? "failed" : "retry", stage, code: "PROVIDER_UNAVAILABLE" };
    }
    if (probe.ok) {
      // Do not trust a final upload response; verify metadata with files.get on the next step.
      await release({ archiveStatus: "uploading", archiveRetryAt: null });
      return { status: "progress" };
    }
    if (probe.status !== 308) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
    const offset = parseUploadOffset(probe.headers.get("range"), size);
    if (offset === size) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
    const end = offset + BigInt(ARCHIVE_CHUNK_BYTES) < size ? offset + BigInt(ARCHIVE_CHUNK_BYTES) - BigInt(1) : size - BigInt(1);
    const recording = { ...candidate, zoomMeetingId: candidate.consultation.zoomMeetingId! };
    stage = "zoom_download";
    const content = await zoomRecordingContentProvider.open(recording,
      variant.supportsByteRanges ? { range: `bytes=${offset}-${end}` } : undefined);
    if (variant.supportsByteRanges && (content.status !== 206 || content.contentRange !== `bytes ${offset}-${end}/${size}`)) {
      await content.body?.cancel().catch(() => undefined);
      throw new DriveArchiveError("INVALID_METADATA");
    }
    stage = "chunk_read";
    const chunk = await readBoundedChunk(content.body, Number(end - offset + BigInt(1)));
    await assertOwned();
    stage = "drive_upload";
    const uploaded = await uploadRequest({ "Content-Type": mimeType, "Content-Length": String(chunk.byteLength),
      "Content-Range": `bytes ${offset}-${end}/${size}` }, chunk);
    if (!uploaded.ok && uploaded.status !== 308) throw new DriveArchiveError("PROVIDER_UNAVAILABLE");
    const received = uploaded.ok ? size : parseUploadOffset(uploaded.headers.get("range"), size);
    if (received <= offset || received > end + BigInt(1)) throw new DriveArchiveError("INVALID_METADATA");
    await release({ archiveOffset: received, archiveStatus: "uploading", archiveRetryAt: null, archiveAttempts: 0 });
    return { status: "progress" };
  } catch (error) {
    const attempts = candidate.archiveAttempts + 1;
    const failed = attempts >= MAX_ATTEMPTS || error instanceof DriveArchiveError && error.code === "INVALID_METADATA";
    await release({ archiveStatus: failed ? "failed" : "retry", archiveAttempts: { increment: 1 },
      archiveRetryAt: failed ? null : new Date(Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** attempts)) });
    // Only fixed provider codes are returned; never serialize arbitrary error text/cause.
    const knownProvider = error instanceof DriveArchiveError || error instanceof RecordingProviderError;
    const code: ArchiveDiagnosticCode = knownProvider && DIAGNOSTIC_CODES.has(error.code)
      ? error.code : "PROVIDER_UNAVAILABLE";
    const diagnostic = error instanceof RecordingProviderError ? error.diagnostic : undefined;
    const reason = diagnostic && DIAGNOSTIC_REASONS.has(diagnostic.reason) ? diagnostic.reason : undefined;
    const httpStatus = reason && Number.isInteger(diagnostic?.httpStatus) && diagnostic!.httpStatus! >= 100 && diagnostic!.httpStatus! <= 599
      ? diagnostic!.httpStatus : undefined;
    const mimeClass = reason === "content_mime" && diagnostic?.mimeClass && DIAGNOSTIC_MIME_CLASSES.has(diagnostic.mimeClass)
      ? diagnostic.mimeClass : undefined;
    return { status: failed ? "failed" : "retry", stage, code, ...(reason ? { reason } : {}), ...(httpStatus ? { httpStatus } : {}),
      ...(mimeClass ? { mimeClass } : {}) };
  }
}
