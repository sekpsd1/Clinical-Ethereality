import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BookingTimeSlotForm } from "@/features/consultations/booking/BookingTimeSlotForm";
import type { DoctorBookingData } from "@/features/consultations/booking/types";

const baseData: DoctorBookingData = {
  doctor: { id: "fixture-doctor-1", name: "แพทย์ทดสอบ", specialty: "เวชกรรม", fee: "800 บาท", avatarUrl: "/unused.png" },
  slots: [{ id: "fixture-slot", slotKey: "fixture-slot", weekdayLabel: "พุธ", dateLabel: "9 ก.ย.", timeLabel: "10:00", slotMinutes: 15, scheduledAt: "2030-09-09T03:00:00.000Z", notes: "", status: "available", statusLabel: "ว่าง" }]
};
const verification = { fullName: "Synthetic Preview", dateOfBirth: "2000-01-01", nationalId: "", phone: "", phoneVerifiedAt: "2030-01-01T00:00:00.000Z", isVerified: true };

function Preview() {
  const [bookingKey, setBookingKey] = useState(0);
  const [doctor, setDoctor] = useState(1);
  const params = new URLSearchParams(location.search);
  return (
    <main className="mx-auto max-w-mobile space-y-4 p-4">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setBookingKey((key) => key + 1)}>เริ่มการจองใหม่</button>
        <button type="button" onClick={() => setDoctor((id) => id === 1 ? 2 : 1)}>เปลี่ยนแพทย์ทดสอบ</button>
      </div>
      <BookingTimeSlotForm key={bookingKey} data={{ ...baseData, doctor: { ...baseData.doctor!, id: `fixture-doctor-${doctor}` } }} verification={{ ...verification, isVerified: !params.has("unverified") }} canSelfConsent={!params.has("minor")} bookingError={null} rescheduleConsultationId={params.has("reschedule") ? "fixture-reschedule" : undefined} />
      <div className="h-screen" aria-hidden="true" />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Preview />);
