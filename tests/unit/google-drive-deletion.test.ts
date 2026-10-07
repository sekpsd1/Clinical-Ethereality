import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { cleanupDriveRecordingRows, type CleanupRow } from "@/scripts/drive-recording-cleanup.cjs";
import { assertNoDriveArchivesForLegacyPurge } from "../../scripts/drive-archive-legacy-preflight.cjs";
const mocks = vi.hoisted(() => ({ token: vi.fn(), config: vi.fn(), decrypt: vi.fn() }));
vi.mock("@/features/consultations/recordings/drive-client", async (original) => ({
  ...await original<typeof import("@/features/consultations/recordings/drive-client")>(),
  getDriveAccessToken: mocks.token, getDriveArchiveConfig: mocks.config, decryptUploadSession: mocks.decrypt
}));
import { deleteDriveArchivesForRecordings } from "@/features/consultations/recordings/drive-deletion";
const row = { id: "record-test", archiveDriveFileId: "file-test", archiveSession: null, archiveLeaseUntil: null,
  fileSizeBytes: BigInt(4), fileType: "mp4" };
function transaction(rows: CleanupRow[] = [row]) {
  return { $queryRaw: vi.fn().mockResolvedValue([]), consultationRecording: { findMany: vi.fn().mockResolvedValue(rows), updateMany: vi.fn().mockResolvedValue({ count: rows.length }) } };
}
const adapter = () => ({ prepare: vi.fn().mockResolvedValue(undefined), cancel: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null), verify: vi.fn(), remove: vi.fn().mockResolvedValue(undefined) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.token.mockResolvedValue("test-token");
  mocks.config.mockReturnValue({ folderId: "private-folder", sessionKey: "ab".repeat(32) });
  mocks.decrypt.mockReturnValue("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test");
  vi.stubGlobal("fetch", vi.fn());
});
it("treats provider404 as idempotent cleanup without deleting another file", async () => {
  const tx = transaction(); const provider = adapter();
  await cleanupDriveRecordingRows(tx as unknown as Prisma.TransactionClient, [row.id], provider);
  expect(provider.remove).not.toHaveBeenCalled();
  expect(tx.consultationRecording.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { archiveStatus: "deleting", archiveLeaseToken: null } }));
});
it("refuses active job leases before reservation ID or external action", async () => {
  const tx = transaction([{ ...row, archiveDriveFileId: null, archiveLeaseUntil: new Date(Date.now() + 50000) }]);
  const provider = adapter();
  await expect(cleanupDriveRecordingRows(tx as unknown as Prisma.TransactionClient, [row.id], provider)).rejects.toThrow("ARCHIVE_BUSY");
  expect(provider.prepare).not.toHaveBeenCalled(); expect(tx.consultationRecording.updateMany).not.toHaveBeenCalled();
});
it("retains mapping/session on failure for transaction rollback and exact retry", async () => {
  const tx = transaction([{ ...row, archiveSession: "encrypted-session" }]);
  const provider = adapter(); provider.cancel.mockRejectedValue(new Error("cancel not verified"));
  await expect(cleanupDriveRecordingRows(tx as unknown as Prisma.TransactionClient, [row.id], provider)).rejects.toThrow();
  expect(tx.consultationRecording.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ archiveDriveFileId: null }) }));
  expect(provider.remove).not.toHaveBeenCalled();
});
it("verifies binding before exact removal, then verifies absence", async () => {
  const tx = transaction(); const provider = adapter();
  provider.get.mockResolvedValueOnce({ id: row.archiveDriveFileId }).mockResolvedValueOnce(null);
  await cleanupDriveRecordingRows(tx as unknown as Prisma.TransactionClient, [row.id], provider);
  expect(provider.verify).toHaveBeenCalledWith({ id: "file-test" }, row);
  expect(provider.remove).toHaveBeenCalledWith("file-test", expect.any(Number));
});
it("cleans existing archives while automatic archive flag is disabled", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
  await deleteDriveArchivesForRecordings(transaction() as unknown as Prisma.TransactionClient, [row.id]);
  expect(mocks.config).toHaveBeenCalledWith(true); expect(mocks.token).toHaveBeenCalledWith(true);
});
it("reconciles already-completed session without abandoning exact file cleanup", async () => {
  const file = { id: "file-test", size: "4", mimeType: "video/mp4", trashed: false, parents: ["private-folder"],
    appProperties: { clinicalRecording: row.id }, permissions: [{ type: "user", role: "owner" }] };
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(new Response("{}", { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(file)))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  await deleteDriveArchivesForRecordings(transaction([{ ...row, archiveSession: "encrypted-session" }]) as unknown as Prisma.TransactionClient, [row.id]);
  expect(fetch).toHaveBeenCalledTimes(5);
});
it("rejects an unbound child before deleting bytes", async () => {
  const file = { id: "file-test", size: "4", mimeType: "video/mp4", trashed: false, parents: ["private-folder"],
    appProperties: { clinicalRecording: "another" }, permissions: [{ type: "user", role: "owner" }] };
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(file)));
  await expect(deleteDriveArchivesForRecordings(transaction() as unknown as Prisma.TransactionClient, [row.id])).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("permanently removes exact app-bound owner file even if shared or trashed", async () => {
  const file = { id: "file-test", size: "4", mimeType: "video/mp4", trashed: true, parents: ["private-folder"],
    appProperties: { clinicalRecording: row.id }, permissions: [{ type: "user", role: "owner" }, { type: "anyone", role: "reader" }] };
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(file)))
    .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(null, { status: 404 }));
  await deleteDriveArchivesForRecordings(transaction() as unknown as Prisma.TransactionClient, [row.id]);
  expect(fetch).toHaveBeenCalledTimes(3);
});
it("legacy purge preflight blocks any archive mapping or active lease", async () => {
  const db = { $queryRaw: vi.fn().mockResolvedValue([]), consultationRecording: { count: vi.fn().mockResolvedValue(1) } };
  await expect(assertNoDriveArchivesForLegacyPurge(db, ["consult-test"], true)).rejects.toThrow("DRIVE_ARCHIVE_CLEANUP_REQUIRED");
  expect(db.$queryRaw).toHaveBeenCalledOnce();
});
