-- Add a non-bookable, time-bounded Doctor schedule override.
-- Existing `available` and full-day `closed` values remain unchanged.
ALTER TABLE `DoctorAvailabilityDateOverride`
    MODIFY `type` ENUM('available', 'blocked', 'closed') NOT NULL;
