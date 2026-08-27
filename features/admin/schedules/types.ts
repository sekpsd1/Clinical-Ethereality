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
  isActive: boolean;
  notes: string;
  updatedAt: string;
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
  summary: {
    activeDoctors: number;
    activeSlots: number;
    inactiveSlots: number;
  };
  unavailable?: boolean;
};
