-- AlterTable
ALTER TABLE `Article`
    ADD COLUMN `category` VARCHAR(80) NULL;

-- CreateTable
CREATE TABLE `SavedArticle` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SavedArticle_userId_articleId_key`(`userId`, `articleId`),
    INDEX `SavedArticle_userId_idx`(`userId`),
    INDEX `SavedArticle_articleId_idx`(`articleId`),
    INDEX `SavedArticle_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityReport` (
    `id` VARCHAR(191) NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NULL,
    `articleId` VARCHAR(191) NULL,
    `commentId` VARCHAR(191) NULL,
    `reason` VARCHAR(80) NOT NULL,
    `details` TEXT NULL,
    `status` ENUM('pending', 'dismissed', 'actioned') NOT NULL DEFAULT 'pending',
    `resolutionAction` VARCHAR(40) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CommunityReport_reporterId_articleId_key`(`reporterId`, `articleId`),
    UNIQUE INDEX `CommunityReport_reporterId_commentId_key`(`reporterId`, `commentId`),
    INDEX `CommunityReport_status_idx`(`status`),
    INDEX `CommunityReport_articleId_idx`(`articleId`),
    INDEX `CommunityReport_commentId_idx`(`commentId`),
    INDEX `CommunityReport_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddIndex
CREATE INDEX `Article_category_idx` ON `Article`(`category`);

-- AddForeignKey
ALTER TABLE `SavedArticle` ADD CONSTRAINT `SavedArticle_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavedArticle` ADD CONSTRAINT `SavedArticle_articleId_fkey`
    FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityReport` ADD CONSTRAINT `CommunityReport_reporterId_fkey`
    FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityReport` ADD CONSTRAINT `CommunityReport_reviewerId_fkey`
    FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityReport` ADD CONSTRAINT `CommunityReport_articleId_fkey`
    FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityReport` ADD CONSTRAINT `CommunityReport_commentId_fkey`
    FOREIGN KEY (`commentId`) REFERENCES `Comment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
