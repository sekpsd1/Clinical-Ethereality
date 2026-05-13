export type AdminDoctorOption = {
  id: string;
  name: string;
  specialty: string;
  status: string;
};

export type AdminDoctorAvailabilitySlot = {
  id: string;
  doctorName: string;
  doctorSpecialty: string;
  weekday: number;
  weekdayLabel: string;
  timeRange: string;
  slotMinutes: number;
  isActive: boolean;
  notes: string;
  updatedAt: string;
};

export type AdminSchedulesData = {
  doctors: AdminDoctorOption[];
  slots: AdminDoctorAvailabilitySlot[];
  summary: {
    activeDoctors: number;
    activeSlots: number;
    inactiveSlots: number;
  };
  unavailable?: boolean;
};
