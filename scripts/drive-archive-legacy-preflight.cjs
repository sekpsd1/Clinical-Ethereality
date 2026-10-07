const { Prisma } = require("@prisma/client");
async function assertNoDriveArchivesForLegacyPurge(db, consultationIds, lock = false) {
  const scope = consultationIds ? { consultationId: { in: consultationIds } } : {};
  if (lock) {
    if (consultationIds?.length) await db.$queryRaw(Prisma.sql`SELECT id FROM ConsultationRecording WHERE consultationId IN (${Prisma.join(consultationIds)}) FOR UPDATE`);
    else if (!consultationIds) await db.$queryRaw(Prisma.sql`SELECT id FROM ConsultationRecording FOR UPDATE`);
  }
  const count = await db.consultationRecording.count({ where: { ...scope, OR: [
    { archiveDriveFileId: { not: null } }, { archiveSession: { not: null } }, { archiveLeaseUntil: { gt: new Date() } }
  ] } });
  if (count) throw new Error("DRIVE_ARCHIVE_CLEANUP_REQUIRED_BEFORE_LEGACY_PURGE");
}
module.exports = { assertNoDriveArchivesForLegacyPurge };
