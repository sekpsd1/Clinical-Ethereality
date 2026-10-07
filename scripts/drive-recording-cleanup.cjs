const { Prisma } = require("@prisma/client");
// Call only inside the same transaction that permanently removes the exact recording rows.
async function cleanupDriveRecordingRows(tx, recordingIds, adapter) {
  if (!recordingIds.length) return;
  await tx.$queryRaw(Prisma.sql`SELECT id FROM ConsultationRecording WHERE id IN (${Prisma.join(recordingIds)}) FOR UPDATE`);
  const rows = await tx.consultationRecording.findMany({ where: { id: { in: recordingIds } }, select: {
    id: true, archiveDriveFileId: true, archiveSession: true, archiveLeaseUntil: true,
    fileSizeBytes: true, fileType: true
  } });
  const archives = rows.filter((row) => row.archiveDriveFileId || row.archiveSession);
  // A job may have claimed a row before reserving its remote ID: reject every active lease.
  if (rows.some((row) => row.archiveLeaseUntil && row.archiveLeaseUntil.getTime() > Date.now())) throw new Error("ARCHIVE_BUSY");
  if (!archives.length) return;
  await tx.consultationRecording.updateMany({ where: { id: { in: recordingIds } }, data: { archiveStatus: "deleting", archiveLeaseToken: null } });
  const deadline = Date.now() + 45_000;
  await adapter.prepare();
  const checkedRequest = async (operation) => {
    if (Date.now() >= deadline - 1000) throw new Error("ARCHIVE_CLEANUP_RETRY_REQUIRED");
    // A timed-out/rolled-back transaction cannot continue external work.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM ConsultationRecording WHERE id IN (${Prisma.join(recordingIds)}) FOR UPDATE`);
    if (Date.now() >= deadline - 1000) throw new Error("ARCHIVE_CLEANUP_RETRY_REQUIRED");
    return operation(Math.min(8000, deadline - Date.now()));
  };
  for (const row of archives) {
    if (!row.archiveDriveFileId || !row.fileSizeBytes) throw new Error("ARCHIVE_MAPPING_INVALID");
    if (row.archiveSession) await checkedRequest((timeout) => adapter.cancel(row, timeout));
    const file = await checkedRequest((timeout) => adapter.get(row.archiveDriveFileId, timeout));
    if (!file) continue; // Retained exact mapping makes provider404 retries idempotent.
    adapter.verify(file, row);
    await checkedRequest((timeout) => adapter.remove(row.archiveDriveFileId, timeout));
    if (await checkedRequest((timeout) => adapter.get(row.archiveDriveFileId, timeout))) throw new Error("ARCHIVE_DELETE_NOT_VERIFIED");
  }
}
module.exports = { cleanupDriveRecordingRows };
