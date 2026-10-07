import type { Prisma } from "@prisma/client";
import { cleanupDriveRecordingRows } from "@/scripts/drive-recording-cleanup.cjs";
import { decryptUploadSession, getDriveAccessToken, getDriveArchiveConfig, verifyDriveFile, type DriveFileMetadata } from "./drive-client";

export async function deleteDriveArchivesForRecordings(tx: Prisma.TransactionClient, recordingIds: string[]) {
  let token = "";
  let config: ReturnType<typeof getDriveArchiveConfig>;
  const request = (url: string, timeout: number, init: RequestInit = {}) => fetch(url, {
    ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` },
    cache: "no-store", redirect: init.redirect ?? "error", signal: AbortSignal.timeout(timeout)
  });
  await cleanupDriveRecordingRows(tx, recordingIds, {
    async prepare() { config = getDriveArchiveConfig(true); token = await getDriveAccessToken(true); },
    async cancel(row, timeout) {
      const url = decryptUploadSession(row.archiveSession!, row.id, config.sessionKey);
      const perRequest = Math.max(1, Math.floor(timeout / 2));
      const cancelled = await request(url, perRequest, { method: "DELETE", redirect: "manual" });
      if (![200, 204, 404, 410, 499].includes(cancelled.status)) throw new Error("ARCHIVE_CANCEL_FAILED");
      // Cancellation must really prevent any later resumable PUT. Never infer from DELETE alone.
      const terminal = await request(url, perRequest, { method: "PUT", redirect: "manual", headers: {
        "Content-Range": `bytes */${row.fileSizeBytes}`, "Content-Length": "0"
      } });
      // A completed upload is reconciled by exact files.get below; it is never resumable again.
      if (![200, 201, 404, 410, 499].includes(terminal.status)) throw new Error("ARCHIVE_CANCEL_NOT_VERIFIED");
    },
    async get(id, timeout) {
      const response = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,size,mimeType,trashed,parents,appProperties,driveId,permissions(type,role)`, timeout);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("ARCHIVE_LOOKUP_FAILED");
      return response.json();
    },
    verify(file, row) {
      verifyDriveFile(file as DriveFileMetadata, { id: row.archiveDriveFileId!, recordingId: row.id,
        size: row.fileSizeBytes!, mimeType: row.fileType.toLowerCase() === "mp4" ? "video/mp4" : "text/plain",
        folderId: config.folderId }, false);
    },
    async remove(id, timeout) {
      const response = await request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, timeout, { method: "DELETE" });
      if (response.status !== 204 && response.status !== 404) throw new Error("ARCHIVE_DELETE_FAILED");
    }
  });
}
