-- Preserve the duration selected at booking time independently of the temporary slot lock.
-- Nullable keeps all existing consultations readable when historic duration cannot be proven.
ALTER TABLE `Consultation` ADD COLUMN `bookedDurationMinutes` INTEGER NULL;

-- Backfill only the earliest valid explicit duration snapshot from the existing booking audit.
-- Ordering matches the application fallback: createdAt first, then id for deterministic ties.
UPDATE `Consultation` AS consultation
INNER JOIN `AuditLog` AS bookingAudit
  ON bookingAudit.`entityId` = consultation.`id`
  AND bookingAudit.`action` = 'consultation.book_slot'
  AND bookingAudit.`entityType` = 'consultation'
  AND COALESCE(JSON_VALID(bookingAudit.`metadataJson`), 0) = 1
  AND JSON_TYPE(JSON_EXTRACT(bookingAudit.`metadataJson`, '$.slotMinutes')) = 'INTEGER'
  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(bookingAudit.`metadataJson`, '$.slotMinutes')) AS SIGNED) > 0
SET consultation.`bookedDurationMinutes` = CAST(
  JSON_UNQUOTE(JSON_EXTRACT(bookingAudit.`metadataJson`, '$.slotMinutes')) AS SIGNED
)
WHERE consultation.`bookedDurationMinutes` IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `AuditLog` AS earlierSnapshot
    WHERE earlierSnapshot.`entityId` = bookingAudit.`entityId`
      AND earlierSnapshot.`action` = 'consultation.book_slot'
      AND earlierSnapshot.`entityType` = 'consultation'
      AND COALESCE(JSON_VALID(earlierSnapshot.`metadataJson`), 0) = 1
      AND JSON_TYPE(JSON_EXTRACT(earlierSnapshot.`metadataJson`, '$.slotMinutes')) = 'INTEGER'
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(earlierSnapshot.`metadataJson`, '$.slotMinutes')) AS SIGNED) > 0
      AND (
        earlierSnapshot.`createdAt` < bookingAudit.`createdAt`
        OR (
          earlierSnapshot.`createdAt` = bookingAudit.`createdAt`
          AND earlierSnapshot.`id` < bookingAudit.`id`
        )
      )
  );

-- For older audit events without an explicit snapshot, recover only from an availability
-- record that has not changed since that audit. Ambiguous records intentionally stay NULL.
UPDATE `Consultation` AS consultation
INNER JOIN `AuditLog` AS bookingAudit
  ON bookingAudit.`entityId` = consultation.`id`
  AND bookingAudit.`action` = 'consultation.book_slot'
  AND bookingAudit.`entityType` = 'consultation'
  AND (
    COALESCE(JSON_VALID(bookingAudit.`metadataJson`), 0) = 0
    OR COALESCE(JSON_TYPE(JSON_EXTRACT(bookingAudit.`metadataJson`, '$.slotMinutes')), '') <> 'INTEGER'
    OR CAST(JSON_UNQUOTE(JSON_EXTRACT(bookingAudit.`metadataJson`, '$.slotMinutes')) AS SIGNED) <= 0
  )
INNER JOIN `DoctorAvailability` AS availability
  ON availability.`id` = JSON_UNQUOTE(JSON_EXTRACT(bookingAudit.`metadataJson`, '$.availabilityId'))
  AND availability.`updatedAt` <= bookingAudit.`createdAt`
  AND availability.`slotMinutes` > 0
SET consultation.`bookedDurationMinutes` = availability.`slotMinutes`
WHERE consultation.`bookedDurationMinutes` IS NULL
  AND COALESCE(JSON_VALID(bookingAudit.`metadataJson`), 0) = 1
  AND JSON_TYPE(JSON_EXTRACT(bookingAudit.`metadataJson`, '$.availabilityId')) = 'STRING'
  AND NOT EXISTS (
    SELECT 1
    FROM `AuditLog` AS explicitSnapshot
    WHERE explicitSnapshot.`entityId` = bookingAudit.`entityId`
      AND explicitSnapshot.`action` = 'consultation.book_slot'
      AND explicitSnapshot.`entityType` = 'consultation'
      AND COALESCE(JSON_VALID(explicitSnapshot.`metadataJson`), 0) = 1
      AND JSON_TYPE(JSON_EXTRACT(explicitSnapshot.`metadataJson`, '$.slotMinutes')) = 'INTEGER'
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(explicitSnapshot.`metadataJson`, '$.slotMinutes')) AS SIGNED) > 0
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `AuditLog` AS earlierLegacyAudit
    INNER JOIN `DoctorAvailability` AS earlierAvailability
      ON earlierAvailability.`id` = JSON_UNQUOTE(JSON_EXTRACT(earlierLegacyAudit.`metadataJson`, '$.availabilityId'))
      AND earlierAvailability.`updatedAt` <= earlierLegacyAudit.`createdAt`
      AND earlierAvailability.`slotMinutes` > 0
    WHERE earlierLegacyAudit.`entityId` = bookingAudit.`entityId`
      AND earlierLegacyAudit.`action` = 'consultation.book_slot'
      AND earlierLegacyAudit.`entityType` = 'consultation'
      AND COALESCE(JSON_VALID(earlierLegacyAudit.`metadataJson`), 0) = 1
      AND JSON_TYPE(JSON_EXTRACT(earlierLegacyAudit.`metadataJson`, '$.availabilityId')) = 'STRING'
      AND (
        COALESCE(JSON_TYPE(JSON_EXTRACT(earlierLegacyAudit.`metadataJson`, '$.slotMinutes')), '') <> 'INTEGER'
        OR CAST(JSON_UNQUOTE(JSON_EXTRACT(earlierLegacyAudit.`metadataJson`, '$.slotMinutes')) AS SIGNED) <= 0
      )
      AND (
        earlierLegacyAudit.`createdAt` < bookingAudit.`createdAt`
        OR (
          earlierLegacyAudit.`createdAt` = bookingAudit.`createdAt`
          AND earlierLegacyAudit.`id` < bookingAudit.`id`
        )
      )
  );
