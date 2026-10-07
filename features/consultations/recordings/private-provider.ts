import { prisma } from "@/lib/db/prisma";
import { getAppEnv } from "@/lib/env/schema";
import { getConsultationRecordingVariant } from "./policy";
import { assertPrivateArchiveFolder, driveFetch, getDriveAccessToken, getDriveArchiveConfig, getDriveFile, verifyDriveFile } from "./drive-client";
import { RecordingProviderError, zoomRecordingContentProvider, type RecordingContentProvider } from "./provider";

export function expectedDriveRange(range: string, size: bigint): {value: string; length: bigint} {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) throw new RecordingProviderError("RANGE_NOT_SATISFIABLE");
  const one = BigInt(1);
  const start = match[1] ? BigInt(match[1]) : size > BigInt(match[2]) ? size - BigInt(match[2]) : BigInt(0);
  const requestedEnd = match[1] && match[2] ? BigInt(match[2]) : size - one;
  const end = requestedEnd < size ? requestedEnd : size - one;
  if (start > end || start < BigInt(0)) throw new RecordingProviderError("RANGE_NOT_SATISFIABLE");
  return { value: `bytes ${start}-${end}/${size}`, length: end - start + one };
}

export const privateRecordingContentProvider: RecordingContentProvider = {
  async open(recording, options) {
    if (getAppEnv().ENABLE_GOOGLE_DRIVE_RECORDING_ARCHIVE) {
      try {
        const variant = getConsultationRecordingVariant(recording);
        if (!variant || options?.range && !variant.supportsByteRanges) throw new RecordingProviderError("CONTENT_UNAVAILABLE");
        const archived = await prisma.consultationRecording.findFirst({ where: {
          id: recording.id, consultationId: recording.consultationId, archiveStatus: "archived", archivedAt: { not: null }
        }, select: { archiveDriveFileId: true, fileSizeBytes: true } });
        if (archived?.archiveDriveFileId && archived.fileSizeBytes) {
          const config = getDriveArchiveConfig();
          const token = await getDriveAccessToken();
          await assertPrivateArchiveFolder(token);
          const metadata = await getDriveFile(token, archived.archiveDriveFileId);
          if (!metadata) throw new RecordingProviderError("CONTENT_UNAVAILABLE");
          verifyDriveFile(metadata, { id: archived.archiveDriveFileId, size: archived.fileSizeBytes,
            mimeType: variant.responseMimeType.split(";")[0], recordingId: recording.id, folderId: config.folderId });
          const response = await driveFetch(token, `files/${encodeURIComponent(archived.archiveDriveFileId)}?alt=media`, {
            headers: options?.range ? { Range: options.range } : {}
          });
          if (response.status === 416) throw new RecordingProviderError("RANGE_NOT_SATISFIABLE");
          const contentRange = response.headers.get("content-range");
          const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
          const expected = options?.range ? expectedDriveRange(options.range, archived.fileSizeBytes) : null;
          const length = response.headers.get("content-length");
          if (response.status !== (expected ? 206 : 200) || type !== variant.responseMimeType.split(";")[0] ||
            (expected ? contentRange !== expected.value : Boolean(contentRange)) ||
            !length || !/^\d{1,20}$/.test(length) || BigInt(length) !== (expected?.length ?? archived.fileSizeBytes)) {
            await response.body?.cancel().catch(() => undefined);
            throw new RecordingProviderError("CONTENT_UNAVAILABLE");
          }
          return { body: response.body, contentType: variant.responseMimeType,
            contentLength: length && /^\d{1,20}$/.test(length) ? length : null,
            contentRange: response.status === 206 ? contentRange : null,
            acceptRanges: variant.supportsByteRanges ? "bytes" : null, status: response.status as 200 | 206 };
        }
      } catch (error) {
        if (error instanceof RecordingProviderError && error.code === "RANGE_NOT_SATISFIABLE") throw error;
        // Zoom is retained as the fallback until and after archive verification.
      }
    }
    return zoomRecordingContentProvider.open(recording, options);
  }
};
