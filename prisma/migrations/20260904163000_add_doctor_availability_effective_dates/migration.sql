ALTER TABLE `DoctorAvailability`
  ADD COLUMN `effectiveFrom` DATE NULL,
  ADD COLUMN `effectiveTo` DATE NULL;

CREATE INDEX `DoctorAvail_effective_range_idx`
  ON `DoctorAvailability`(`doctorId`, `weekday`, `isActive`, `effectiveFrom`, `effectiveTo`);
