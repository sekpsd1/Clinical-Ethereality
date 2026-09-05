export type AdminDoctorOption = {
  id: string;
  name: string;
  specialty: string;
  status: string;
  userStatus: string;
  consultationFeeInput: string;
  consultationFeeLabel: string;
  feeEligible: boolean;
  updatedAtIso: string;
};

export type AdminDoctorAvailabilitySlot = {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  weekday: number;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  slotMinutes: number;
  effectiveFromValue: string | null;
  effectiveToValue: string | null;
  effectiveRangeLabel: string;
  isActive: boolean;
  notes: string;
  updatedAt: string;
};

export type AdminManualAppointmentPatient = {
  id: string;
  name: string;
};

export type AdminDoctorAvailabilityDateOverride = {
  id: string;
  doctorId: string;
  doctorName: string;
  scheduleDate: string;
  scheduleDateValue: string;
  type: "available" | "closed";
  timeRange: string;
  slotMinutes: number | null;
  isActive: boolean;
  notes: string;
  updatedAt: string;
};

export type AdminSchedulesData = {
  doctors: AdminDoctorOption[];
  slots: AdminDoctorAvailabilitySlot[];
  dateOverrides: AdminDoctorAvailabilityDateOverride[];
  appointmentCalendar: AdminAppointmentCalendarData;
  manualAppointmentPatients: AdminManualAppointmentPatient[];
  summary: {
    activeDoctors: number;
    activeSlots: number;
    inactiveSlots: number;
  };
  unavailable?: boolean;
};

export type AdminAppointmentCalendarSlot = {
  id: string;
  doctorId: string;
  doctorName: string;
  availabilityId: string;
  scheduledAtIso: string;
  timeLabel: string;
  status: "available" | "pending_payment" | "scheduled" | "live";
  statusLabel: string;
  lockExpiresAt: string | null;
};

export type AdminAppointmentCalendarDay = {
  dateLabel: string;
  dateValue: string;
  slots: AdminAppointmentCalendarSlot[];
};

export type AdminAppointmentCalendarData = {
  dateLabel: string;
  dateValue: string;
  view: "day" | "week" | "month";
  doctors: Array<Pick<AdminDoctorOption, "id" | "name">>;
  selectedDoctorId: string;
  days: AdminAppointmentCalendarDay[];
};
