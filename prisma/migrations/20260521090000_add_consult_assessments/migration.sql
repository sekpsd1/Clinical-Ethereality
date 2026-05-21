-- AlterTable
ALTER TABLE `Consultation` ADD COLUMN `assessmentId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ConsultAssessment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `symptom` VARCHAR(80) NOT NULL,
    `symptomLabel` VARCHAR(120) NOT NULL,
    `duration` VARCHAR(80) NOT NULL,
    `durationLabel` VARCHAR(120) NOT NULL,
    `recommendationTopic` VARCHAR(120) NOT NULL,
    `recommendationSpecialty` VARCHAR(120) NOT NULL,
    `recommendationReason` TEXT NOT NULL,
    `answersJson` JSON NOT NULL,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ConsultAssessment_userId_idx`(`userId`),
    INDEX `ConsultAssessment_expiresAt_idx`(`expiresAt`),
    INDEX `ConsultAssessment_recommendationTopic_idx`(`recommendationTopic`),
    INDEX `ConsultAssessment_completedAt_idx`(`completedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Consultation_assessmentId_idx` ON `Consultation`(`assessmentId`);

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `ConsultAssessment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsultAssessment` ADD CONSTRAINT `ConsultAssessment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
