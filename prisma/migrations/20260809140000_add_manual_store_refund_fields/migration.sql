-- Additive refund ledger fields. Existing incoming payment references are untouched.
ALTER TABLE `Payment`
  ADD COLUMN `refundTransactionReference` VARCHAR(255) NULL,
  ADD COLUMN `normalizedRefundReference` VARCHAR(191) NULL,
  ADD COLUMN `refundAmount` DECIMAL(10, 2) NULL,
  ADD COLUMN `refundReason` TEXT NULL,
  ADD COLUMN `refundedAt` DATETIME(3) NULL,
  ADD COLUMN `refundedById` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Payment_normalizedRefundReference_key`
  ON `Payment`(`normalizedRefundReference`);

CREATE INDEX `Payment_refundedById_idx` ON `Payment`(`refundedById`);
CREATE INDEX `Payment_refundedAt_idx` ON `Payment`(`refundedAt`);

ALTER TABLE `Payment`
  ADD CONSTRAINT `Payment_refundedById_fkey`
  FOREIGN KEY (`refundedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
