import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingTimeSlotForm } from "@/features/consultations/booking/BookingTimeSlotForm";
import type { DoctorBookingData } from "@/features/consultations/booking/types";

const data: DoctorBookingData = {
  doctor: { id: "cmdoctor123456789012345", name: "แพทย์ทดสอบ", specialty: "เวชกรรม", fee: "800 บาท", avatarUrl: "/doctor.png" },
  slots: [{
    id: "availability-1",
    slotKey: "slot-1",
    weekdayLabel: "พุธ",
    dateLabel: "9 ก.ย.",
    timeLabel: "10:00",
    slotMinutes: 30,
    scheduledAt: "2030-09-09T03:00:00.000Z",
    notes: "",
    status: "available",
    statusLabel: "ว่าง"
  }]
};

const verification = {
  fullName: "Customer Test",
  dateOfBirth: "2000-01-01",
  phone: "0812345678",
  phoneVerifiedAt: "2030-01-01T00:00:00.000Z",
  isVerified: true
};

describe("telemedicine consent booking UI", () => {
  it("shows the automatic audio/video/chat recording disclosure to an adult", () => {
    const html = renderToStaticMarkup(
      <BookingTimeSlotForm data={data} verification={verification} canSelfConsent bookingError={null} />
    );
    expect(html).toContain("ความยินยอม Telemedicine");
    expect(html).toContain("เสียง วิดีโอ และประวัติแชทโดยอัตโนมัติทุกเคส");
    expect(html).toContain("telemedicineConsentVersion");
    expect(html).toContain("required");
  });

  it("shows a clear guardian requirement and no self-consent checkbox for a minor", () => {
    const html = renderToStaticMarkup(
      <BookingTimeSlotForm data={data} verification={{ ...verification, dateOfBirth: "2015-01-01" }} canSelfConsent={false} bookingError={null} />
    );
    expect(html).toContain("ผู้มีอายุต่ำกว่า 18 ปีไม่สามารถให้ความยินยอมเองได้");
    expect(html).toContain("ผู้ปกครองตามกฎหมาย");
    expect(html).not.toContain("name=\"telemedicineConsentAccepted\"");
  });

  it("does not request a new consent when rescheduling the same paid consultation", () => {
    const html = renderToStaticMarkup(
      <BookingTimeSlotForm data={data} verification={verification} canSelfConsent bookingError={null} rescheduleConsultationId="consultation-1" />
    );
    expect(html).not.toContain("telemedicineConsentVersion");
    expect(html).toContain("ยืนยันเวลาใหม่");
  });
});
