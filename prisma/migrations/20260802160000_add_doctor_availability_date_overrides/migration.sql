-- Date-specific availability replaces the recurring weekday availability for that date.
-- A `closed` row represents a full-day closure; an `available` row stores one special time block.
CREATE TABLE `DoctorAvailabilityDateOverride` (
    `id` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `scheduleDate` DATE NOT NULL,
    `type` ENUM('available', 'closed') NOT NULL,
    `startTime` VARCHAR(5) NULL,
    `endTime` VARCHAR(5) NULL,
    `slotMinutes` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DoctorAvailDate_doc_date_active_idx`(`doctorId`, `scheduleDate`, `isActive`),
    INDEX `DoctorAvailDate_date_active_idx`(`scheduleDate`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DoctorAvailabilityDateOverride`
    ADD CONSTRAINT `DoctorAvailabilityDateOverride_doctorId_fkey`
    FOREIGN KEY (`doctorId`) REFERENCES `Doctor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
