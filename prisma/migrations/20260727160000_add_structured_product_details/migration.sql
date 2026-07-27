ALTER TABLE `Product`
    ADD COLUMN `category` VARCHAR(80) NOT NULL DEFAULT 'other',
    ADD COLUMN `shortDescription` VARCHAR(300) NULL,
    ADD COLUMN `usageInstructions` TEXT NULL,
    ADD COLUMN `fdaNumber` VARCHAR(120) NULL,
    ADD COLUMN `warnings` TEXT NULL,
    ADD COLUMN `storageInstructions` TEXT NULL,
    ADD COLUMN `controlledOrRestricted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `specialFulfillmentNotes` TEXT NULL;

CREATE INDEX `Product_category_idx` ON `Product`(`category`);
