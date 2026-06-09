-- CreateTable
CREATE TABLE `FileAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `purpose` ENUM('external_prescription', 'payment_slip', 'prescription_pdf', 'clinical_image', 'other') NOT NULL,
    `status` ENUM('attached', 'archived') NOT NULL DEFAULT 'attached',
    `entityType` VARCHAR(80) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `storageUrl` TEXT NOT NULL,
    `storageKey` TEXT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(120) NULL,
    `byteSize` INTEGER NULL,
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FileAttachment_ownerId_idx`(`ownerId`),
    INDEX `FileAttachment_purpose_idx`(`purpose`),
    INDEX `FileAttachment_status_idx`(`status`),
    INDEX `FileAttachment_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `FileAttachment_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FileAttachment` ADD CONSTRAINT `FileAttachment_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
