import { describe, expect, it } from "vitest";
import { formatDoctorConsultationDuration } from "@/features/doctor/consultations/duration";

describe("doctor consultation duration", () => {
  it.each([15, 30, 45, 60])("uses the configured %i-minute availability slot", (slotMinutes) => {
    expect(formatDoctorConsultationDuration(slotMinutes)).toBe(`${slotMinutes} นาที`);
  });

  it.each([null, undefined, 0, -15, 22.5])("keeps incomplete or invalid availability duration explicit", (slotMinutes) => {
    expect(formatDoctorConsultationDuration(slotMinutes)).toBe("ยังไม่ระบุ");
  });
});
