-- Preserve the existing Payment entity while allowing consultation payments
-- to retain their own verification evidence.
ALTER TABLE `Payment`
  MODIFY `orderId` VARCHAR(191) NULL,
  ADD COLUMN `consultationId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Payment_consultationId_key` ON `Payment`(`consultationId`);
CREATE INDEX `Payment_consultationId_idx` ON `Payment`(`consultationId`);

ALTER TABLE `Payment`
  ADD CONSTRAINT `Payment_consultationId_fkey`
  FOREIGN KEY (`consultationId`) REFERENCES `Consultation`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Consultation`
  ADD COLUMN `zoomPassword` VARCHAR(120) NULL;

ALTER TABLE `Prescription`
  ADD COLUMN `itemsJson` JSON NULL;
