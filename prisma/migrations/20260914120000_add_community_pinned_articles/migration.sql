-- Add nullable pin metadata. Existing articles intentionally remain unpinned.
ALTER TABLE `Article`
    ADD COLUMN `pinnedAt` DATETIME(3) NULL,
    ADD COLUMN `pinnedById` VARCHAR(191) NULL;

-- Supports the published feed ordering and the serialized pinned-range lock.
CREATE INDEX `Article_status_pin_publish_idx`
    ON `Article`(`status`, `pinnedAt`, `publishedAt`, `createdAt`);

CREATE INDEX `Article_pinnedById_idx`
    ON `Article`(`pinnedById`);

ALTER TABLE `Article`
    ADD CONSTRAINT `Article_pinnedById_fkey`
    FOREIGN KEY (`pinnedById`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
