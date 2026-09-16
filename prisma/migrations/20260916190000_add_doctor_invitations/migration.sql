-- Additive one-time Doctor invitations. Only domain-separated token hashes are
-- persisted; the raw invitation secret exists only in the creation response.
CREATE TABLE `DoctorInvitation` (
  `id` VARCHAR(191) NOT NULL,
  `role` ENUM('doctor') NOT NULL DEFAULT 'doctor',
  `tokenHash` VARCHAR(64) NOT NULL,
  `creationKeyHash` VARCHAR(64) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `claimedById` VARCHAR(191) NULL,
  `revokedById` VARCHAR(191) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `claimedAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DoctorInvitation_tokenHash_key`(`tokenHash`),
  UNIQUE INDEX `DoctorInvitation_creationKeyHash_key`(`creationKeyHash`),
  INDEX `DoctorInvitation_createdById_createdAt_idx`(`createdById`, `createdAt`),
  INDEX `DoctorInvitation_claimedById_claimedAt_idx`(`claimedById`, `claimedAt`),
  INDEX `DoctorInvitation_revokedAt_expiresAt_idx`(`revokedAt`, `expiresAt`),
  INDEX `DoctorInvitation_role_expiresAt_idx`(`role`, `expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DoctorInvitation`
  ADD CONSTRAINT `DoctorInvitation_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DoctorInvitation_claimedById_fkey`
    FOREIGN KEY (`claimedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `DoctorInvitation_revokedById_fkey`
    FOREIGN KEY (`revokedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
