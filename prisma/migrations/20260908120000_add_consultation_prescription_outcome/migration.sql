-- Additive consultation-level prescription outcome. Existing consultations remain
-- explicitly pending doctor summary; no medical outcome is inferred from history.
ALTER TABLE `Consultation`
  ADD COLUMN `prescriptionOutcomeStatus` ENUM(
    'pending_doctor_summary',
    'prescription_issued',
    'no_prescription'
  ) NOT NULL DEFAULT 'pending_doctor_summary',
  ADD COLUMN `prescriptionOutcomeUpdatedAt` DATETIME(3) NULL;

CREATE INDEX `Consultation_prescriptionOutcomeStatus_idx`
  ON `Consultation`(`prescriptionOutcomeStatus`);
