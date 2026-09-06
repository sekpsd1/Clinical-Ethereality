import { formatBangkokTime, getScheduledAtForCalendarDate, getScheduledSlotTimes } from "@/features/consultations/booking/slots";

export type AppointmentCalendarAvailability = {
  id: string;
  doctorId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  notes: string | null;
};

export type AppointmentCalendarOverride = {
  id: string;
  doctorId: string;
  type: "available" | "blocked" | "closed";
  startTime: string | null;
  endTime: string | null;
  slotMinutes: number | null;
  notes: string | null;
};

export type AppointmentCalendarConsultation = {
  doctorId: string;
  scheduledAt: Date | null;
  status: "pending_payment" | "scheduled" | "live";
  slotLockExpiresAt: Date | null;
};

export type BuiltAppointmentCalendarSlot = {
  availabilityId: string;
  doctorId: string;
  scheduledAt: Date;
  timeLabel: string;
  slotMinutes: number;
  notes: string | null;
  status: "available" | "blocked";
  consultation: AppointmentCalendarConsultation | null;
};

function isPendingPaymentLocked(consultation: AppointmentCalendarConsultation, now: Date): boolean {
  return consultation.status === "pending_payment" && (!consultation.slotLockExpiresAt || consultation.slotLockExpiresAt > now);
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlapsBlockedOverride(
  slot: { doctorId: string; timeLabel: string; slotMinutes: number },
  overrides: AppointmentCalendarOverride[]
): AppointmentCalendarOverride | null {
  const slotStart = timeToMinutes(slot.timeLabel);
  const slotEnd = slotStart + slot.slotMinutes;
  return overrides.find((override) => {
    if (override.doctorId !== slot.doctorId || override.type !== "blocked" || !override.startTime || !override.endTime) return false;
    const blockStart = timeToMinutes(override.startTime);
    const blockEnd = timeToMinutes(override.endTime);
    return slotStart < blockEnd && blockStart < slotEnd;
  }) ?? null;
}

export function buildAdminAppointmentCalendarSlots(input: {
  availabilities: AppointmentCalendarAvailability[];
  consultations: AppointmentCalendarConsultation[];
  dateValue: string;
  overrides: AppointmentCalendarOverride[];
  now: Date;
}): BuiltAppointmentCalendarSlot[] {
  const scheduleDate = new Date(`${input.dateValue}T12:00:00+07:00`);
  const closedDoctorIds = new Set(input.overrides.filter((override) => override.type === "closed").map((override) => override.doctorId));
  const availableBlocks = [
    ...input.availabilities
      .filter((availability) => availability.weekday === scheduleDate.getUTCDay() && !closedDoctorIds.has(availability.doctorId))
      .filter((availability) => {
        const effectiveFrom = availability.effectiveFrom?.toISOString().slice(0, 10);
        const effectiveTo = availability.effectiveTo?.toISOString().slice(0, 10);
        return (!effectiveFrom || input.dateValue >= effectiveFrom) && (!effectiveTo || input.dateValue <= effectiveTo);
      })
      .map((availability) => ({
        availabilityId: availability.id,
        doctorId: availability.doctorId,
        startTime: availability.startTime,
        endTime: availability.endTime,
        slotMinutes: availability.slotMinutes,
        notes: availability.notes
      })),
    ...input.overrides
      .filter(
        (override): override is AppointmentCalendarOverride & { startTime: string; endTime: string; slotMinutes: number } =>
          override.type === "available" && !closedDoctorIds.has(override.doctorId) && Boolean(override.startTime && override.endTime && override.slotMinutes)
      )
      .map((override) => ({
        availabilityId: override.id,
        doctorId: override.doctorId,
        startTime: override.startTime,
        endTime: override.endTime,
        slotMinutes: override.slotMinutes,
        notes: override.notes
      }))
  ];
  const blockedBlocks = input.overrides
    .filter(
      (override): override is AppointmentCalendarOverride & { startTime: string; endTime: string; slotMinutes: number } =>
        override.type === "blocked" && !closedDoctorIds.has(override.doctorId) && Boolean(override.startTime && override.endTime && override.slotMinutes)
    )
    .map((override) => ({
      availabilityId: override.id,
      doctorId: override.doctorId,
      startTime: override.startTime,
      endTime: override.endTime,
      slotMinutes: override.slotMinutes,
      notes: override.notes
    }));
  const consultationsBySlot = new Map(
    input.consultations
      .filter((consultation) => consultation.scheduledAt)
      .filter((consultation) => consultation.status !== "pending_payment" || isPendingPaymentLocked(consultation, input.now))
      .map((consultation) => [`${consultation.doctorId}:${consultation.scheduledAt!.getTime()}`, consultation])
  );
  const seen = new Set<string>();

  return [...availableBlocks, ...blockedBlocks]
    .flatMap((block) =>
      getScheduledSlotTimes(
        getScheduledAtForCalendarDate(input.dateValue, block.startTime),
        block.startTime,
        block.endTime,
        block.slotMinutes
      ).map((scheduledAt) => {
        const timeLabel = formatBangkokTime(scheduledAt);
        const blocked = overlapsBlockedOverride({ doctorId: block.doctorId, timeLabel, slotMinutes: block.slotMinutes }, input.overrides);
        return {
          availabilityId: blocked?.id ?? block.availabilityId,
          doctorId: block.doctorId,
          scheduledAt,
          timeLabel,
          slotMinutes: block.slotMinutes,
          notes: blocked?.notes ?? block.notes,
          status: blocked ? "blocked" as const : "available" as const,
          consultation: consultationsBySlot.get(`${block.doctorId}:${scheduledAt.getTime()}`) ?? null
        };
      })
    )
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime() || left.doctorId.localeCompare(right.doctorId))
    .filter((slot) => {
      const key = `${slot.doctorId}:${slot.scheduledAt.getTime()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
