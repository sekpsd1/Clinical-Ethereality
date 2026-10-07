import type { Prisma } from "@prisma/client";
export type CleanupRow = {id: string; archiveDriveFileId: string | null; archiveSession: string | null;
  archiveLeaseUntil: Date | null; fileSizeBytes: bigint | null; fileType: string};
export function cleanupDriveRecordingRows(tx: Prisma.TransactionClient, recordingIds: string[], adapter: {
  prepare(): Promise<void>;
  cancel(row: CleanupRow, timeout: number): Promise<void>;
  get(id: string, timeout: number): Promise<unknown | null>;
  verify(file: unknown, row: CleanupRow): void;
  remove(id: string, timeout: number): Promise<void>;
}): Promise<void>;
