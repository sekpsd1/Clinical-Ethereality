-- CreateTable
CREATE TABLE `ConsultationMessage` (
    `id` VARCHAR(191) NOT NULL,
    `consultationId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('visible', 'hidden', 'archived') NOT NULL DEFAULT 'visible',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ConsultationMessage_consultationId_createdAt_idx`(`consultationId`, `createdAt`),
    INDEX `ConsultationMessage_senderId_idx`(`senderId`),
    INDEX `ConsultationMessage_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConsultationMessage` ADD CONSTRAINT `ConsultationMessage_consultationId_fkey` FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultationMessage` ADD CONSTRAINT `ConsultationMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
