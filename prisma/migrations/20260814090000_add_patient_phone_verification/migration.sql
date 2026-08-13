-- Additive progressive customer verification. Existing users remain unverified until they complete SMS OTP.
ALTER TABLE `User`
  ADD COLUMN `fullName` VARCHAR(191) NULL,
  ADD COLUMN `dateOfBirth` DATE NULL,
  ADD COLUMN `normalizedPhone` VARCHAR(20) NULL,
  ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `User_normalizedPhone_key` ON `User`(`normalizedPhone`);
CREATE INDEX `User_phoneVerifiedAt_idx` ON `User`(`phoneVerifiedAt`);

CREATE TABLE `PhoneVerificationChallenge` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `normalizedPhone` VARCHAR(20) NOT NULL,
  `providerChallengeCiphertext` TEXT NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `verifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `PhoneVerificationChallenge_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX `PhoneVerificationChallenge_userId_expiresAt_idx`
  ON `PhoneVerificationChallenge`(`userId`, `expiresAt`);
CREATE INDEX `PhoneVerificationChallenge_userId_requestedAt_idx`
  ON `PhoneVerificationChallenge`(`userId`, `requestedAt`);
