ALTER TABLE `ConsultationRecording`
  ADD COLUMN `archiveStatus` VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN `archiveDriveFileId` VARCHAR(191) NULL,
  ADD COLUMN `archiveSession` TEXT NULL,
  ADD COLUMN `archiveOffset` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `archiveAttempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `archiveRetryAt` DATETIME(3) NULL,
  ADD COLUMN `archiveLeaseToken` VARCHAR(64) NULL,
  ADD COLUMN `archiveLeaseUntil` DATETIME(3) NULL,
  ADD COLUMN `archivedAt` DATETIME(3) NULL;
CREATE UNIQUE INDEX `ConsultationRecording_archiveDriveFileId_key` ON `ConsultationRecording`(`archiveDriveFileId`);
CREATE INDEX `ConsultRecording_archive_idx` ON `ConsultationRecording`(`archiveStatus`, `archiveRetryAt`);
