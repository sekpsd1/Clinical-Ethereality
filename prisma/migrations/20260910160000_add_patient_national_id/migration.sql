-- Additive patient identity field. Existing users can complete it on their next booking identity check.
ALTER TABLE `User`
  ADD COLUMN `nationalId` VARCHAR(13) NULL;

CREATE UNIQUE INDEX `User_nationalId_key` ON `User`(`nationalId`);
