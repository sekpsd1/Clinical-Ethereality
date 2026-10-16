import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BookingTimeSlotForm } from "@/features/consultations/booking/BookingTimeSlotForm";
import type { DoctorBookingData } from "@/features/consultations/booking/types";
import { TELEMEDICINE_CONSENT_VERSION } from "@/features/consultations/consent/policy";
import {
  TELEMEDICINE_CONSENT_DOCUMENT_TITLE,
  telemedicineConsentSections
} from "@/features/consultations/consent/content";
import { TelemedicineConsentContent } from "@/features/consultations/consent/TelemedicineConsentContent";

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
  it("preserves all 43 source Word paragraphs in order after trimming paragraph-edge whitespace only", () => {
    const paragraphs = [TELEMEDICINE_CONSENT_DOCUMENT_TITLE, ...telemedicineConsentSections.flatMap((section) => [section.title, ...section.blocks.map((block) => block.text)])];
    expect(paragraphs).toHaveLength(43);
    // Independently extracted from the owner-supplied 2026-10-16 DOCX with python-docx.
    expect(createHash("sha256").update(JSON.stringify(paragraphs)).digest("hex")).toBe("c20253c4298fe8d3ee3de4f9c0fd83f683b3b0998186815c88a649165221fd96");
  });
  it("shows the fixed 15-minute label in the existing mobile slot layout", () => {
    const html = renderToStaticMarkup(
      <BookingTimeSlotForm data={data} verification={verification} canSelfConsent bookingError={null} />
    );

    expect(html).toContain("grid grid-cols-2 gap-3");
    expect(html).toContain("15 นาที");
    expect(html).not.toContain("30 นาที");
  });

  it("provides a dialog entry and keeps booking disabled before explicit acceptance", () => {
    const html = renderToStaticMarkup(
      <BookingTimeSlotForm data={data} verification={verification} canSelfConsent bookingError={null} />
    );
    expect(html).toContain("อ่านความยินยอม");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('role="region"');
    expect(html).not.toContain('checked=""');
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

  it("renders every source paragraph and clearly separates the recording disclosure", () => {
    const html = renderToStaticMarkup(<TelemedicineConsentContent />);
    for (const section of telemedicineConsentSections) {
      expect(html).toContain(section.title);
      for (const block of section.blocks) expect(html).toContain(block.text);
    }
    expect(html).toContain("คำชี้แจงเพิ่มเติมของระบบ แยกจากแบบฟอร์มข้างต้น");
    expect(html).toContain("เสียง วิดีโอ และประวัติแชทโดยอัตโนมัติทุกเคส");
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
