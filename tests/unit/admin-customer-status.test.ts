import { describe, expect, it } from "vitest";
import {
  getAdminConsultationStatusCopy,
  getCustomerJourneyLabel,
  isAssessmentActive
} from "@/features/admin/customers/status";

describe("admin customer journey status", () => {
  it("keeps an assessment active only until its expiry time", () => {
    const now = new Date("2026-07-29T10:00:00.000Z");

    expect(isAssessmentActive(new Date("2026-07-29T10:00:01.000Z"), now)).toBe(true);
    expect(isAssessmentActive(new Date("2026-07-29T10:00:00.000Z"), now)).toBe(false);
  });

  it("shows that an assessment is waiting for booking before a consultation exists", () => {
    expect(
      getCustomerJourneyLabel({
        hasAssessment: true,
        assessmentIsActive: true,
        consultationStatus: null
      })
    ).toBe("ทำแบบประเมินแล้ว รอจอง");
  });

  it("shows payment readiness from the consultation status", () => {
    expect(getAdminConsultationStatusCopy("pending_payment")).toMatchObject({
      label: "จองแล้ว รอชำระเงิน",
      paymentLabel: "รอชำระค่าปรึกษา",
      tone: "warning"
    });
    expect(getAdminConsultationStatusCopy("scheduled")).toMatchObject({
      label: "ยืนยันนัดหมายแล้ว",
      paymentLabel: "ชำระค่าปรึกษาแล้ว",
      tone: "success"
    });
  });

  it("keeps cancelled consultations visibly distinct from an expired unbooked assessment", () => {
    expect(
      getCustomerJourneyLabel({
        hasAssessment: true,
        assessmentIsActive: false,
        consultationStatus: null
      })
    ).toBe("แบบประเมินหมดอายุ");
    expect(
      getCustomerJourneyLabel({
        hasAssessment: true,
        assessmentIsActive: false,
        consultationStatus: "cancelled"
      })
    ).toBe("ยกเลิกหรือหมดอายุ");
  });
});
