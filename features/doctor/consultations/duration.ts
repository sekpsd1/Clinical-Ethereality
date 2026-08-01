export function formatDoctorConsultationDuration(slotMinutes: number | null | undefined): string {
  if (!isValidSlotMinutes(slotMinutes)) {
    return "ยังไม่ระบุ";
  }

  return `${slotMinutes} นาที`;
}

export type ConsultationBookingDurationAudit = {
  id: string;
  entityId: string | null;
  createdAt: Date;
  metadataJson: unknown;
};

export type ConsultationDurationAvailability = {
  id: string;
  slotMinutes: number;
  updatedAt: Date;
};

export type ConsultationDurationSnapshot = {
  id: string;
  bookedDurationMinutes: number | null;
};

function isValidSlotMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function getDurationMetadata(metadataJson: unknown): { availabilityId: string | null; slotMinutes: number | null } {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return {
      availabilityId: null,
      slotMinutes: null
    };
  }

  const metadata = metadataJson as Record<string, unknown>;

  return {
    availabilityId: typeof metadata.availabilityId === "string" && metadata.availabilityId.length > 0 ? metadata.availabilityId : null,
    slotMinutes: isValidSlotMinutes(metadata.slotMinutes) ? metadata.slotMinutes : null
  };
}

function sortBookingAudits(audits: ConsultationBookingDurationAudit[]): ConsultationBookingDurationAudit[] {
  return [...audits].sort((left, right) => {
    const byCreatedAt = left.createdAt.getTime() - right.createdAt.getTime();
    return byCreatedAt === 0 ? left.id.localeCompare(right.id) : byCreatedAt;
  });
}

export function getLegacyDurationAvailabilityIds(audits: ConsultationBookingDurationAudit[]): string[] {
  return [
    ...new Set(
      audits
        .map((audit) => getDurationMetadata(audit.metadataJson))
        .filter((metadata) => metadata.slotMinutes === null)
        .map((metadata) => metadata.availabilityId)
        .filter((id): id is string => Boolean(id))
    )
  ];
}

export function resolveDoctorConsultationDurationSnapshots(
  audits: ConsultationBookingDurationAudit[],
  availability: ConsultationDurationAvailability[]
): Map<string, number> {
  const orderedAudits = sortBookingAudits(audits).filter((audit) => Boolean(audit.entityId));
  const durationByConsultationId = new Map<string, number>();

  for (const audit of orderedAudits) {
    const metadata = getDurationMetadata(audit.metadataJson);

    if (audit.entityId && metadata.slotMinutes !== null && !durationByConsultationId.has(audit.entityId)) {
      durationByConsultationId.set(audit.entityId, metadata.slotMinutes);
    }
  }

  const availabilityById = new Map(availability.map((slot) => [slot.id, slot]));

  for (const audit of orderedAudits) {
    if (!audit.entityId || durationByConsultationId.has(audit.entityId)) {
      continue;
    }

    const metadata = getDurationMetadata(audit.metadataJson);
    const legacyAvailability = metadata.availabilityId ? availabilityById.get(metadata.availabilityId) : null;

    if (legacyAvailability && legacyAvailability.updatedAt.getTime() <= audit.createdAt.getTime() && isValidSlotMinutes(legacyAvailability.slotMinutes)) {
      durationByConsultationId.set(audit.entityId, legacyAvailability.slotMinutes);
    }
  }

  return durationByConsultationId;
}

export function resolveDoctorConsultationDurations(
  consultations: ConsultationDurationSnapshot[],
  audits: ConsultationBookingDurationAudit[],
  availability: ConsultationDurationAvailability[]
): Map<string, number> {
  const durationByConsultationId = new Map<string, number>();

  for (const consultation of consultations) {
    if (isValidSlotMinutes(consultation.bookedDurationMinutes)) {
      durationByConsultationId.set(consultation.id, consultation.bookedDurationMinutes);
    }
  }

  const legacyDurations = resolveDoctorConsultationDurationSnapshots(audits, availability);

  for (const [consultationId, duration] of legacyDurations) {
    if (!durationByConsultationId.has(consultationId)) {
      durationByConsultationId.set(consultationId, duration);
    }
  }

  return durationByConsultationId;
}
