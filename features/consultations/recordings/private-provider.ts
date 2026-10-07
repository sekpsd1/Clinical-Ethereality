import { prisma } from "@/lib/db/prisma";
import { getAppEnv } from "@/lib/env/schema";
import { getConsultationRecordingVariant } from "./policy";
import { assertPrivateArchiveFolder, driveFetch, getDriveAccessToken, getDriveArchiveConfig, getDriveFile, verifyDriveFile } from "./drive-client";
import { RecordingProviderError, zoomRecordingContentProvider, type RecordingContentProvider } from "./provider";

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
          if ((response.status !== 200 && response.status !== 206) || type !== variant.responseMimeType.split(";")[0] ||
            response.status === 206 && (!variant.supportsByteRanges || !contentRange || !/^bytes \d+-\d+\/\d+$/.test(contentRange))) {
            await response.body?.cancel().catch(() => undefined);
            throw new RecordingProviderError("CONTENT_UNAVAILABLE");
          }
          const length = response.headers.get("content-length");
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
