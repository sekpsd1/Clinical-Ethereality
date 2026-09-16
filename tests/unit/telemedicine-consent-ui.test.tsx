import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingTimeSlotForm } from "@/features/consultations/booking/BookingTimeSlotForm";
import type { DoctorBookingData } from "@/features/consultations/booking/types";
import { TELEMEDICINE_CONSENT_VERSION } from "@/features/consultations/consent/policy";
import {
  telemedicineConsentFinalChoices,
  telemedicineConsentSections
} from "@/features/consultations/consent/content";

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
  nationalId: "1101700207030",
  phone: "0812345678",
  phoneVerifiedAt: "2030-01-01T00:00:00.000Z",
  isVerified: true
};

describe("telemedicine consent booking UI", () => {
  it("shows the fixed 15-minute label in the existing mobile slot layout", () => {
    const html = renderToStaticMarkup(
      <BookingTimeSlotForm data={data} verification={verification} canSelfConsent bookingError={null} />
    );

    expect(html).toContain("grid grid-cols-2 gap-3");
    expect(html).toContain("15 นาที");
    expect(html).not.toContain("30 นาที");
  });

  it("shows the complete scrollable consent, current disclosure, and acceptance fields to an adult", () => {
    const html = renderToStaticMarkup(
      <BookingTimeSlotForm data={data} verification={verification} canSelfConsent bookingError={null} />
    );
    for (const section of telemedicineConsentSections) {
      expect(html).toContain(section.title);
      for (const block of section.blocks) {
        expect(html).toContain(block.text);
      }
    }
    for (const choice of telemedicineConsentFinalChoices) {
      expect(html).toContain(choice);
    }
    expect(html).toContain("เสียง วิดีโอ และประวัติแชทโดยอัตโนมัติทุกเคส");
    expect(html).toContain("role=\"region\"");
    expect(html).toContain("tabindex=\"0\"");
    expect(html).toContain("aria-labelledby=\"booking-telemedicine-consent-title\"");
    expect(html).toContain("aria-describedby=\"booking-telemedicine-consent-instructions\"");
    expect(html).toContain("overflow-y-scroll");
    expect(html).toContain("name=\"telemedicineConsentAccepted\"");
    expect(html).toContain(`name="telemedicineConsentVersion" value="${TELEMEDICINE_CONSENT_VERSION}"`);
    expect(html).toContain("required=\"\"");
    expect(html).toMatch(/type="submit" disabled=""/);
    expect(html).toContain('data-testid="booking-submit-bar"');
    expect(html).not.toContain("fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))]");
    expect(html).not.toContain("sticky bottom-[calc(5rem+env(safe-area-inset-bottom))]");
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
    expect(html).not.toContain("booking-telemedicine-consent-title");
    expect(html).toContain("ยืนยันเวลาใหม่");
  });
});
