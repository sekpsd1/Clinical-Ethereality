-- CreateTable
CREATE TABLE `ConsentRecord` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('privacy_policy', 'terms_of_service', 'health_data', 'teleconsultation', 'prescription_fulfillment') NOT NULL,
    `version` VARCHAR(80) NOT NULL,
    `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConsentRecord_userId_type_version_key`(`userId`, `type`, `version`),
    INDEX `ConsentRecord_userId_idx`(`userId`),
    INDEX `ConsentRecord_type_idx`(`type`),
    INDEX `ConsentRecord_acceptedAt_idx`(`acceptedAt`),
    INDEX `ConsentRecord_revokedAt_idx`(`revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove SMS from notification scope.
ALTER TABLE `Notification` MODIFY `channel` ENUM('in_app', 'line', 'email') NOT NULL DEFAULT 'in_app';
