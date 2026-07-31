-- Add customer-owned shipping addresses and immutable per-order snapshots.
-- Existing orders remain valid because the snapshot is stored in a separate optional relation.
CREATE TABLE `ShippingAddress` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(60) NOT NULL,
    `recipientName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `addressLine1` VARCHAR(255) NOT NULL,
    `addressLine2` VARCHAR(255) NULL,
    `subdistrict` VARCHAR(120) NOT NULL,
    `district` VARCHAR(120) NOT NULL,
    `province` VARCHAR(120) NOT NULL,
    `postalCode` VARCHAR(5) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShippingAddress_userId_isDefault_idx`(`userId`, `isDefault`),
    INDEX `ShippingAddress_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrderShippingAddress` (
    `orderId` VARCHAR(191) NOT NULL,
    `sourceAddressId` VARCHAR(191) NULL,
    `label` VARCHAR(60) NOT NULL,
    `recipientName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `addressLine1` VARCHAR(255) NOT NULL,
    `addressLine2` VARCHAR(255) NULL,
    `subdistrict` VARCHAR(120) NOT NULL,
    `district` VARCHAR(120) NOT NULL,
    `province` VARCHAR(120) NOT NULL,
    `postalCode` VARCHAR(5) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderShippingAddress_sourceAddressId_idx`(`sourceAddressId`),
    PRIMARY KEY (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ShippingAddress`
    ADD CONSTRAINT `ShippingAddress_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OrderShippingAddress`
    ADD CONSTRAINT `OrderShippingAddress_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
