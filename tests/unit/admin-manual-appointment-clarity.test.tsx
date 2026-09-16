import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/admin/payments/actions", () => ({
  createManualAppointmentPaymentIntakeAction: vi.fn()
}));

import { AdminCalendarSlotDrawer } from "@/features/admin/AdminCalendarSlotDrawer";
import { AdminManualAppointmentFeedback } from "@/features/admin/AdminManualAppointmentIntakeForm";
import type { AdminAppointmentCalendarSlot } from "@/features/admin/schedules/types";

const pendingSlot: AdminAppointmentCalendarSlot = {
  id: "slot-1",
  doctorId: "doctor-1",
  doctorName: "พญ. แพทย์จริง",
  availabilityId: "availability-1",
  scheduledAtIso: "2030-01-01T03:00:00.000Z",
  timeLabel: "10:00",
  status: "pending_payment",
  statusLabel: "รอตรวจรายการโอน",
  manualAppointmentReviewPending: true,
  slotMinutes: 15,
  lockExpiresAt: "1 ม.ค. 2573 10:15"
};

describe("Admin manual appointment clarity", () => {
  it("labels a manual hold as waiting for transfer review while ordinary holds remain payment-pending", () => {
    const manualHtml = renderToStaticMarkup(
      <AdminCalendarSlotDrawer
        dateValue="2030-01-01"
        patients={[]}
        slot={pendingSlot}
        doctors={[]}
        overrides={[]}
        onClose={() => undefined}
      />
    );
    const ordinaryHtml = renderToStaticMarkup(
      <AdminCalendarSlotDrawer
        dateValue="2030-01-01"
        patients={[]}
        slot={{ ...pendingSlot, statusLabel: "รอชำระเงิน", manualAppointmentReviewPending: false }}
        doctors={[]}
        overrides={[]}
        onClose={() => undefined}
      />
    );

    expect(manualHtml).toContain("คำขอ Manual ที่รอตรวจรายการโอน");
    expect(ordinaryHtml).toContain("ถูกล็อกระหว่างรอชำระเงิน");
  });

  it("links a successful intake only to the general Admin Payments queue", () => {
    const html = renderToStaticMarkup(
      <AdminManualAppointmentFeedback
        state={{
          status: "success",
          message: "รับหลักฐานแล้ว รายการยังรอตรวจและยังไม่ยืนยันนัดหมาย",
          consultationId: "sensitive-consultation-id",
          paymentId: "sensitive-payment-id"
        }}
      />
    );

    expect(html).toContain("ไปตรวจและยืนยันในหน้าชำระเงิน");
    expect(html).toContain('href="/admin/payments"');
    expect(html).not.toContain("sensitive-consultation-id");
    expect(html).not.toContain("sensitive-payment-id");
  });
});
