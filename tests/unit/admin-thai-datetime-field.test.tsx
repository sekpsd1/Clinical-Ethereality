import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/payments/actions", () => ({
  createManualAppointmentPaymentIntakeAction: vi.fn(),
  reviewConsultationPaymentAction: vi.fn(),
  reviewManualAppointmentPaymentAction: vi.fn()
}));

import {
  AdminThaiDateTimeField,
  formatThaiDateInput,
  formatThaiTimeInput,
  toBangkokLocalDateTime
} from "@/features/admin/payments/AdminThaiDateTimeField";
import { AdminManualAppointmentIntakeForm } from "@/features/admin/AdminManualAppointmentIntakeForm";
import type { AdminAppointmentCalendarSlot } from "@/features/admin/schedules/types";

const slot: AdminAppointmentCalendarSlot = {
  id: "slot-1",
  doctorId: "doctor-1",
  doctorName: "Doctor",
  availabilityId: "availability-1",
  scheduledAtIso: "2030-01-01T03:00:00.000Z",
  timeLabel: "10:00",
  status: "available",
  statusLabel: "ว่าง",
  manualAppointmentReviewPending: false,
  slotMinutes: 15,
  lockExpiresAt: null
};

describe("Admin Thai date/time input", () => {
  it("formats typed or pasted numeric input for mobile keyboards", () => {
    expect(formatThaiDateInput("17092026")).toBe("17/09/2026");
    expect(formatThaiDateInput("17/09/2026")).toBe("17/09/2026");
    expect(formatThaiTimeInput("2359")).toBe("23:59");
    expect(formatThaiTimeInput("23:59")).toBe("23:59");
  });

  it("keeps the existing Bangkok-local server payload and rejects invalid dates and times", () => {
    expect(toBangkokLocalDateTime("17/09/2026", "00:00")).toBe("2026-09-17T00:00");
    expect(toBangkokLocalDateTime("29/02/2028", "23:59")).toBe("2028-02-29T23:59");
    expect(toBangkokLocalDateTime("29/02/2026", "12:00")).toBeNull();
    expect(toBangkokLocalDateTime("31/04/2026", "12:00")).toBeNull();
    expect(toBangkokLocalDateTime("17/09/2026", "24:00")).toBeNull();
    expect(toBangkokLocalDateTime("17/09/2026", "12:60")).toBeNull();
    expect(toBangkokLocalDateTime("17/09/2026", "9:30")).toBeNull();
  });

  it("renders labelled date and 24-hour inputs with the original hidden payload name", () => {
    const html = renderToStaticMarkup(<AdminThaiDateTimeField label="วันเวลาโอน" name="transferredAt" />);
    expect(html).toContain("DD/MM/YYYY");
    expect(html).toContain("HH:mm");
    expect(html).toContain("เวลา 24 ชั่วโมง");
    expect(html).toContain('name="transferredAt"');
    expect(html).toContain('type="hidden"');
    expect(html).not.toContain('type="datetime-local"');
  });

  it("uses the same input in Admin manual appointment intake", () => {
    const html = renderToStaticMarkup(<AdminManualAppointmentIntakeForm patients={[]} slot={slot} />);
    expect(html).toContain("DD/MM/YYYY");
    expect(html).toContain("HH:mm");
    expect(html).toContain('name="transferredAt"');
    expect(html).not.toContain('type="datetime-local"');
  });
});
