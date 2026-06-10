-- CreateTable
CREATE TABLE `ConsultationSlotLock` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `availabilityId` VARCHAR(191) NULL,
    `patientId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConsultationSlotLock_doctorId_scheduledAt_key`(`doctorId`, `scheduledAt`),
    INDEX `ConsultationSlotLock_availabilityId_idx`(`availabilityId`),
    INDEX `ConsultationSlotLock_patientId_idx`(`patientId`),
    INDEX `ConsultationSlotLock_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Consultation` ADD COLUMN `slotLockId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Consultation_slotLockId_key` ON `Consultation`(`slotLockId`);

-- AddForeignKey
ALTER TABLE `ConsultationSlotLock` ADD CONSTRAINT `ConsultationSlotLock_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `Doctor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_slotLockId_fkey` FOREIGN KEY (`slotLockId`) REFERENCES `ConsultationSlotLock`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
