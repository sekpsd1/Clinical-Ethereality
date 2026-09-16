import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSession } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { consultation: { findFirst: mocks.findFirst } }
}));

import { AppointmentDetail } from "@/features/consultations/AppointmentDetail";
import { getCustomerAppointmentDetail } from "@/features/consultations/appointment/queries";

const session: PublicSession = {
  userId: "customer-1",
  lineUserId: "line-customer-1",
  role: "customer",
  expiresAt: "2030-01-01T00:00:00.000Z"
};

function pendingAppointment(verificationPayload: unknown) {
  return {
    id: "consultation-1",
    doctorId: "doctor-1",
    patientId: "customer-1",
    status: "pending_payment",
    scheduledAt: new Date("2030-01-01T03:00:00.000Z"),
    doctor: {
      specialty: "เวชศาสตร์ครอบครัว",
      consultationFee: 500,
      user: { displayName: "พญ. แพทย์จริง", avatarUrl: null }
    },
    payment: { status: "pending_review", verificationPayload }
  };
}

describe("customer manual appointment status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the Admin review state and removes the customer payment CTA", async () => {
    mocks.findFirst.mockResolvedValueOnce(pendingAppointment({
      manualAppointmentIntake: { version: 1, source: "admin_manual_appointment" }
    }));

    const data = await getCustomerAppointmentDetail(session, "consultation-1");
    const html = renderToStaticMarkup(<AppointmentDetail data={data} />);

    expect(data.appointment).toMatchObject({
      statusLabel: "รอแอดมินตรวจรายการโอน",
      paymentStatusLabel: "รอแอดมินตรวจรายการโอน",
      nextStepLabel: "รอผลตรวจจากแอดมิน",
      ctaLabel: null,
      ctaHref: null
    });
    expect(html).toContain("ยังไม่ยืนยันนัดหมาย");
    expect(html).toContain("กรุณาไม่ชำระหรือส่งหลักฐานซ้ำ");
    expect(html).not.toContain("ไปหน้าชำระเงิน");
    expect(html).not.toContain("/consult/payment?consultation=");
  });

  it("keeps the ordinary customer pending-payment CTA unchanged", async () => {
    mocks.findFirst.mockResolvedValueOnce(pendingAppointment({
      source: "customer_checkout_foundation"
    }));

    const data = await getCustomerAppointmentDetail(session, "consultation-1");

    expect(data.appointment).toMatchObject({
      statusLabel: "รอชำระเงิน",
      paymentStatusLabel: "รอชำระเงิน",
      ctaLabel: "ไปหน้าชำระเงิน",
      ctaHref: "/consult/payment?consultation=consultation-1"
    });
  });
});
