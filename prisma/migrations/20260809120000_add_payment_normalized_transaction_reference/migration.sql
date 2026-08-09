-- Additive only: legacy references inside JSON evidence are intentionally not inferred
-- or backfilled. NULL remains valid for pending, rejected, and ambiguous historic rows.
ALTER TABLE `Payment`
  ADD COLUMN `normalizedTransactionReference` VARCHAR(191) NULL;

-- MySQL permits multiple NULL values. Every new verified/refunded reference is written
-- in its final payment transition, where this index is the concurrency-safe authority.
CREATE UNIQUE INDEX `Payment_normalizedTransactionReference_key`
  ON `Payment`(`normalizedTransactionReference`);
