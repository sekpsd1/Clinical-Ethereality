-- Per-booking telemedicine consent is intentionally separate from reusable
-- account-level consent records. Existing consultations are not backfilled.
CREATE TABLE `TelemedicineConsent` (
  `id` VARCHAR(191) NOT NULL,
  `consultationId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `version` VARCHAR(80) NOT NULL,
  `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ipAddress` VARCHAR(45) NULL,
  `userAgent` TEXT NULL,
  `metadataJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `TelemedicineConsent_consultationId_key`(`consultationId`),
  INDEX `TelemedConsent_user_accepted_idx`(`userId`, `acceptedAt`),
  INDEX `TelemedConsent_version_idx`(`version`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ConsultationRecording` (
  `id` VARCHAR(191) NOT NULL,
  `consultationId` VARCHAR(191) NOT NULL,
  `provider` ENUM('zoom') NOT NULL DEFAULT 'zoom',
  `providerRecordingId` VARCHAR(191) NOT NULL,
  `recordingType` VARCHAR(80) NOT NULL,
  `fileType` VARCHAR(40) NOT NULL,
  `fileSizeBytes` BIGINT NULL,
  `startedAt` DATETIME(3) NULL,
  `endedAt` DATETIME(3) NULL,
  `retentionUntil` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ConsultRecording_provider_file_key`(`provider`, `providerRecordingId`),
  INDEX `ConsultRecording_consult_created_idx`(`consultationId`, `createdAt`),
  INDEX `ConsultRecording_retention_idx`(`retentionUntil`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ConsultationRecordingWebhookEvent` (
  `id` VARCHAR(191) NOT NULL,
  `consultationId` VARCHAR(191) NOT NULL,
  `provider` ENUM('zoom') NOT NULL DEFAULT 'zoom',
  `providerEventKey` VARCHAR(64) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ConsultationRecordingWebhookEvent_providerEventKey_key`(`providerEventKey`),
  INDEX `ConsultRecEvent_consult_time_idx`(`consultationId`, `occurredAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TelemedicineConsent`
  ADD CONSTRAINT `TelemedicineConsent_consultationId_fkey`
  FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `TelemedicineConsent_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ConsultationRecording`
  ADD CONSTRAINT `ConsultationRecording_consultationId_fkey`
  FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ConsultationRecordingWebhookEvent`
  ADD CONSTRAINT `ConsultationRecordingWebhookEvent_consultationId_fkey`
  FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing consultation chat history receives the same five-year retention
-- boundary as newly created messages. No message content is changed or deleted.
ALTER TABLE `ConsultationMessage`
  ADD COLUMN `retentionUntil` DATETIME(3) NULL;

UPDATE `ConsultationMessage`
SET `retentionUntil` = DATE_ADD(`createdAt`, INTERVAL 5 YEAR)
WHERE `retentionUntil` IS NULL;

ALTER TABLE `ConsultationMessage`
  MODIFY `retentionUntil` DATETIME(3) NOT NULL,
  ADD INDEX `ConsultMessage_retention_idx`(`retentionUntil`);
