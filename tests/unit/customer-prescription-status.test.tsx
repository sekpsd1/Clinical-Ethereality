import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSession } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  noStore: vi.fn(),
  prescriptionFindMany: vi.fn(),
  consultationFindMany: vi.fn()
}));

vi.mock("next/cache", () => ({
  unstable_noStore: mocks.noStore
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    consultation: {
      findMany: mocks.consultationFindMany
    },
    prescription: {
      findMany: mocks.prescriptionFindMany
    }
  }
}));

import { PrescriptionStatusScreen } from "@/features/consultations/PrescriptionStatusScreen";
import { getCustomerPrescriptions } from "@/features/consultations/prescriptions/queries";

const session: PublicSession = {
  userId: "customer-1",
  lineUserId: "line-customer-1",
  role: "customer",
  expiresAt: "2026-09-07T00:00:00.000Z"
};

function prescription(orderItems: Array<Record<string, unknown>>) {
  return {
    id: "prescription-1",
    status: "pending_verification",
    notes: "ติดตามอาการหลังใช้ยา",
    itemsJson: [
      {
        medicationName: "Paracetamol 500 mg",
        dosage: "500 mg",
        quantity: "10 เม็ด",
        instructions: "รับประทานครั้งละ 1 เม็ดหลังอาหาร"
      }
    ],
    verifiedAt: null,
    consultation: {
      scheduledAt: new Date("2026-09-06T08:00:00.000Z"),
      createdAt: new Date("2026-09-05T08:00:00.000Z")
    },
    doctor: {
      user: {
        displayName: "แพทย์ทดสอบ"
      }
    },
    pharmacist: null,
    orderItems
  };
}

describe("customer prescription status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consultationFindMany.mockResolvedValue([]);
  });

  it("shows a customer-owned completed consultation with no prescription as a read-only outcome", async () => {
    mocks.prescriptionFindMany.mockResolvedValue([]);
    mocks.consultationFindMany.mockResolvedValue([
      {
        id: "consultation-no-prescription",
        prescriptionOutcomeStatus: "no_prescription",
        scheduledAt: new Date("2026-09-06T08:00:00.000Z"),
        createdAt: new Date("2026-09-05T08:00:00.000Z"),
        doctor: {
          user: {
            displayName: "แพทย์ทดสอบ"
          }
        }
      }
    ]);

    const data = await getCustomerPrescriptions(session);
    const html = renderToStaticMarkup(createElement(PrescriptionStatusScreen, { data }));

    expect(mocks.consultationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "customer-1",
          status: "completed"
        })
      })
    );
    expect(data.consultationOutcomes[0]?.statusLabel).toBe("ไม่มีใบสั่งยา");
    expect(html).toContain("แพทย์สรุปแล้วว่าการปรึกษาครั้งนี้ไม่มีใบสั่งยา");
  });

  it("explains that an order has not been placed yet and keeps the primary order CTA", async () => {
    mocks.prescriptionFindMany.mockResolvedValue([prescription([])]);

    const data = await getCustomerPrescriptions(session);
    const item = data.prescriptions[0];
    const html = renderToStaticMarkup(createElement(PrescriptionStatusScreen, { data }));

    expect(item.productSummary).toBe("Paracetamol 500 mg");
    expect(item.linkedOrderCode).toBeNull();
    expect(item.nextStepBody).toContain("คุณยังไม่ได้สั่งยาจากใบสั่งยานี้");
    expect(item.ctaLabel).toBe("สั่งยาตามใบสั่งแพทย์");
    expect(item.ctaHref).toBe("/store/prescriptions/prescription-1");
    expect(html).toContain("สถานะคำสั่งซื้อ");
    expect(html).toContain("ยังไม่ได้สั่งยาจากใบสั่งยานี้");
    expect(html).not.toContain("ยังไม่มีคำสั่งซื้อยาที่เชื่อมโยง");
    expect(html).not.toContain("คำสั่งซื้อที่เกี่ยวข้อง");
  });

  it("preserves linked-order details and tracking CTA when an order exists", async () => {
    mocks.prescriptionFindMany.mockResolvedValue([
      prescription([
        {
          quantity: 2,
          product: { name: "Paracetamol 500 mg" },
          order: { id: "order-123456" }
        }
      ])
    ]);

    const data = await getCustomerPrescriptions(session);
    const item = data.prescriptions[0];
    const html = renderToStaticMarkup(createElement(PrescriptionStatusScreen, { data }));

    expect(item.productSummary).toBe("Paracetamol 500 mg x2");
    expect(item.linkedOrderCode).toBe("CE-123456");
    expect(item.nextStepTitle).toBe("ติดตามคำสั่งซื้อยา");
    expect(item.ctaLabel).toBe("ติดตามคำสั่งซื้อ");
    expect(item.ctaHref).toBe("/store/orders");
    expect(html).toContain("คำสั่งซื้อที่เกี่ยวข้อง");
    expect(html).toContain("CE-123456");
    expect(html).not.toContain("ยังไม่ได้สั่งยาจากใบสั่งยานี้");
  });
});
