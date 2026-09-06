-- Additive, privacy-minimized Zoom attendance evidence for consultation completion.
ALTER TABLE `Consultation`
  ADD COLUMN `completionOutcome` ENUM('normal', 'no_show') NULL,
  ADD COLUMN `noShowReason` ENUM('customer_did_not_join') NULL;

CREATE TABLE `ConsultationAttendanceCredential` (
  `id` VARCHAR(191) NOT NULL,
  `consultationId` VARCHAR(191) NOT NULL,
  `role` ENUM('doctor', 'customer') NOT NULL,
  `customerKeyHash` VARCHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ConsultationAttendanceCredential_customerKeyHash_key`(`customerKeyHash`),
  INDEX `ConsultAttendCred_consult_role_exp_idx`(`consultationId`, `role`, `expiresAt`),
  INDEX `ConsultAttendCred_expires_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ConsultationAttendanceEvent` (
  `id` VARCHAR(191) NOT NULL,
  `consultationId` VARCHAR(191) NOT NULL,
  `providerEventKey` VARCHAR(64) NOT NULL,
  `meetingUuidHash` VARCHAR(64) NOT NULL,
  `participantSessionHash` VARCHAR(64) NOT NULL,
  `role` ENUM('doctor', 'customer') NOT NULL,
  `eventType` ENUM('joined', 'left') NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ConsultationAttendanceEvent_providerEventKey_key`(`providerEventKey`),
  INDEX `ConsultAttendEvent_meeting_role_time_idx`(`consultationId`, `meetingUuidHash`, `role`, `occurredAt`),
  INDEX `ConsultAttendEvent_session_time_idx`(`consultationId`, `participantSessionHash`, `occurredAt`),
  INDEX `ConsultAttendEvent_occurred_idx`(`occurredAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ConsultationAttendanceCredential`
  ADD CONSTRAINT `ConsultationAttendanceCredential_consultationId_fkey`
  FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ConsultationAttendanceEvent`
  ADD CONSTRAINT `ConsultationAttendanceEvent_consultationId_fkey`
  FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
