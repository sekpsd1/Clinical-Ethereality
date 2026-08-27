-- Additive per-user claim used to serialize SMS OTP provider dispatches.
-- Existing users remain immediately eligible because the column is nullable.
ALTER TABLE `User`
  ADD COLUMN `phoneOtpDispatchClaimedUntil` DATETIME(3) NULL;
