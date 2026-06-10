export type BookingDoctor = {
  id: string;
  name: string;
  specialty: string;
  fee: string;
  avatarUrl: string;
};

export type BookingSlot = {
  id: string;
  weekdayLabel: string;
  dateLabel: string;
  timeLabel: string;
  slotMinutes: number;
  scheduledAt: string;
  notes: string;
  status: "available" | "booked";
  statusLabel: string;
};

export type DoctorBookingData = {
  doctor: BookingDoctor | null;
  slots: BookingSlot[];
  unavailable?: boolean;
};
